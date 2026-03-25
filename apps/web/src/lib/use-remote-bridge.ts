import { useState, useEffect, useRef, useCallback } from "react";
import { getApiBaseUrl } from "./env";

// ─── Types ───

export type CallState =
  | "IDLE"
  | "RINGING"
  | "ACTIVE"
  | "CONNECTING"
  | "HOLDING"
  | "DISCONNECTED";

export interface CallEvent {
  eventType: string;
  callerNumber?: string;
  callerName?: string;
  callState?: CallState;
  isMuted: boolean;
  isSpeakerOn: boolean;
  audioRoute: number;
  durationSeconds: number;
  bluetoothDeviceName?: string;
}

export interface BridgeStatus {
  connected: boolean;
  authenticated: boolean;
  phoneOnline: boolean;
  currentCall: CallEvent | null;
}

interface UseBridgeOptions {
  encryptionKey: string; // Base64 encoded AES key
  deviceId: string;
  authToken: string;
}

// ─── AES-GCM Encryption (Web Crypto API) ───

async function importKey(base64Key: string): Promise<CryptoKey> {
  const keyBytes = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(cipherBuffer))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

async function decrypt(
  ciphertext: string,
  ivStr: string,
  key: CryptoKey
): Promise<string> {
  const cipherBytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivStr), (c) => c.charCodeAt(0));
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipherBytes
  );
  return new TextDecoder().decode(plainBuffer);
}

async function computeHmac(data: string, base64Key: string): Promise<string> {
  const keyBytes = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const encoded = new TextEncoder().encode(data);
  const sig = await crypto.subtle.sign("HMAC", hmacKey, encoded);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// ─── Hook ───

export function useRemoteBridge(options: UseBridgeOptions | null) {
  const [status, setStatus] = useState<BridgeStatus>({
    connected: false,
    authenticated: false,
    phoneOnline: false,
    currentCall: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const cryptoKeyRef = useRef<CryptoKey | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttempts = useRef(0);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval>>();

  // ─── Send command ───

  const sendCommand = useCallback(
    async (commandType: string, extra: Record<string, unknown> = {}) => {
      if (!wsRef.current || !cryptoKeyRef.current || !options) return;

      const payload = JSON.stringify({ commandType, ...extra });
      const { encrypted, iv } = await encrypt(payload, cryptoKeyRef.current);
      const hmac = await computeHmac(encrypted, options.encryptionKey);

      const envelope = {
        type: "COMMAND",
        payload: encrypted,
        iv,
        hmac,
        ts: Date.now(),
        deviceId: options.deviceId,
      };

      wsRef.current.send(JSON.stringify(envelope));
    },
    [options]
  );

  // ─── Connect ───

  useEffect(() => {
    if (!options) return;

    const { encryptionKey, deviceId, authToken } = options;

    async function connect() {
      try {
        cryptoKeyRef.current = await importKey(encryptionKey);
      } catch (err) {
        console.error("Failed to import encryption key:", err);
        return;
      }

      const base = getApiBaseUrl();
      const wsBase = base
        .replace(/^https:/, "wss:")
        .replace(/^http:/, "ws:");
      const wsUrl = `${wsBase}/ws/tablet`;

      console.log("[RemoteBridge] Connecting to WS:", wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[RemoteBridge] WS connected, sending auth...");
        setStatus((s) => ({ ...s, connected: true }));
        reconnectAttempts.current = 0;

        // Send auth handshake
        ws.send(
          JSON.stringify({
            type: "AUTH",
            token: authToken,
            deviceId,
            deviceType: "tablet",
            ts: Date.now(),
          })
        );
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(
            typeof event.data === "string" ? event.data : ""
          );

          switch (message.type) {
            case "AUTH_OK":
              console.log("[RemoteBridge] Auth OK!");
              setStatus((s) => ({ ...s, authenticated: true }));
              pingIntervalRef.current = setInterval(() => {
                ws.send(JSON.stringify({ type: "PING", ts: Date.now() }));
              }, 25_000);
              break;

            case "AUTH_FAIL":
              console.error("[RemoteBridge] Auth FAILED:", message.reason);
              setStatus((s) => ({
                ...s,
                authenticated: false,
                connected: false,
              }));
              ws.close();
              break;

            case "EVENT":
              // Encrypted event from phone
              if (cryptoKeyRef.current) {
                try {
                  const plaintext = await decrypt(
                    message.payload,
                    message.iv,
                    cryptoKeyRef.current
                  );
                  const callEvent = JSON.parse(plaintext) as CallEvent;
                  setStatus((s) => ({
                    ...s,
                    phoneOnline: true,
                    currentCall: callEvent,
                  }));
                } catch (err) {
                  console.error("Failed to decrypt event:", err);
                }
              }
              break;

            case "DEVICE_CONNECTED":
              if (message.deviceType === "phone") {
                setStatus((s) => ({ ...s, phoneOnline: true }));
              }
              break;

            case "DEVICE_DISCONNECTED":
              if (message.deviceType === "phone") {
                setStatus((s) => ({
                  ...s,
                  phoneOnline: false,
                  currentCall: null,
                }));
              }
              break;

            case "PONG":
              break;

            default:
              break;
          }
        } catch (err) {
          console.error("WS message parse error:", err);
        }
      };

      ws.onclose = (ev) => {
        console.log("[RemoteBridge] WS closed, code:", ev.code, "reason:", ev.reason);
        setStatus({
          connected: false,
          authenticated: false,
          phoneOnline: false,
          currentCall: null,
        });
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // Reconnect
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
        reconnectAttempts.current++;
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = (ev) => {
        console.error("[RemoteBridge] WS error", ev);
        ws.close();
      };
    }

    connect();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      wsRef.current?.close();
    };
  }, [options]);

  return {
    status,
    acceptCall: () => sendCommand("ACCEPT_CALL"),
    rejectCall: () => sendCommand("REJECT_CALL"),
    hangupCall: () => sendCommand("HANGUP_CALL"),
    dialNumber: (number: string) =>
      sendCommand("DIAL_NUMBER", { number }),
    toggleMute: () => sendCommand("TOGGLE_MUTE"),
    toggleSpeaker: () => sendCommand("TOGGLE_SPEAKER"),
    holdCall: () => sendCommand("HOLD_CALL"),
    unholdCall: () => sendCommand("UNHOLD_CALL"),
    requestStatus: () => sendCommand("STATUS_REQUEST"),
  };
}
