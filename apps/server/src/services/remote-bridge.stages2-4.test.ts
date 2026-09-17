import express from "express";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "");
  return {
    env: { PUBLIC_BRIDGE_BASE_URL: "https://bridge.example.invalid" },
    prisma: {
      user: { findUnique: vi.fn(), findFirst: vi.fn() },
      remoteBridgeDevice: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      remoteBridgeSession: { updateMany: vi.fn() },
      remoteBridgeActivityLog: { create: vi.fn() },
    },
    createAccessToken: vi.fn(),
    createRefreshToken: vi.fn(),
    verifyRefreshToken: vi.fn(),
    webpush: { sendNotification: vi.fn() },
  };
});

vi.mock("../env", () => ({ env: mocks.env }));
vi.mock("dotenv", () => ({ config: vi.fn() }));
vi.mock("../prisma", () => ({ prisma: mocks.prisma }));
vi.mock("../auth/tokens", () => ({
  createAccessToken: mocks.createAccessToken,
  createRefreshToken: mocks.createRefreshToken,
  verifyAccessToken: vi.fn(),
  verifyRefreshToken: mocks.verifyRefreshToken,
}));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("firebase-admin", () => ({
  default: { apps: [], initializeApp: vi.fn(), credential: { cert: vi.fn() } },
}));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: mocks.webpush.sendNotification,
  },
}));
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(),
  },
}));

afterAll(() => vi.unstubAllEnvs());

describe("Stages 2-4 Remote Bridge Server Contract", () => {
  let app: express.Express;
  let authenticatedUser: { id: string; email?: string } | null = null;

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();

    mocks.createAccessToken.mockReturnValue("mock-access-token");
    mocks.createRefreshToken.mockReturnValue("mock-refresh-token");
    mocks.prisma.remoteBridgeDevice.upsert.mockResolvedValue({});
    mocks.prisma.remoteBridgeDevice.deleteMany.mockResolvedValue({ count: 1 });
    mocks.prisma.remoteBridgeSession.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.remoteBridgeActivityLog.create.mockResolvedValue({});
    mocks.webpush.sendNotification.mockResolvedValue({});

    authenticatedUser = { id: "user-123", email: "user@example.invalid" };

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      if (authenticatedUser) (req as any).user = authenticatedUser;
      next();
    });

    const { setupRemoteBridgeRoutes } = await import("./remote-bridge");
    setupRemoteBridgeRoutes(app);
  });

  describe("Stage 2: Token Refresh Endpoint (/api/remote-bridge/refresh)", () => {
    it("rejects request without refreshToken", async () => {
      const res = await request(app)
        .post("/api/remote-bridge/refresh")
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/refreshToken is required/i);
    });

    it("rejects invalid or expired refresh token", async () => {
      mocks.verifyRefreshToken.mockImplementation(() => {
        throw new Error("jwt expired");
      });
      const res = await request(app)
        .post("/api/remote-bridge/refresh")
        .send({ refreshToken: "expired.or.invalid.token" });
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid or expired/i);
    });

    it("rejects valid token if user is not in database", async () => {
      mocks.verifyRefreshToken.mockReturnValue({ sub: "unknown-user" });
      mocks.prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post("/api/remote-bridge/refresh")
        .send({ refreshToken: "valid.token.unknown.user" });
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid or expired/i);
    });

    it("successfully issues new tokens for valid user", async () => {
      mocks.verifyRefreshToken.mockReturnValue({ sub: "user-123" });
      mocks.prisma.user.findUnique.mockResolvedValue({ id: "user-123", email: "test@example.com" });
      mocks.createAccessToken.mockReturnValue("new-access-token");
      mocks.createRefreshToken.mockReturnValue("new-refresh-token");

      const res = await request(app)
        .post("/api/remote-bridge/refresh")
        .send({ refreshToken: "valid.refresh.token" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      });
    });
  });

  describe("Stage 2: Personal Register & Link (No 878955 Bypass)", () => {
    it("rejects phone registration with short PIN (< 6 characters)", async () => {
      const res = await request(app)
        .post("/api/remote-bridge/personal-register")
        .send({
          pin: "123",
          deviceId: "phone-1",
          encryptionKey: "dGVzdC1rZXk=",
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at least 6 digits/i);
    });

    it("registers phone with a valid user-configured 6-digit PIN", async () => {
      mocks.prisma.user.findFirst.mockResolvedValue({ id: "user-123", name: "Suraj", email: "suraj@example.com" });

      const res = await request(app)
        .post("/api/remote-bridge/personal-register")
        .send({
          pin: "948271",
          deviceId: "phone-1",
          encryptionKey: "dGVzdC1rZXk=",
          deviceName: "Pixel 9",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe("948271");
      expect(res.body.userId).toBe("user-123");
    });

    it("rejects tablet personal-link using old 878955 when no active session exists", async () => {
      const res = await request(app)
        .post("/api/remote-bridge/personal-link")
        .send({
          code: "878955",
        });
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid or expired/i);
    });

    it("links tablet using the active PIN after phone registration", async () => {
      mocks.prisma.user.findFirst.mockResolvedValue({ id: "user-123", name: "Suraj", email: "suraj@example.com" });
      mocks.prisma.user.findUnique.mockResolvedValue({ id: "user-123", name: "Suraj", email: "suraj@example.com" });

      // First register phone with custom PIN
      await request(app)
        .post("/api/remote-bridge/personal-register")
        .send({
          pin: "654321",
          deviceId: "phone-1",
          encryptionKey: "dGVzdC1rZXk=",
        });

      // Now link tablet with that same PIN
      const linkRes = await request(app)
        .post("/api/remote-bridge/personal-link")
        .send({
          code: "654321",
          tabletDeviceId: "tablet-1",
        });

      expect(linkRes.status).toBe(200);
      expect(linkRes.body.success).toBe(true);
      expect(linkRes.body.encryptionKey).toBe("dGVzdC1rZXk=");
      expect(linkRes.body.deviceId).toBe("tablet-1");
    });
  });

  describe("Stage 3: Cascade Revocation (/api/remote-bridge/devices/revoke-all)", () => {
    it("requires authentication", async () => {
      authenticatedUser = null;
      const res = await request(app)
        .post("/api/remote-bridge/devices/revoke-all")
        .send({});
      expect(res.status).toBe(401);
    });

    it("deletes all devices for the user and returns success", async () => {
      const res = await request(app)
        .post("/api/remote-bridge/devices/revoke-all")
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mocks.prisma.remoteBridgeDevice.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-123" },
      });
    });
  });

  describe("Stage 4: Call Signal HTTP Fallback (/api/remote-bridge/call-signal)", () => {
    it("requires authentication", async () => {
      authenticatedUser = null;
      const res = await request(app)
        .post("/api/remote-bridge/call-signal")
        .send({ callState: "RINGING" });
      expect(res.status).toBe(401);
    });

    it("ignores non-RINGING states", async () => {
      const res = await request(app)
        .post("/api/remote-bridge/call-signal")
        .send({ callState: "ACTIVE" });
      expect(res.status).toBe(200);
      expect(res.body.sent).toBe(false);
    });

    it("accepts notification hint and sends push notification", async () => {
      mocks.prisma.remoteBridgeDevice.findMany.mockResolvedValue([
        {
          deviceType: "tablet",
          pushEnabled: true,
          pushAllowed: true,
          pushSubscription: JSON.stringify({ endpoint: "https://push.example" }),
        },
      ]);

      const res = await request(app)
        .post("/api/remote-bridge/call-signal")
        .send({
          callState: "RINGING",
          hint: "Incoming call from Alice",
          callSignalId: "unique-call-id-1",
          deviceId: "phone-1",
        });

      expect(res.status).toBe(200);
      expect(res.body.sent).toBe(true);
    });

    it("deduplicates identical call signals within dedupe window", async () => {
      mocks.prisma.remoteBridgeDevice.findMany.mockResolvedValue([]);

      const payload = {
        callState: "RINGING",
        hint: "Incoming call from Bob",
        callSignalId: "unique-call-id-2",
        deviceId: "phone-1",
      };

      const first = await request(app).post("/api/remote-bridge/call-signal").send(payload);
      expect(first.body.sent).toBe(true);

      const second = await request(app).post("/api/remote-bridge/call-signal").send(payload);
      expect(second.body.sent).toBe(false);
      expect(second.body.deduped).toBe(true);
    });
  });
});
