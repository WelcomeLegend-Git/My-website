const INVALID_SERVER_BASE = "Invalid bridge server URL";

/** Reject ambiguous syntax before URL can silently repair or normalize it. */
export function validateBridgeServerBase(input: string): string {
  const invalid = () => new Error(INVALID_SERVER_BASE);
  if (typeof input !== "string" || /[\s\u0000-\u0020\u007f-\u009f\\]/u.test(input)) {
    throw invalid();
  }

  const match = /^https:\/\/([^/?#]+)(\/[^?#]*)?$/i.exec(input);
  if (!match) throw invalid();
  const authority = match[1];
  const path = match[2] || "";
  if (
    /[@%]/.test(authority) || authority.endsWith(":") ||
    path.includes("//") || /[<>"{}|^`\[\]]/.test(path) ||
    /%(?![0-9a-f]{2})/i.test(path) ||
    /%(?:2f|5c|25|0[0-9a-f]|1[0-9a-f]|7f)/i.test(path) ||
    path.split("/").some((segment) => [".", ".."].includes(segment.replace(/%2e/gi, ".")))
  ) {
    throw invalid();
  }

  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.search || url.hash) {
      throw invalid();
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    throw invalid();
  }
}

export function validateBridgeEncryptionKey(value: unknown): string {
  // 32 bytes have 43 Base64 digits, zero padding bits, and one '='.
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/.test(value)) {
    throw new Error("Invalid bridge encryption key");
  }
  return value;
}

export function buildBridgeQrPayload(
  base: string,
  data: { pairingId: string; pairingToken: string; encryptionKey: string },
): string {
  return JSON.stringify({
    s: validateBridgeServerBase(base),
    p: data.pairingId,
    t: data.pairingToken,
    k: validateBridgeEncryptionKey(data.encryptionKey),
  });
}
