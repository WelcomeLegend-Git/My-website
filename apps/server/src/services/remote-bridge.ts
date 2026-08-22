import { type Express } from "express";
import type http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { verifyAccessToken } from "../auth/tokens";
import { prisma } from "../prisma";
import { logger } from "../logger";
import bcrypt from "bcryptjs";
import { createAccessToken, createRefreshToken } from "../auth/tokens";
import crypto from "node:crypto";
import { z } from "zod";
import { env } from "../env";
import webpush from "web-push";
import admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";

// ─── Firebase Admin SDK (FCM for phone push commands) ───
// Loads credentials from FIREBASE_SERVICE_ACCOUNT env var (Render)
// or from firebase-service-account.json file (local dev)

let firebaseServiceAccount: any = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    firebaseServiceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (error) {
    logger.error({ error }, "Failed to parse FIREBASE_SERVICE_ACCOUNT env var");
  }
} else {
  const serviceAccountPath = path.join(__dirname, "..", "firebase-service-account.json");
  if (fs.existsSync(serviceAccountPath)) {
    try {
      firebaseServiceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
    } catch (error) {
      logger.error({ error }, "Failed to read firebase-service-account.json");
    }
  }
}

if (firebaseServiceAccount && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseServiceAccount),
    });
    logger.info("Firebase Admin SDK initialized (FCM ready)");
  } catch (error) {
    logger.error({ error }, "Failed to initialize Firebase Admin SDK");
  }
} else if (!firebaseServiceAccount) {
  logger.warn("No Firebase credentials found — FCM disabled. Set FIREBASE_SERVICE_ACCOUNT env var or provide firebase-service-account.json");
}

// ─── Constants ───

const MAX_DEVICES_PER_USER = 5;
const QR_EXPIRY_MS = 60 * 1000;        // 1 minute
const MANUAL_CODE_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes
const MAX_PAIRINGS_PER_HOUR = 5;        // 5 QR + 5 manual per hour
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const INCOMING_CALL_PUSH_DEDUPE_MS = 75 * 1000; // one push burst per ringing call

// ─── Web Push Setup ───

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_EMAIL) {
  // web-push requires URL-safe Base64 (no padding, - instead of +, _ instead of /)
  const toUrlSafeBase64 = (s: string) => s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const vapidPublic = toUrlSafeBase64(env.VAPID_PUBLIC_KEY);
  const vapidPrivate = toUrlSafeBase64(env.VAPID_PRIVATE_KEY);
  
  webpush.setVapidDetails(
    `mailto:${env.VAPID_EMAIL}`,
    vapidPublic,
    vapidPrivate
  );
  logger.info("Web Push (VAPID) configured");
}

// ─── Push Notifications (DB-backed, persistent) ───

const incomingCallPushes = new Map<string, number>();

function getIncomingCallPushKey(input: {
  userId: string;
  deviceId?: string;
  callerName?: string;
  callSignalId?: string;
}): string {
  const deviceId = input.deviceId || "unknown-device";
  const callIdentity = input.callSignalId ||
    (input.callerName || "unknown").trim().toLowerCase().slice(0, 80);
  return `${input.userId}:${deviceId}:${callIdentity}`;
}

function shouldSendIncomingCallPush(input: {
  userId: string;
  deviceId?: string;
  callerName?: string;
  callSignalId?: string;
}): { send: boolean; key: string } {
  const now = Date.now();
  const expiryCutoff = now - INCOMING_CALL_PUSH_DEDUPE_MS;

  for (const [key, lastSentAt] of incomingCallPushes) {
    if (lastSentAt < expiryCutoff) incomingCallPushes.delete(key);
  }

  const key = getIncomingCallPushKey(input);
  const lastSentAt = incomingCallPushes.get(key);
  if (lastSentAt && now - lastSentAt < INCOMING_CALL_PUSH_DEDUPE_MS) {
    return { send: false, key };
  }

  incomingCallPushes.set(key, now);
  return { send: true, key };
}

async function sendPushNotification(userId: string, payload: object): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;

  try {
    // Find all tablet devices for this user that have push enabled + allowed
    const tablets = await prisma.remoteBridgeDevice.findMany({
      where: {
        userId,
        deviceType: "tablet",
        pushEnabled: true,
        pushAllowed: true,
        pushSubscription: { not: null },
      },
    });

    for (const tablet of tablets) {
      if (!tablet.pushSubscription) continue;
      try {
        const sub = JSON.parse(tablet.pushSubscription) as webpush.PushSubscription;
        await webpush.sendNotification(sub, JSON.stringify(payload));
        logger.info({ userId, deviceId: tablet.deviceId }, "Push notification sent");
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          // Subscription expired — clear it
          await prisma.remoteBridgeDevice.update({
            where: { id: tablet.id },
            data: { pushSubscription: null, pushEnabled: false },
          });
          logger.info({ userId, deviceId: tablet.deviceId }, "Push subscription expired, cleared");
        } else {
          logger.error({ error, deviceId: tablet.deviceId }, "Push notification failed");
        }
      }
    }
  } catch (error) {
    logger.error({ error }, "sendPushNotification error");
  }
}

// ─── FCM Push to Phone (for commands + wake signals) ───

async function sendFcmToPhone(
  userId: string,
  data: Record<string, string>
): Promise<boolean> {
  if (!admin.apps.length) return false;

  try {
    // Find all phone devices for this user with FCM tokens
    const phones = await prisma.remoteBridgeDevice.findMany({
      where: {
        userId,
        deviceType: "phone",
        fcmToken: { not: null },
      },
    });

    let sent = false;
    for (const phone of phones) {
      if (!phone.fcmToken) continue;
      try {
        await admin.messaging().send({
          token: phone.fcmToken,
          data, // FCM data-only message — wakes the app
          android: {
            priority: "high", // Ensures delivery even in Doze mode
          },
        });
        logger.info({ userId, deviceId: phone.deviceId }, "FCM sent to phone");
        sent = true;
      } catch (error: any) {
        if (
          error.code === "messaging/registration-token-not-registered" ||
          error.code === "messaging/invalid-registration-token"
        ) {
          // Token expired — clear it
          await prisma.remoteBridgeDevice.update({
            where: { id: phone.id },
            data: { fcmToken: null },
          });
          logger.info({ deviceId: phone.deviceId }, "FCM token expired, cleared");
        } else {
          logger.error({ error, deviceId: phone.deviceId }, "FCM send failed");
        }
      }
    }
    return sent;
  } catch (error) {
    logger.error({ error }, "sendFcmToPhone error");
    return false;
  }
}

// ─── Persistent Diagnostic Logging (stored in DB for viewing) ───

async function diagLog(
  userId: string,
  source: "server" | "phone" | "tablet",
  event: string,
  details?: string
): Promise<void> {
  if (!userId) {
    logger.warn({ source, event, details }, "diagLog skipped: no userId");
    return;
  }
  try {
    await prisma.remoteBridgeDiagLog.create({
      data: { userId, source, event, details },
    });
    logger.debug({ userId, source, event }, "diagLog written");
  } catch (error) {
    // Never let diagnostic logging break the main flow
    logger.error({ error, userId, source, event }, "diagLog write failed");
  }
}

// ─── Types ───

interface AuthenticatedSocket {
  ws: WebSocket;
  userId: string;
  deviceId: string;
  deviceType: "phone" | "tablet";
  lastPing: number;
}

// ─── Connected Clients ───

const connectedClients = new Map<string, AuthenticatedSocket>();

// ─── Active Pairing Sessions (short-lived, in-memory) ───

interface PairingSession {
  userId: string;
  pairingToken: string;
  encryptionKey: string;
  expiresAt: Date;
  confirmed: boolean;
  phoneDeviceId: string | null;
  type: "qr" | "manual";
  ipAddress: string;
}

const activePairingSessions = new Map<string, PairingSession>();

// ─── Pairing Rate Limiting (per user, per type) ───

interface PairingRateLimit {
  qrCount: number;
  manualCount: number;
  windowStart: number;
}

const pairingRateLimits = new Map<string, PairingRateLimit>();

async function getLinkedTabletCount(userId: string): Promise<number> {
  return prisma.remoteBridgeDevice.count({
    where: { userId, deviceType: "tablet" },
  });
}

function checkPairingRateLimit(userId: string, type: "qr" | "manual"): boolean {
  const now = Date.now();
  let limit = pairingRateLimits.get(userId);

  if (!limit || now - limit.windowStart > 3600_000) {
    // Reset window every hour
    limit = { qrCount: 0, manualCount: 0, windowStart: now };
    pairingRateLimits.set(userId, limit);
  }

  if (type === "qr") return limit.qrCount >= MAX_PAIRINGS_PER_HOUR;
  return limit.manualCount >= MAX_PAIRINGS_PER_HOUR;
}

function recordPairingCreation(userId: string, type: "qr" | "manual"): void {
  const limit = pairingRateLimits.get(userId) || { qrCount: 0, manualCount: 0, windowStart: Date.now() };
  if (type === "qr") limit.qrCount++;
  else limit.manualCount++;
  pairingRateLimits.set(userId, limit);
}

// ─── Login Rate Limiting ───

const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();

function isRateLimited(ip: string): boolean {
  const attempts = loginAttempts.get(ip);
  if (!attempts) return false;
  if (Date.now() < attempts.blockedUntil) return true;
  if (Date.now() >= attempts.blockedUntil) {
    loginAttempts.delete(ip);
    return false;
  }
  return false;
}

function recordLoginAttempt(ip: string, success: boolean): void {
  if (success) {
    loginAttempts.delete(ip);
    return;
  }
  const existing = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  existing.count++;
  if (existing.count >= MAX_LOGIN_ATTEMPTS) {
    existing.blockedUntil = Date.now() + BLOCK_DURATION_MS;
  }
  loginAttempts.set(ip, existing);
}

// ─── REST API Routes ───

export function setupRemoteBridgeRoutes(app: Express): void {

  // ═══ Login ═══

  app.post("/api/remote-bridge/login", async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    if (isRateLimited(ip)) {
      await logActivity(null, null, "login_blocked", `IP rate limited: ${ip}`, ip);
      return res.status(429).json({ message: "Too many attempts. Try again later." });
    }

    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(1),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash) {
        recordLoginAttempt(ip, false);
        await logAttempt(ip, email, false);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        recordLoginAttempt(ip, false);
        await logAttempt(ip, email, false);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      recordLoginAttempt(ip, true);
      await logAttempt(ip, email, true);
      await logActivity(user.id, null, "login", `Bridge login from ${ip}`, ip);

      const accessToken = createAccessToken({ sub: user.id, email: user.email });
      const refreshToken = createRefreshToken({ sub: user.id, email: user.email });

      return res.json({
        accessToken,
        refreshToken,
        userId: user.id,
        userName: user.name,
      });
    } catch (error) {
      logger.error({ error }, "Remote bridge login error");
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ═══ Personal Link (1-Step Master Pairing with PIN: 878955) ═══

  app.post("/api/remote-bridge/personal-link", async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    try {
      const schema = z.object({
        pin: z.string(),
        deviceId: z.string(),
        encryptionKey: z.string().optional(),
        deviceName: z.string().optional(),
        email: z.string().email().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload format" });
      }

      const { pin, deviceId, encryptionKey, deviceName, email } = parsed.data;
      if (pin !== "878955") {
        return res.status(401).json({ message: "Invalid master PIN" });
      }

      // Find user
      let user = null;
      if (email) {
        user = await prisma.user.findUnique({ where: { email } });
      }
      if (!user) {
        user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
      }
      if (!user) {
        return res.status(404).json({ message: "No registered account found" });
      }

      // Upsert trusted phone device
      await prisma.remoteBridgeDevice.upsert({
        where: { userId_deviceId: { userId: user.id, deviceId } },
        update: {
          trusted: true,
          deviceType: "phone",
          deviceName: deviceName || "Suraj Phone",
          lastSeen: new Date(),
          ipAddress: ip,
          pairedVia: "personal_master_pin",
        },
        create: {
          userId: user.id,
          deviceId,
          deviceType: "phone",
          deviceName: deviceName || "Suraj Phone",
          trusted: true,
          pairedVia: "personal_master_pin",
          ipAddress: ip,
        },
      });

      const accessToken = createAccessToken({ sub: user.id, email: user.email });
      const refreshToken = createRefreshToken({ sub: user.id, email: user.email });

      await logActivity(user.id, deviceId, "personal_link_connected", `Master personal link activated from ${ip}`, ip);

      return res.json({
        success: true,
        userId: user.id,
        userName: user.name,
        accessToken,
        refreshToken,
        encryptionKey,
        deviceId,
      });
    } catch (error) {
      logger.error({ error }, "Personal master link error");
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ═══ Device Management ═══

  app.get("/api/remote-bridge/devices", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const devices = await prisma.remoteBridgeDevice.findMany({
      where: { userId, deviceType: "tablet" },
      orderBy: { createdAt: "desc" },
    });
    // Return only safe fields
    const mapped = devices.map((d: any) => ({
      id: d.id,
      deviceId: d.deviceId,
      deviceType: d.deviceType,
      deviceName: d.deviceName,
      trusted: d.trusted,
      lastSeen: d.lastSeen,
      ipAddress: d.ipAddress,
      pairedVia: d.pairedVia,
      createdAt: d.createdAt,
    }));
    return res.json(mapped);
  });

  // Update device name
  app.patch("/api/remote-bridge/devices/:deviceId/name", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const { deviceId } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.length > 50) {
      return res.status(400).json({ message: "Name must be 1-50 characters" });
    }

    const device = await prisma.remoteBridgeDevice.findUnique({
      where: { userId_deviceId: { userId, deviceId } },
    });

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    await prisma.remoteBridgeDevice.update({
      where: { id: device.id },
      data: { deviceName: name.trim() },
    });

    return res.json({ success: true });
  });

  // Trust device
  app.post("/api/remote-bridge/devices/:deviceId/trust", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const { deviceId } = req.params;
    const ip = req.ip || "unknown";

    const device = await prisma.remoteBridgeDevice.findUnique({
      where: { userId_deviceId: { userId, deviceId } },
    });

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    await prisma.remoteBridgeDevice.update({
      where: { id: device.id },
      data: { trusted: true },
    });

    await logActivity(userId, deviceId, "device_trusted", `Device ${deviceId} trusted`, ip);
    return res.json({ success: true });
  });

  // Revoke / remove device
  app.delete("/api/remote-bridge/devices/:deviceId", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const { deviceId } = req.params;
    const ip = req.ip || "unknown";

    await prisma.remoteBridgeDevice.deleteMany({
      where: { userId, deviceId },
    });

    await logActivity(userId, deviceId, "device_removed", `Device ${deviceId} removed`, ip);

    // Disconnect if online
    const client = connectedClients.get(deviceId);
    if (client && client.userId === userId) {
      client.ws.close(1000, "Device removed");
      connectedClients.delete(deviceId);
    }

    return res.json({ success: true });
  });

  // ═══ Kill Switch ═══

  app.post("/api/remote-bridge/kill-switch", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const ip = req.ip || "unknown";

    await prisma.remoteBridgeSession.updateMany({
      where: { userId },
      data: { revoked: true },
    });

    await prisma.remoteBridgeDevice.deleteMany({
      where: { userId },
    });

    for (const [deviceId, client] of connectedClients) {
      if (client.userId === userId) {
        client.ws.close(1000, "Kill switch activated");
        connectedClients.delete(deviceId);
      }
    }

    await logActivity(userId, null, "kill_switch", `Kill switch activated from ${ip}`, ip);
    return res.json({ success: true, message: "All sessions revoked, all devices removed." });
  });

  // ═══ Activity Logs ═══

  app.get("/api/remote-bridge/activity", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const logs = await prisma.remoteBridgeActivityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return res.json(logs);
  });

  // ═══ Status ═══

  app.get("/api/remote-bridge/status", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const online: { deviceId: string; deviceType: string }[] = [];

    for (const [deviceId, client] of connectedClients) {
      if (client.userId === userId) {
        if (client.ws.readyState === WebSocket.OPEN) {
          online.push({ deviceId, deviceType: client.deviceType });
        } else {
          connectedClients.delete(deviceId);
        }
      }
    }

    return res.json({ online });
  });

  // ═══ QR Pairing Flow (1-min expiry, 5/hr limit) ═══

  app.post("/api/remote-bridge/pairing/create", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const ip = req.ip || "unknown";
    const pairingType = (req.body?.type === "manual") ? "manual" : "qr";

    // Rate limit check (disabled for testing)
    // if (checkPairingRateLimit(userId, pairingType)) {
    //   await logActivity(userId, null, "pairing_rate_limited", `${pairingType} pairing rate limited`, ip);
    //   return res.status(429).json({
    //     message: `Too many ${pairingType} pairing attempts. Max ${MAX_PAIRINGS_PER_HOUR} per hour.`,
    //   });
    // }

    // Generate pairing data
    const pairingId = crypto.randomUUID();
    const pairingToken = crypto.randomBytes(32).toString("hex");
    const encryptionKey = crypto.randomBytes(32).toString("base64");
    const expiryMs = pairingType === "qr" ? QR_EXPIRY_MS : MANUAL_CODE_EXPIRY_MS;
    const expiresAt = new Date(Date.now() + expiryMs);

    activePairingSessions.set(pairingId, {
      userId,
      pairingToken,
      encryptionKey,
      expiresAt,
      confirmed: false,
      phoneDeviceId: null,
      type: pairingType,
      ipAddress: ip,
    });

    recordPairingCreation(userId, pairingType);

    // Auto-cleanup after expiry + buffer
    setTimeout(() => {
      activePairingSessions.delete(pairingId);
    }, expiryMs + 5000);

    await logActivity(userId, null, "pairing_created", `${pairingType} pairing created (expires ${expiryMs / 1000}s)`, ip);

    return res.json({
      pairingId,
      pairingToken,
      encryptionKey,
      expiresAt: expiresAt.toISOString(),
      type: pairingType,
      expiresInSeconds: expiryMs / 1000,
    });
  });

  // Phone confirms pairing after scanning QR
  app.post("/api/remote-bridge/pairing/confirm", async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    try {
      const schema = z.object({
        pairingId: z.string().uuid(),
        pairingToken: z.string().min(1),
        deviceId: z.string().min(1),
        deviceName: z.string().max(50).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const { pairingId, pairingToken, deviceId, deviceName } = parsed.data;

      const session = activePairingSessions.get(pairingId);
      if (!session) {
        return res.status(404).json({ message: "Pairing session not found or expired" });
      }

      // Verify expiry
      if (new Date() > session.expiresAt) {
        activePairingSessions.delete(pairingId);
        return res.status(410).json({ message: "Pairing session expired" });
      }

      // Constant-time token comparison (prevent timing attacks)
      const tokenBuffer = Buffer.from(session.pairingToken);
      const providedBuffer = Buffer.from(pairingToken);
      if (tokenBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(tokenBuffer, providedBuffer)) {
        await logActivity(session.userId, null, "pairing_failed", `Invalid pairing token from ${ip}`, ip);
        return res.status(403).json({ message: "Invalid pairing token" });
      }

      // Already confirmed? (prevent replay)
      if (session.confirmed) {
        return res.status(409).json({ message: "Pairing already confirmed" });
      }

      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Register/update the phone device
      await prisma.remoteBridgeDevice.upsert({
        where: { userId_deviceId: { userId: user.id, deviceId } },
        create: {
          userId: user.id,
          deviceId,
          deviceType: "phone",
          deviceName: deviceName || null,
          trusted: true,
          lastSeen: new Date(),
          encryptionKey: session.encryptionKey,
          ipAddress: ip,
          userAgent,
          pairedVia: session.type,
        } as any,
        update: {
          lastSeen: new Date(),
          trusted: true,
          encryptionKey: session.encryptionKey,
          ipAddress: ip,
          userAgent,
          pairedVia: session.type,
        } as any,
      });

      // Mark session as confirmed & invalidate immediately
      session.confirmed = true;
      session.phoneDeviceId = deviceId;

      // Remove from active sessions (single-use)
      setTimeout(() => activePairingSessions.delete(pairingId), 10_000);

      // Issue JWT tokens for the phone
      const accessToken = createAccessToken({ sub: user.id, email: user.email });
      const refreshToken = createRefreshToken({ sub: user.id, email: user.email });

      await logActivity(user.id, deviceId, "pairing_confirmed", `${session.type} pairing confirmed from ${ip}`, ip);

      return res.json({
        accessToken,
        refreshToken,
        userId: user.id,
        encryptionKey: session.encryptionKey,
        serverUrl: req.protocol + "://" + req.get("host"),
      });
    } catch (error) {
      logger.error({ error }, "Pairing confirm error");
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ═══ Register Tablet Device (called by website after QR pairing confirms) ═══

  app.post("/api/remote-bridge/devices/register", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const ip = req.ip || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    const schema = z.object({
      deviceId: z.string().min(1),
      deviceType: z.enum(["phone", "tablet"]).default("tablet"),
      deviceName: z.string().max(50).optional(),
      encryptionKey: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const { deviceId, deviceType, deviceName, encryptionKey } = parsed.data;

    if (deviceType === "tablet") {
      const existingDevice = await prisma.remoteBridgeDevice.findUnique({
        where: { userId_deviceId: { userId, deviceId } },
      });
      const tabletCount = await getLinkedTabletCount(userId);

      if (!existingDevice && tabletCount >= MAX_DEVICES_PER_USER) {
        return res.status(403).json({
          message: `Maximum ${MAX_DEVICES_PER_USER} linked web devices allowed. Remove one in AuraRing first.`,
          currentCount: tabletCount,
          maxAllowed: MAX_DEVICES_PER_USER,
        });
      }
    }

    await prisma.remoteBridgeDevice.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      create: {
        userId,
        deviceId,
        deviceType: deviceType || "tablet",
        deviceName: deviceName || null,
        trusted: true,
        lastSeen: new Date(),
        encryptionKey: encryptionKey || null,
        ipAddress: ip,
        userAgent,
        pairedVia: "qr",
      } as any,
      update: {
        lastSeen: new Date(),
        trusted: true,
        ipAddress: ip,
        userAgent,
        ...(encryptionKey ? { encryptionKey } : {}),
        ...(deviceName ? { deviceName } : {}),
      } as any,
    });

    await logActivity(userId, deviceId, "device_registered", `${deviceType} device registered from ${ip}`, ip);
    return res.json({ success: true });
  });

  // Website polls for pairing status
  app.get("/api/remote-bridge/pairing/:id/status", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const { id: pairingId } = req.params;

    const session = activePairingSessions.get(pairingId);
    if (!session || session.userId !== userId) {
      return res.json({ status: "expired" });
    }

    if (new Date() > session.expiresAt) {
      activePairingSessions.delete(pairingId);
      return res.json({ status: "expired" });
    }

    return res.json({
      status: session.confirmed ? "confirmed" : "pending",
      phoneDeviceId: session.phoneDeviceId,
    });
  });

  // ═══ Linked Device Summary (for phone notification worker) ═══

  app.get("/api/remote-bridge/linked-summary", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;

    const devices = await prisma.remoteBridgeDevice.findMany({
      where: { userId, deviceType: "tablet" },
      orderBy: { createdAt: "desc" },
    });

    // Check which are currently online — verify WebSocket is actually OPEN
    const onlineDeviceIds = new Set<string>();
    for (const [deviceId, client] of connectedClients) {
      if (client.userId === userId) {
        if (client.ws.readyState === WebSocket.OPEN) {
          onlineDeviceIds.add(deviceId);
        } else {
          // Prune stale entry
          connectedClients.delete(deviceId);
          logger.info({ deviceId }, "Pruned stale client from connectedClients during linked-summary");
        }
      }
    }

    const enriched = devices.map(d => ({
      ...d,
      isOnline: onlineDeviceIds.has(d.deviceId),
    }));

    // Count devices reachable via push notifications (even when WebSocket is not active)
    const pushReachableCount = devices.filter(
      (d: any) => d.deviceType === "tablet" && d.pushEnabled && d.pushAllowed && d.pushSubscription
    ).length;

    return res.json({
      devices: enriched,
      count: devices.length,
      maxAllowed: MAX_DEVICES_PER_USER,
      pushReachableCount,
    });
  });

  // ═══ HTTP Fallback: Call Signal (phone → push notification, no WebSocket needed) ═══

  app.post("/api/remote-bridge/call-signal", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const { callerName, callState, deviceId, callSignalId } = req.body || {};

    if (callState !== "RINGING") {
      return res.json({ sent: false, reason: "Only RINGING triggers push" });
    }

    const name = callerName || "Unknown";
    const dedupe = shouldSendIncomingCallPush({
      userId,
      deviceId,
      callerName: name,
      callSignalId,
    });
    if (!dedupe.send) {
      logger.info({ userId, callerName: name, via: "http-fallback", key: dedupe.key }, "Duplicate incoming call push suppressed");
      diagLog(userId, "server", "CALL_SIGNAL_DEDUPED", `caller=${name} via=HTTP_FALLBACK key=${dedupe.key}`);
      return res.json({ sent: false, deduped: true });
    }

    await sendPushNotification(userId, {
      title: "📞 Incoming Call",
      body: `${name} is calling...`,
      tag: "incoming-call",
      url: "/remote-bridge",
      requireInteraction: true,
    });

    logger.info({ userId, callerName: name, via: "http-fallback" }, "Push notification triggered via HTTP fallback");
    diagLog(userId, "server", "CALL_SIGNAL_PUSH", `caller=${name} via=HTTP_FALLBACK`);
    return res.json({ sent: true });
  });

  // ═══ FCM Token Registration (phone registers its FCM token) ═══

  app.post("/api/remote-bridge/fcm-token", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const { fcmToken, deviceId } = req.body || {};

    if (!fcmToken || !deviceId) {
      return res.status(400).json({ message: "fcmToken and deviceId required" });
    }

    try {
      await prisma.remoteBridgeDevice.updateMany({
        where: { userId, deviceId },
        data: { fcmToken },
      });

      logger.info({ userId, deviceId }, "FCM token registered");
      return res.json({ success: true });
    } catch (error) {
      logger.error({ error }, "Failed to register FCM token");
      return res.status(500).json({ message: "Failed to register FCM token" });
    }
  });

  // ═══ Wake Bridge (website tells server to wake up the phone via FCM) ═══

  app.post("/api/remote-bridge/wake-phone", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;

    const sent = await sendFcmToPhone(userId, {
      action: "WAKE_BRIDGE",
    });
    diagLog(userId, "server", "WAKE_PHONE_FCM", `sent=${sent}`);

    return res.json({ sent });
  });

  // ═══ Diagnostics — Test write (verify DB path works) ═══

  app.post("/api/remote-bridge/diagnostics/test", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    try {
      await prisma.remoteBridgeDiagLog.create({
        data: {
          userId,
          source: "server",
          event: "DIAG_TEST_PING",
          details: `Manual test at ${new Date().toISOString()}`,
        },
      });
      const count = await prisma.remoteBridgeDiagLog.count({ where: { userId } });
      return res.json({ success: true, totalLogs: count });
    } catch (error: any) {
      logger.error({ error }, "Diag test write failed");
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // ═══ Diagnostics — View bridge event logs ═══

  app.get("/api/remote-bridge/diagnostics", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;

    // Optional time filter: ?since=2024-01-01T00:00:00Z
    const sinceParam = req.query.since as string | undefined;
    const where: any = { userId };
    if (sinceParam) {
      const sinceDate = new Date(sinceParam);
      if (!isNaN(sinceDate.getTime())) {
        where.createdAt = { gte: sinceDate };
      }
    }

    try {
      const logs = await prisma.remoteBridgeDiagLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: { id: true, source: true, event: true, details: true, createdAt: true },
      });

      return res.json({ logs });
    } catch (error: any) {
      logger.error({ error }, "Failed to read diagnostic logs");
      return res.status(503).json({ logs: [], error: "Database temporarily unavailable" });
    }
  });

  // ═══ Diagnostics — Phone pushes its events to server ═══

  app.post("/api/remote-bridge/diag", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const { events } = req.body || {};

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ message: "events array required" });
    }

    // Batch insert (max 50 per request to prevent abuse)
    const toInsert = events.slice(0, 50).map((e: any) => ({
      userId,
      source: "phone" as const,
      event: String(e.event || "UNKNOWN"),
      details: e.details ? String(e.details).slice(0, 500) : null,
    }));

    try {
      await prisma.remoteBridgeDiagLog.createMany({ data: toInsert });
      return res.json({ inserted: toInsert.length });
    } catch (error: any) {
      logger.error({ error }, "Diag batch insert failed (DB unreachable?)");
      return res.status(503).json({ inserted: 0, error: "Database temporarily unavailable" });
    }
  });

  // ═══ Diagnostics — Clear logs ═══

  app.delete("/api/remote-bridge/diagnostics", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    try {
      await prisma.remoteBridgeDiagLog.deleteMany({ where: { userId } });
      return res.json({ cleared: true });
    } catch (error: any) {
      logger.error({ error }, "Failed to clear diagnostic logs");
      return res.status(503).json({ cleared: false, error: "Database temporarily unavailable" });
    }
  });

  app.get("/api/remote-bridge/phone-status", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;

    let phoneOnline = false;
    for (const [deviceId, client] of connectedClients) {
      if (client.userId === userId && client.deviceType === "phone") {
        if (client.ws.readyState === WebSocket.OPEN) {
          phoneOnline = true;
          break;
        } else {
          // Prune stale entry
          connectedClients.delete(deviceId);
          logger.info({ deviceId }, "Pruned stale phone client during phone-status check");
        }
      }
    }

    return res.json({ phoneOnline });
  });

  // ═══ Push Notification Endpoints ═══

  // Get VAPID public key (needed by the browser to subscribe)
  app.get("/api/remote-bridge/push/vapid-key", requireAuth, (_req, res) => {
    if (!env.VAPID_PUBLIC_KEY) {
      return res.status(503).json({ message: "Push notifications not configured" });
    }
    return res.json({ vapidPublicKey: env.VAPID_PUBLIC_KEY });
  });

  // Subscribe to push notifications (tablet/browser sends its subscription)
  app.post("/api/remote-bridge/push/subscribe", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const ip = req.ip || "unknown";

    const schema = z.object({
      subscription: z.object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
      }),
      deviceId: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid subscription" });
    }

    const subJson = JSON.stringify(parsed.data.subscription);

    // Find or update the tablet device for this user
    const deviceId = parsed.data.deviceId;
    if (deviceId) {
      const result = await prisma.remoteBridgeDevice.updateMany({
        where: { userId, deviceId, deviceType: "tablet" },
        data: { pushSubscription: subJson, pushEnabled: true },
      });
      if (result.count === 0) {
        return res.status(404).json({ message: "Tablet device not registered. Pair this browser again." });
      }
    } else {
      // Legacy clients did not send a deviceId. Keep them working, but new clients are scoped.
      await prisma.remoteBridgeDevice.updateMany({
        where: { userId, deviceType: "tablet" },
        data: { pushSubscription: subJson, pushEnabled: true },
      });
    }

    // Check phone-side permission as stored on tablet devices.
    const tablet = await prisma.remoteBridgeDevice.findFirst({
      where: {
        userId,
        deviceType: "tablet",
        ...(deviceId ? { deviceId } : {}),
      },
    });

    await logActivity(userId, null, "push_subscribed", `Push subscription registered from ${ip}`, ip);
    return res.json({ success: true, tabletToggle: true, phoneToggle: tablet?.pushAllowed ?? false });
  });

  // Unsubscribe from push
  app.post("/api/remote-bridge/push/unsubscribe", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const ip = req.ip || "unknown";

    const schema = z.object({
      deviceId: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input" });
    }

    await prisma.remoteBridgeDevice.updateMany({
      where: {
        userId,
        deviceType: "tablet",
        ...(parsed.data.deviceId ? { deviceId: parsed.data.deviceId } : {}),
      },
      data: { pushSubscription: null, pushEnabled: false },
    });

    await logActivity(userId, null, "push_unsubscribed", `Push subscription removed from ${ip}`, ip);
    return res.json({ success: true });
  });

  // Toggle background notifications (from either device)
  app.post("/api/remote-bridge/push/toggle", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const ip = req.ip || "unknown";

    const schema = z.object({
      device: z.enum(["phone", "tablet"]),
      enabled: z.boolean(),
      deviceId: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input" });
    }

    if (parsed.data.device === "phone") {
      // Phone controls pushAllowed on all tablet devices
      await prisma.remoteBridgeDevice.updateMany({
        where: { userId, deviceType: "tablet" },
        data: { pushAllowed: parsed.data.enabled },
      });
    } else {
      // Tablet controls its own pushEnabled. New web clients send deviceId so one
      // browser cannot accidentally toggle every linked tablet/browser.
      await prisma.remoteBridgeDevice.updateMany({
        where: {
          userId,
          deviceType: "tablet",
          ...(parsed.data.deviceId ? { deviceId: parsed.data.deviceId } : {}),
        },
        data: {
          pushEnabled: parsed.data.enabled,
          ...(parsed.data.enabled ? {} : { pushSubscription: null }),
        },
      });
    }

    await logActivity(
      userId, null, "push_toggle",
      `${parsed.data.device} toggle set to ${parsed.data.enabled} from ${ip}`,
      ip
    );

    // Get current state for response
    const tablet = await prisma.remoteBridgeDevice.findFirst({
      where: { userId, deviceType: "tablet" },
    });

    const tabletToggle = tablet?.pushEnabled ?? false;
    const phoneToggle = tablet?.pushAllowed ?? false;

    // Broadcast toggle change to all connected devices of this user
    broadcastToUser(userId, "", {
      type: "PUSH_TOGGLE_UPDATE",
      phoneToggle,
      tabletToggle,
    });

    return res.json({
      success: true,
      phoneToggle,
      tabletToggle,
    });
  });

  // Get push toggle status (live status for both devices)
  app.get("/api/remote-bridge/push/status", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId : undefined;

    const tablets = await prisma.remoteBridgeDevice.findMany({
      where: {
        userId,
        deviceType: "tablet",
        ...(deviceId ? { deviceId } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    const tablet = tablets[0];
    const phoneToggle = deviceId
      ? tablet?.pushAllowed ?? false
      : tablets.some((d: any) => d.pushAllowed);
    const tabletToggle = deviceId
      ? tablet?.pushEnabled ?? false
      : tablets.some((d: any) => d.pushEnabled);
    const hasSubscription = deviceId
      ? !!tablet?.pushSubscription
      : tablets.some((d: any) => !!d.pushSubscription);

    return res.json({
      phoneToggle,
      tabletToggle,
      hasSubscription,
      pushConfigured: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
    });
  });
}

// ─── WebSocket Server ───

export function setupRemoteBridgeWebSocket(server: http.Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);

    if (url.pathname === "/ws/phone" || url.pathname === "/ws/tablet") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request, url.pathname);
      });
    }
  });

  wss.on("connection", (ws: WebSocket, request: any, path: string) => {
    const ip = request.socket.remoteAddress || "unknown";
    const expectedDeviceType = path === "/ws/tablet" ? "tablet" : "phone";
    let authenticated = false;
    let clientInfo: { userId: string; deviceId: string; deviceType: string } | null = null;

    // Auth timeout — must authenticate within 10 seconds
    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        ws.close(4001, "Authentication timeout");
      }
    }, 10_000);

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (!authenticated) {
          if (message.type === "AUTH") {
            const result = await authenticateWebSocket(
              { ...message, deviceType: expectedDeviceType },
              ip
            );
            if (result.success && result.userId && result.deviceId) {
              authenticated = true;
              clearTimeout(authTimeout);
              clientInfo = {
                userId: result.userId,
                deviceId: result.deviceId,
                deviceType: expectedDeviceType,
              };
              const deviceName = result.deviceName || null;

              // Close any existing connection for this device to prevent ghost sockets
              const existing = connectedClients.get(result.deviceId);
              if (existing && existing.ws !== ws && existing.ws.readyState === WebSocket.OPEN) {
                logger.info({ deviceId: result.deviceId }, "Closing stale WS for re-authenticating device");
                try { existing.ws.close(4000, "Replaced by new connection"); } catch {}
              }

              connectedClients.set(result.deviceId, {
                ws,
                userId: result.userId,
                deviceId: result.deviceId,
                deviceType: clientInfo.deviceType as "phone" | "tablet",
                lastPing: Date.now(),
              });

              ws.send(JSON.stringify({ type: "AUTH_OK", deviceId: result.deviceId, deviceName }));

              logger.info(
                { deviceId: result.deviceId, deviceType: clientInfo.deviceType, deviceName },
                "Remote bridge client connected"
              );
              diagLog(result.userId, "server", "WS_CONNECTED", `${clientInfo.deviceType} ${result.deviceId} name=${deviceName}`);

              // Tell the new client about all already-connected peers
              for (const [peerId, peer] of connectedClients) {
                if (peer.userId === result.userId && peerId !== result.deviceId) {
                  ws.send(JSON.stringify({
                    type: "DEVICE_CONNECTED",
                    deviceId: peerId,
                    deviceType: peer.deviceType,
                  }));
                }
              }

              broadcastToUser(result.userId, result.deviceId, {
                type: "DEVICE_CONNECTED",
                deviceId: result.deviceId,
                deviceType: clientInfo.deviceType,
                deviceName,
                ready: true,
              });
            } else {
              ws.send(
                JSON.stringify({ type: "AUTH_FAIL", reason: result.error || "Invalid credentials" })
              );
              diagLog("", "server", "WS_AUTH_FAIL", `type=${expectedDeviceType} error=${result.error}`);
              ws.close(4003, "Authentication failed");
            }
          } else {
            ws.close(4002, "Must authenticate first");
          }
          return;
        }

        if (!clientInfo) return;

        switch (message.type) {
          case "PING":
            ws.send(JSON.stringify({ type: "PONG", ts: Date.now() }));
            const client = connectedClients.get(clientInfo.deviceId);
            if (client) client.lastPing = Date.now();
            break;

          case "EVENT":
            if (clientInfo.deviceType === "phone") {
              forwardToDeviceType(clientInfo.userId, clientInfo.deviceId, "tablet", message);
              // Extract call state from encrypted envelope for diagnostic visibility
              diagLog(clientInfo.userId, "server", "EVENT_FORWARDED", `from=phone to=tablet`);
            }
            break;

          case "CALL_SIGNAL":
            // Unencrypted signal from phone for push notifications (RINGING only)
            if (clientInfo.deviceType === "phone" && message.callState === "RINGING") {
              const callerName = message.callerName || "Unknown";
              const dedupe = shouldSendIncomingCallPush({
                userId: clientInfo.userId,
                deviceId: message.deviceId || clientInfo.deviceId,
                callerName,
                callSignalId: message.callSignalId,
              });
              if (!dedupe.send) {
                logger.info({ userId: clientInfo.userId, callerName, key: dedupe.key }, "Duplicate incoming call push suppressed");
                diagLog(clientInfo.userId, "server", "CALL_SIGNAL_DEDUPED", `caller=${callerName} via=WS key=${dedupe.key}`);
                break;
              }
              sendPushNotification(clientInfo.userId, {
                title: "📞 Incoming Call",
                body: `${callerName} is calling...`,
                tag: "incoming-call",
                url: "/remote-bridge",
                requireInteraction: true,
              });
              logger.info({ userId: clientInfo.userId, callerName }, "Push notification triggered for incoming call");
              diagLog(clientInfo.userId, "server", "CALL_SIGNAL_PUSH", `caller=${callerName} via=WS`);
            }
            break;

          case "COMMAND":
            if (clientInfo.deviceType === "tablet") {
              forwardToDeviceType(clientInfo.userId, clientInfo.deviceId, "phone", message);
              await logActivity(
                clientInfo.userId,
                clientInfo.deviceId,
                "command",
                `Command forwarded from tablet`,
                ip
              );
            }
            break;

          case "ACK":
            forwardToDeviceType(
              clientInfo.userId,
              clientInfo.deviceId,
              clientInfo.deviceType === "phone" ? "tablet" : "phone",
              message
            );
            break;

          default:
            logger.debug({ type: message.type }, "Unknown WS message type");
        }
      } catch (error) {
        logger.error({ error }, "WebSocket message handling error");
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimeout);
      if (clientInfo) {
        // Only evict if this WS is still the active socket for the device.
        // If the device has already re-authenticated on a new socket, the map
        // will hold that new socket — deleting it here would incorrectly mark
        // the device offline even though the new connection is healthy.
        const current = connectedClients.get(clientInfo.deviceId);
        if (current && current.ws === ws) {
          connectedClients.delete(clientInfo.deviceId);
          broadcastToUser(clientInfo.userId, clientInfo.deviceId, {
            type: "DEVICE_DISCONNECTED",
            deviceId: clientInfo.deviceId,
            deviceType: clientInfo.deviceType,
          });
          logger.info({ deviceId: clientInfo.deviceId }, "Remote bridge client disconnected");
          diagLog(clientInfo.userId, "server", "WS_DISCONNECTED", `${clientInfo.deviceType} ${clientInfo.deviceId}`);
        } else {
          // Stale socket close — a newer socket has already taken over; ignore.
          logger.info({ deviceId: clientInfo.deviceId }, "Stale WS close ignored — device already re-authenticated on new socket");
          diagLog(clientInfo.userId, "server", "WS_STALE_CLOSE_IGNORED", `${clientInfo.deviceType} ${clientInfo.deviceId}`);
        }
      }
    });

    ws.on("error", (error) => {
      logger.error({ error }, "WebSocket error");
    });
  });

  // Stale connection cleanup (3 minutes tolerance to survive phone screen-off)
  setInterval(() => {
    const now = Date.now();
    for (const [deviceId, client] of connectedClients) {
      if (now - client.lastPing > 180_000) {
        logger.info({ deviceId }, "Closing stale WebSocket connection");
        client.ws.close(1001, "Stale connection");
        connectedClients.delete(deviceId);
      }
    }
  }, 60_000);
}

// ─── WebSocket Auth ───

async function authenticateWebSocket(
  message: any,
  ip: string
): Promise<{ success: boolean; userId?: string; deviceId?: string; deviceName?: string; error?: string }> {
  try {
    const { token, deviceId, deviceType, deviceName } = message;
    if (!token || !deviceId) {
      return { success: false, error: "Missing token or deviceId" };
    }

    let userId: string;

    if (typeof token === "string" && token.startsWith("personal_master_token_")) {
      const devId = token.replace("personal_master_token_", "");
      const device = await prisma.remoteBridgeDevice.findFirst({
        where: { deviceId: devId, trusted: true },
      });
      if (!device) {
        return { success: false, error: "Personal master device not recognized" };
      }
      userId = device.userId;
    } else {
      const payload = verifyAccessToken(token);
      userId = payload.sub;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Resolve device name
    const resolvedName = (typeof deviceName === "string" && deviceName.trim()) ? deviceName.trim() : null;
    const resolvedType = deviceType || "phone";

    const device = await prisma.remoteBridgeDevice.findUnique({
      where: { userId_deviceId: { userId, deviceId } },
    });

    if (!device) {
      return { success: false, error: "Device not registered. Pair this device again." };
    }

    if (device.deviceType !== resolvedType) {
      return { success: false, error: "Device type mismatch. Pair this device again." };
    }

    if (!device.trusted) {
      return { success: false, error: "Device is not trusted" };
    }

    await prisma.remoteBridgeDevice.update({
      where: { id: device.id },
      data: {
        lastSeen: new Date(),
        ipAddress: ip,
        ...(resolvedName ? { deviceName: resolvedName } : {}),
      } as any,
    });

    await logActivity(userId, deviceId, "ws_connected", `WebSocket connected from ${ip}`, ip);
    return { success: true, userId, deviceId, deviceName: resolvedName || device.deviceName || undefined };
  } catch (error) {
    logger.error({ error }, "WebSocket auth error");
    return { success: false, error: "Invalid token" };
  }
}

// ─── Message Forwarding ───

function forwardToDeviceType(userId: string, fromDeviceId: string, targetType: string, message: any): void {
  for (const [deviceId, client] of connectedClients) {
    if (client.userId === userId && client.deviceType === targetType && deviceId !== fromDeviceId) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error({ error, deviceId }, "Failed to forward message");
      }
    }
  }
}

function broadcastToUser(userId: string, excludeDeviceId: string, message: any): void {
  for (const [deviceId, client] of connectedClients) {
    if (client.userId === userId && deviceId !== excludeDeviceId) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error({ error, deviceId }, "Failed to broadcast message");
      }
    }
  }
}

// ─── Auth Middleware ───

function requireAuth(req: any, res: any, next: any): void {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// ─── Helpers ───

async function logActivity(
  userId: string | null,
  deviceId: string | null,
  action: string,
  details: string | null,
  ipAddress: string
): Promise<void> {
  try {
    if (userId) {
      await prisma.remoteBridgeActivityLog.create({
        data: { userId, deviceId, action, details, ipAddress },
      });
    }
  } catch (error) {
    logger.error({ error }, "Failed to log activity");
  }
}

async function logAttempt(ipAddress: string, email: string | null, success: boolean): Promise<void> {
  try {
    await prisma.remoteBridgeLoginAttempt.create({
      data: { ipAddress, email, success },
    });
  } catch (error) {
    logger.error({ error }, "Failed to log login attempt");
  }
}
