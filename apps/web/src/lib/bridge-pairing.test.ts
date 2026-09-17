import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../../packages/shared/test-fixtures/bridge-pairing.json";
import { authenticatedFetch } from "./auth-fetch";
import { getApiBaseUrl } from "./env";
import { getBridgePairingBase, registerBridgeTablet, validatePairingSession } from "./bridge-pairing";

vi.mock("./auth-fetch", () => ({ authenticatedFetch: vi.fn() }));
vi.mock("./env", () => ({ getApiBaseUrl: vi.fn() }));

const session = {
  pairingId: fixture.pairingId, pairingToken: fixture.pairingToken,
  encryptionKey: fixture.encryptionKey, code: fixture.code, expiresInSeconds: fixture.expiresInSeconds,
  qrPayload: JSON.stringify({ s: fixture.serverBase, p: fixture.pairingId, t: fixture.pairingToken, k: fixture.encryptionKey }),
};

beforeEach(() => { vi.clearAllMocks(); });

describe("bridge pairing boundary", () => {
  it.each(fixture.validServerBases)("canonicalizes QR and registration at %s", async (base) => {
    vi.mocked(getApiBaseUrl).mockReturnValue(base);
    const canonical = base.replace(/\/$/, "");
    expect(getBridgePairingBase()).toBe(canonical);
    const data = validatePairingSession(base, {
      ...session, qrPayload: JSON.stringify({ s: base, p: fixture.pairingId, t: fixture.pairingToken, k: fixture.encryptionKey }),
    });
    expect(JSON.parse(data.qrPayload)).toEqual({ s: canonical, p: fixture.pairingId, t: fixture.pairingToken, k: fixture.encryptionKey });
    vi.mocked(authenticatedFetch).mockResolvedValue({ ok: true } as Response);
    await registerBridgeTablet(base, data.encryptionKey, fixture.tabletDeviceId, "Test browser");
    expect(authenticatedFetch).toHaveBeenCalledWith(`${canonical}/api/remote-bridge/devices/register`, expect.objectContaining({
      body: JSON.stringify({ deviceId: fixture.tabletDeviceId, deviceType: "tablet", deviceName: "Test browser", encryptionKey: fixture.encryptionKey }),
    }));
  });

  it.each(fixture.invalidServerBases)("rejects invalid base before registration: %s", async (base) => {
    vi.mocked(getApiBaseUrl).mockReturnValue(base);
    expect(() => getBridgePairingBase()).toThrow();
    await expect(registerBridgeTablet(base, fixture.encryptionKey, fixture.tabletDeviceId, "Test browser")).rejects.toThrow();
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });

  it.each(fixture.invalidEncryptionKeys)("rejects invalid key before registration: %s", async (key) => {
    expect(() => validatePairingSession(fixture.serverBase, { ...session, encryptionKey: key })).toThrow();
    await expect(registerBridgeTablet(fixture.serverBase, key, fixture.tabletDeviceId, "Test browser")).rejects.toThrow();
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });

  it.each([
    { s: "https://other.example.invalid" },
    { s: "https://bridge.example.invalid/other-prefix" },
    { p: "other-session" },
    { t: "other-token" },
    { k: fixture.differentEncryptionKey },
  ])("rejects advertised QR disagreement: %j", (change) => {
    const advertised = { ...JSON.parse(session.qrPayload), ...change };
    expect(() => validatePairingSession(fixture.serverBase, { ...session, qrPayload: JSON.stringify(advertised) })).toThrow(/does not match/);
  });

  it.each(["not JSON", "null", "", "{}"])("rejects malformed advertised QR: %s", (qrPayload) => {
    expect(() => validatePairingSession(fixture.serverBase, { ...session, qrPayload })).toThrow();
  });

  it("checks registration HTTP failures", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue({ ok: false } as Response);
    await expect(registerBridgeTablet(fixture.serverBase, fixture.encryptionKey, fixture.tabletDeviceId, "Test browser")).rejects.toThrow(/registration failed/i);
  });

  it("propagates network failure without treating it as success", async () => {
    vi.mocked(authenticatedFetch).mockRejectedValue(new TypeError("Offline"));
    await expect(registerBridgeTablet(fixture.serverBase, fixture.encryptionKey, fixture.tabletDeviceId, "Test browser")).rejects.toThrow("Offline");
  });
});
