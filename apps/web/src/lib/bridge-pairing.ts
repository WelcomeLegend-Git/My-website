import { buildBridgeQrPayload, validateBridgeEncryptionKey, validateBridgeServerBase } from "../../../../packages/shared/src/bridge-pairing";
import { authenticatedFetch } from "./auth-fetch";
import { getApiBaseUrl } from "./env";

export { validateBridgeEncryptionKey };

export const BRIDGE_REGISTRATION_ERROR = "Device registration failed. Check your connection and retry registration; no new pairing code is needed.";

export function getBridgePairingBase(): string {
  return validateBridgeServerBase(getApiBaseUrl());
}

export interface BridgePairingSession {
  pairingId: string;
  pairingToken: string;
  encryptionKey: string;
  qrPayload: string;
  code: string;
  expiresInSeconds: number;
}

export function validatePairingSession(base: string, data: BridgePairingSession): BridgePairingSession {
  const canonicalBase = validateBridgeServerBase(base);
  const encryptionKey = validateBridgeEncryptionKey(data.encryptionKey);
  const qrPayload = buildBridgeQrPayload(canonicalBase, { ...data, encryptionKey });
  try {
    const advertised = JSON.parse(data.qrPayload);
    if (validateBridgeServerBase(advertised.s) !== canonicalBase ||
        advertised.p !== data.pairingId || advertised.t !== data.pairingToken || advertised.k !== encryptionKey) {
      throw new Error("QR mismatch");
    }
  } catch {
    throw new Error("Pairing QR does not match this backend or session. Check the bridge server configuration.");
  }
  return { ...data, encryptionKey, qrPayload };
}

export async function registerBridgeTablet(base: string, encryptionKey: string, deviceId: string, deviceName: string): Promise<void> {
  const canonicalBase = validateBridgeServerBase(base);
  const key = validateBridgeEncryptionKey(encryptionKey);
  const res = await authenticatedFetch(`${canonicalBase}/api/remote-bridge/devices/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, deviceType: "tablet", deviceName, encryptionKey: key }),
  });
  if (!res.ok) throw new Error(BRIDGE_REGISTRATION_ERROR);
}
