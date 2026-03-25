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

// ─── Constants ───

const MAX_DEVICES_PER_USER = 5;
const QR_EXPIRY_MS = 60 * 1000;        // 1 minute
const MANUAL_CODE_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes
const MAX_PAIRINGS_PER_HOUR = 5;        // 5 QR + 5 manual per hour
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// ─── Web Push Setup ───

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_EMAIL) {
  webpush.setVapidDetails(
    `mailto:${env.VAPID_EMAIL}`,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
  logger.info("Web Push (VAPID) configured");
}

// ─── Push Subscriptions & Background Toggles (in-memory, per user) ───

interface PushState {
  subscription: webpush.PushSubscription | null;
  tabletToggle: boolean;  // tablet wants background notifications
  phoneToggle: boolean;   // phone allows background notifications to tablet
}

const pushStates = new Map<string, PushState>();

function getPushState(userId: string): PushState {
  let state = pushStates.get(userId);
  if (!state) {
    state = { subscription: null, tabletToggle: false, phoneToggle: false };
    pushStates.set(userId, state);
  }
  return state;
}

async function sendPushNotification(userId: string, payload: object): Promise<void> {
  const state = getPushState(userId);
  if (!state.subscription || !state.tabletToggle || !state.phoneToggle) return;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;

  try {
    await webpush.sendNotification(state.subscription, JSON.stringify(payload));
    logger.info({ userId }, "Push notification sent");
  } catch (error: any) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription expired
      state.subscription = null;
      state.tabletToggle = false;
      logger.info({ userId }, "Push subscription expired, cleared");
    } else {
      logger.error({ error }, "Push notification failed");
    }
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
      if (!user) {
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

  // ═══ Device Management ═══

  app.get("/api/remote-bridge/devices", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const devices = await prisma.remoteBridgeDevice.findMany({
      where: { userId },
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
        online.push({ deviceId, deviceType: client.deviceType });
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

    // Device limit check
    const deviceCount = await prisma.remoteBridgeDevice.count({ where: { userId } });
    if (deviceCount >= MAX_DEVICES_PER_USER) {
      return res.status(403).json({
        message: `Maximum ${MAX_DEVICES_PER_USER} devices allowed. Remove a device first.`,
        currentCount: deviceCount,
        maxAllowed: MAX_DEVICES_PER_USER,
      });
    }

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

      // Device limit check (re-check at confirmation time)
      const deviceCount = await prisma.remoteBridgeDevice.count({ where: { userId: session.userId } });
      if (deviceCount >= MAX_DEVICES_PER_USER) {
        return res.status(403).json({ message: `Maximum ${MAX_DEVICES_PER_USER} devices reached.` });
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
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // Check which are currently online
    const onlineDeviceIds = new Set<string>();
    for (const [deviceId, client] of connectedClients) {
      if (client.userId === userId) {
        onlineDeviceIds.add(deviceId);
      }
    }

    const enriched = devices.map(d => ({
      ...d,
      isOnline: onlineDeviceIds.has(d.deviceId),
    }));

    return res.json({
      devices: enriched,
      count: devices.length,
      maxAllowed: MAX_DEVICES_PER_USER,
    });
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
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid subscription" });
    }

    const state = getPushState(userId);
    state.subscription = parsed.data.subscription as webpush.PushSubscription;
    state.tabletToggle = true;

    await logActivity(userId, null, "push_subscribed", `Push subscription registered from ${ip}`, ip);
    return res.json({ success: true, tabletToggle: true, phoneToggle: state.phoneToggle });
  });

  // Unsubscribe from push
  app.post("/api/remote-bridge/push/unsubscribe", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const ip = req.ip || "unknown";

    const state = getPushState(userId);
    state.subscription = null;
    state.tabletToggle = false;

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
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const state = getPushState(userId);
    if (parsed.data.device === "phone") {
      state.phoneToggle = parsed.data.enabled;
    } else {
      state.tabletToggle = parsed.data.enabled;
      if (!parsed.data.enabled) {
        state.subscription = null; // Also clear subscription when tablet turns off
      }
    }

    await logActivity(
      userId, null, "push_toggle",
      `${parsed.data.device} toggle set to ${parsed.data.enabled} from ${ip}`,
      ip
    );

    // Broadcast toggle change to all connected devices of this user
    broadcastToUser(userId, "", {
      type: "PUSH_TOGGLE_UPDATE",
      phoneToggle: state.phoneToggle,
      tabletToggle: state.tabletToggle,
    });

    return res.json({
      success: true,
      phoneToggle: state.phoneToggle,
      tabletToggle: state.tabletToggle,
    });
  });

  // Get push toggle status (live status for both devices)
  app.get("/api/remote-bridge/push/status", requireAuth, (req, res) => {
    const userId = (req as any).user.id;
    const state = getPushState(userId);

    return res.json({
      phoneToggle: state.phoneToggle,
      tabletToggle: state.tabletToggle,
      hasSubscription: !!state.subscription,
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
            const result = await authenticateWebSocket(message, ip);
            if (result.success && result.userId && result.deviceId) {
              authenticated = true;
              clearTimeout(authTimeout);
              clientInfo = {
                userId: result.userId,
                deviceId: result.deviceId,
                deviceType: message.deviceType || "phone",
              };

              connectedClients.set(result.deviceId, {
                ws,
                userId: result.userId,
                deviceId: result.deviceId,
                deviceType: clientInfo.deviceType as "phone" | "tablet",
                lastPing: Date.now(),
              });

              ws.send(JSON.stringify({ type: "AUTH_OK", deviceId: result.deviceId }));

              logger.info(
                { deviceId: result.deviceId, deviceType: clientInfo.deviceType },
                "Remote bridge client connected"
              );

              broadcastToUser(result.userId, result.deviceId, {
                type: "DEVICE_CONNECTED",
                deviceId: result.deviceId,
                deviceType: clientInfo.deviceType,
              });
            } else {
              ws.send(
                JSON.stringify({ type: "AUTH_FAIL", reason: result.error || "Invalid credentials" })
              );
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

              // Also send push notification for incoming calls (background iPad)
              if (message.payload?.callState === "RINGING" || message.payload?.event === "RINGING") {
                const callerName = message.payload?.callerName || message.payload?.number || "Unknown";
                sendPushNotification(clientInfo.userId, {
                  title: "📞 Incoming Call",
                  body: `${callerName} is calling...`,
                  tag: "incoming-call",
                  url: "/remote-bridge",
                  requireInteraction: true,
                });
              }
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
        connectedClients.delete(clientInfo.deviceId);
        broadcastToUser(clientInfo.userId, clientInfo.deviceId, {
          type: "DEVICE_DISCONNECTED",
          deviceId: clientInfo.deviceId,
          deviceType: clientInfo.deviceType,
        });
        logger.info({ deviceId: clientInfo.deviceId }, "Remote bridge client disconnected");
      }
    });

    ws.on("error", (error) => {
      logger.error({ error }, "WebSocket error");
    });
  });

  // Stale connection cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [deviceId, client] of connectedClients) {
      if (now - client.lastPing > 90_000) {
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
): Promise<{ success: boolean; userId?: string; deviceId?: string; error?: string }> {
  try {
    const { token, deviceId, deviceType } = message;
    if (!token || !deviceId) {
      return { success: false, error: "Missing token or deviceId" };
    }

    const payload = verifyAccessToken(token);
    const userId = payload.sub;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, error: "User not found" };
    }

    await prisma.remoteBridgeDevice.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      create: {
        userId,
        deviceId,
        deviceType: deviceType || "phone",
        trusted: true,
        lastSeen: new Date(),
        ipAddress: ip,
      } as any,
      update: {
        lastSeen: new Date(),
        deviceType: deviceType || "phone",
        ipAddress: ip,
      } as any,
    });

    await logActivity(userId, deviceId, "ws_connected", `WebSocket connected from ${ip}`, ip);
    return { success: true, userId, deviceId };
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
