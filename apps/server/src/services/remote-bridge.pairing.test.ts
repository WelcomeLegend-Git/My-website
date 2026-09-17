import express from "express";
import request from "supertest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../../packages/shared/test-fixtures/bridge-pairing.json";
import {
  buildBridgeQrPayload,
  validateBridgeEncryptionKey,
  validateBridgeServerBase,
} from "../../../../packages/shared/src/bridge-pairing";

const mocks = vi.hoisted(() => {
  // remote-bridge reads this directly at import time, independently of env.ts.
  vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "");
  return {
    env: { PUBLIC_BRIDGE_BASE_URL: undefined as string | undefined },
    prisma: {
      user: { findUnique: vi.fn() },
      remoteBridgeDevice: { findUnique: vi.fn(), count: vi.fn(), upsert: vi.fn() },
      remoteBridgeActivityLog: { create: vi.fn() },
    },
    createAccessToken: vi.fn(),
    createRefreshToken: vi.fn(),
  };
});

vi.mock("../env", () => ({ env: mocks.env }));
vi.mock("dotenv", () => ({ config: vi.fn(() => { throw new Error("Unexpected dotenv load"); }) }));
vi.mock("../prisma", () => ({ prisma: mocks.prisma }));
vi.mock("../auth/tokens", () => ({
  createAccessToken: mocks.createAccessToken,
  createRefreshToken: mocks.createRefreshToken,
  verifyAccessToken: vi.fn(),
}));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("firebase-admin", () => ({
  default: { apps: [], initializeApp: vi.fn(), credential: { cert: vi.fn() } },
}));
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => { throw new Error("Unexpected credential file read"); }),
  },
}));

afterAll(() => vi.unstubAllEnvs());

describe("shared Stage 1 pairing contract", () => {
  it("keeps the Android fixture byte-identical", async () => {
    const shared = path.resolve(__dirname, "../../../../packages/shared/test-fixtures/bridge-pairing.json");
    const android = path.resolve(__dirname, "../../../../../AuraRing/app/src/test/resources/bridge-pairing.json");
    expect(await readFile(shared)).toEqual(await readFile(android));
  });

  it.each(fixture.validServerBases)("accepts and canonicalizes %s", (base) => {
    expect(validateBridgeServerBase(base)).toBe(base.replace(/\/+$/, ""));
  });

  it.each(fixture.invalidServerBases)("rejects invalid fixture base %j", (base) => {
    expect(() => validateBridgeServerBase(base)).toThrow("Invalid bridge server URL");
  });

  it("canonicalizes scheme, hostname and default HTTPS port", () => {
    expect(validateBridgeServerBase("HTTPS://BRIDGE.EXAMPLE.INVALID:443/deployment/"))
      .toBe(fixture.serverBase);
  });

  it("builds exactly the compact QR contract", () => {
    expect(JSON.parse(buildBridgeQrPayload(`${fixture.serverBase}/`, fixture))).toEqual({
      s: fixture.serverBase,
      p: fixture.pairingId,
      t: fixture.pairingToken,
      k: fixture.encryptionKey,
    });
    expect(validateBridgeEncryptionKey(fixture.differentEncryptionKey)).toBe(fixture.differentEncryptionKey);
  });

  it.each([...fixture.invalidEncryptionKeys, null, undefined, 32])("rejects invalid key %j", (value) => {
    expect(() => validateBridgeEncryptionKey(value)).toThrow("Invalid bridge encryption key");
  });

  it("does not build a payload with an invalid base or key", () => {
    expect(() => buildBridgeQrPayload("", fixture)).toThrow("Invalid bridge server URL");
    expect(() => buildBridgeQrPayload(fixture.serverBase, { ...fixture, encryptionKey: "" }))
      .toThrow("Invalid bridge encryption key");
  });
});

describe("Stage 1 remote bridge routes", () => {
  let app: express.Express;
  let authenticated: boolean;
  let directHttps: boolean;

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mocks.env.PUBLIC_BRIDGE_BASE_URL = `${fixture.serverBase}/`;
    mocks.prisma.user.findUnique.mockResolvedValue({ id: fixture.userId, email: "fixture@example.invalid" });
    mocks.prisma.remoteBridgeDevice.findUnique.mockResolvedValue(null);
    mocks.prisma.remoteBridgeDevice.count.mockResolvedValue(0);
    mocks.prisma.remoteBridgeDevice.upsert.mockResolvedValue({});
    mocks.prisma.remoteBridgeActivityLog.create.mockResolvedValue({});
    mocks.createAccessToken.mockReturnValue(fixture.accessToken);
    mocks.createRefreshToken.mockReturnValue(fixture.refreshToken);
    authenticated = true;
    directHttps = false;
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      if (authenticated) (req as any).user = { id: fixture.userId };
      // Model direct TLS without enabling trust proxy or using forwarded headers.
      if (directHttps) Object.defineProperty(req.socket, "encrypted", { value: true, configurable: true });
      next();
    });
    const { setupRemoteBridgeRoutes } = await import("./remote-bridge");
    setupRemoteBridgeRoutes(app);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const create = () => request(app).post("/api/remote-bridge/pairing/create").send({});

  it.each(["qr", "manual"])("creates and confirms %s pairing with the fixture response contract", async (type) => {
    const created = await request(app).post("/api/remote-bridge/pairing/create").send({ type }).expect(200);
    const pairing = created.body;
    expect(pairing).toEqual({
      pairingId: expect.any(String), pairingToken: expect.any(String), encryptionKey: expect.any(String),
      code: expect.stringMatching(/^\d{6}$/), qrPayload: expect.any(String),
      expiresAt: expect.any(String), type, expiresInSeconds: fixture.expiresInSeconds,
    });
    expect(validateBridgeEncryptionKey(pairing.encryptionKey)).toBe(pairing.encryptionKey);
    const qr = JSON.parse(pairing.qrPayload);
    expect(qr).toEqual({ s: fixture.serverBase, p: pairing.pairingId, t: pairing.pairingToken, k: pairing.encryptionKey });
    // Confirmation returns the session base even if deployment configuration changes.
    mocks.env.PUBLIC_BRIDGE_BASE_URL = "https://other.example.invalid";
    const body = type === "qr"
      ? { pairingId: qr.p, pairingToken: qr.t, deviceId: fixture.phoneDeviceId }
      : { code: pairing.code, deviceId: fixture.phoneDeviceId };
    const endpoint = type === "qr" ? "confirm" : "confirm-code";
    const confirmed = await request(app).post(`/api/remote-bridge/pairing/${endpoint}`).send(body).expect(200);
    expect(confirmed.body).toEqual({
      ...(type === "manual" ? { success: true } : {}),
      accessToken: fixture.accessToken, refreshToken: fixture.refreshToken, userId: fixture.userId,
      encryptionKey: pairing.encryptionKey, serverUrl: fixture.serverBase,
    });
    expect(mocks.prisma.remoteBridgeDevice.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ deviceId: fixture.phoneDeviceId, encryptionKey: qr.k, deviceType: "phone" }),
    }));
    const status = await request(app).get(`/api/remote-bridge/pairing/${pairing.pairingId}/status`).expect(200);
    expect(status.body).toEqual({ status: "confirmed", phoneDeviceId: fixture.phoneDeviceId, encryptionKey: qr.k });
  });

  it("uses a validated direct HTTPS root when no explicit base is configured", async () => {
    mocks.env.PUBLIC_BRIDGE_BASE_URL = undefined;
    directHttps = true;
    const result = await request(app).post("/api/remote-bridge/pairing/create")
      .set("Host", "bridge.example.invalid").send({}).expect(200);
    expect(JSON.parse(result.body.qrPayload).s).toBe("https://bridge.example.invalid");
  });

  it.each(fixture.invalidServerBases)("rejects configured invalid base %j before session side effects", async (base) => {
    mocks.env.PUBLIC_BRIDGE_BASE_URL = base;
    const result = await create().expect(400);
    expect(result.body).toEqual({ message: "Invalid bridge server URL" });
    expect(mocks.prisma.remoteBridgeActivityLog.create).not.toHaveBeenCalled();
    expect(mocks.prisma.remoteBridgeDevice.upsert).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("requires explicit HTTPS configuration on a plain HTTP listener", async () => {
    mocks.env.PUBLIC_BRIDGE_BASE_URL = undefined;
    await create().expect(400);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects incomplete QR and code confirmation input without writing a device", async () => {
    await request(app).post("/api/remote-bridge/pairing/confirm").send({}).expect(400);
    await request(app).post("/api/remote-bridge/pairing/confirm-code").send({}).expect(400);
    expect(mocks.prisma.remoteBridgeDevice.upsert).not.toHaveBeenCalled();
  });

  it("registers a tablet with a valid fixture key", async () => {
    const result = await request(app).post("/api/remote-bridge/devices/register").send({
      deviceId: fixture.tabletDeviceId, encryptionKey: fixture.encryptionKey,
    }).expect(200);
    expect(result.body).toEqual({ success: true });
    expect(mocks.prisma.remoteBridgeDevice.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ userId: fixture.userId, deviceId: fixture.tabletDeviceId,
        deviceType: "tablet", encryptionKey: fixture.encryptionKey }),
      update: expect.objectContaining({ encryptionKey: fixture.encryptionKey }),
    }));
  });

  it.each(fixture.invalidEncryptionKeys)("rejects registration with invalid fixture key %j", async (encryptionKey) => {
    await request(app).post("/api/remote-bridge/devices/register")
      .send({ deviceId: fixture.tabletDeviceId, encryptionKey }).expect(400);
    expect(mocks.prisma.remoteBridgeDevice.upsert).not.toHaveBeenCalled();
  });

  it("preserves optional-key registration for existing callers", async () => {
    await request(app).post("/api/remote-bridge/devices/register")
      .send({ deviceId: fixture.tabletDeviceId }).expect(200);
    expect(mocks.prisma.remoteBridgeDevice.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ encryptionKey: null }),
    }));
  });

  it("reports the existing tablet limit without writing a device", async () => {
    mocks.prisma.remoteBridgeDevice.count.mockResolvedValue(5);
    const result = await request(app).post("/api/remote-bridge/devices/register")
      .send({ deviceId: fixture.tabletDeviceId, encryptionKey: fixture.encryptionKey }).expect(403);
    expect(result.body).toMatchObject({ currentCount: 5, maxAllowed: 5 });
    expect(mocks.prisma.remoteBridgeDevice.upsert).not.toHaveBeenCalled();
  });

  it("requires authentication for creation and registration", async () => {
    authenticated = false;
    await create().expect(401);
    await request(app).post("/api/remote-bridge/devices/register")
      .send({ deviceId: fixture.tabletDeviceId }).expect(401);
    expect(mocks.prisma.remoteBridgeDevice.upsert).not.toHaveBeenCalled();
  });
});
