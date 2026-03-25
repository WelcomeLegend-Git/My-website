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

// ─── Types ───

interface AuthenticatedSocket {
  ws: WebSocket;
  userId: string;
  deviceId: string;
  deviceType: "phone" | "tablet";
  lastPing: number;
}

// ─── Connected Clients ───

const connectedClients = new Map<string, AuthenticatedSocket>(); // deviceId → socket

// ─── Rate Limiting ───

const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

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
  // Login endpoint for phone/tablet
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

  // Device management
  app.get("/api/remote-bridge/devices", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const devices = await prisma.remoteBridgeDevice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return res.json(devices);
  });

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

  // Kill switch — revoke everything
  app.post("/api/remote-bridge/kill-switch", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const ip = req.ip || "unknown";

    // Revoke all sessions
    await prisma.remoteBridgeSession.updateMany({
      where: { userId },
      data: { revoked: true },
    });

    // Remove all devices
    await prisma.remoteBridgeDevice.deleteMany({
      where: { userId },
    });

    // Disconnect all online clients
    for (const [deviceId, client] of connectedClients) {
      if (client.userId === userId) {
        client.ws.close(1000, "Kill switch activated");
        connectedClients.delete(deviceId);
      }
    }

    await logActivity(userId, null, "kill_switch", `Kill switch activated from ${ip}`, ip);
    return res.json({ success: true, message: "All sessions revoked, all devices removed." });
  });

  // Activity logs
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

  // Status — which devices are connected right now
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
}

// ─── WebSocket Server ───

export function setupRemoteBridgeWebSocket(server: http.Server): void {
  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade requests
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);

    // Only handle /ws/phone and /ws/tablet paths
    if (url.pathname === "/ws/phone" || url.pathname === "/ws/tablet") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request, url.pathname);
      });
    }
    // Don't destroy socket for non-bridge paths — let other handlers deal with it
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
          // First message must be AUTH
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

              // Register client
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

              // Notify other devices of this user about new connection
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

        // Authenticated — handle messages
        if (!clientInfo) return;

        switch (message.type) {
          case "PING":
            ws.send(JSON.stringify({ type: "PONG", ts: Date.now() }));
            const client = connectedClients.get(clientInfo.deviceId);
            if (client) client.lastPing = Date.now();
            break;

          case "EVENT":
            // Phone sends call events → forward to all tablets
            if (clientInfo.deviceType === "phone") {
              forwardToDeviceType(clientInfo.userId, clientInfo.deviceId, "tablet", message);
            }
            break;

          case "COMMAND":
            // Tablet sends commands → forward to phone
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
            // Forward ACKs to the other side
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
        // Notify other devices
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

  // Ping check — close stale connections every 60 seconds
  setInterval(() => {
    const now = Date.now();
    for (const [deviceId, client] of connectedClients) {
      if (now - client.lastPing > 90_000) {
        // No ping for 90 seconds
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

    // Verify JWT
    const payload = verifyAccessToken(token);
    const userId = payload.sub;

    // Check user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Register/update device
    await prisma.remoteBridgeDevice.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      create: {
        userId,
        deviceId,
        deviceType: deviceType || "phone",
        trusted: true, // Auto-trust for personal use
        lastSeen: new Date(),
      },
      update: {
        lastSeen: new Date(),
        deviceType: deviceType || "phone",
      },
    });

    await logActivity(userId, deviceId, "ws_connected", `WebSocket connected from ${ip}`, ip);

    return { success: true, userId, deviceId };
  } catch (error) {
    logger.error({ error }, "WebSocket auth error");
    return { success: false, error: "Invalid token" };
  }
}

// ─── Message Forwarding ───

function forwardToDeviceType(
  userId: string,
  fromDeviceId: string,
  targetType: string,
  message: any
): void {
  for (const [deviceId, client] of connectedClients) {
    if (
      client.userId === userId &&
      client.deviceType === targetType &&
      deviceId !== fromDeviceId
    ) {
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

// ─── Auth Middleware for REST ───

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

async function logAttempt(
  ipAddress: string,
  email: string | null,
  success: boolean
): Promise<void> {
  try {
    await prisma.remoteBridgeLoginAttempt.create({
      data: { ipAddress, email, success },
    });
  } catch (error) {
    logger.error({ error }, "Failed to log login attempt");
  }
}
