import { useState, useEffect, useRef, useCallback } from "react";
import { authStorage } from "./auth-storage";
import { ensureFreshAuthTokens } from "./auth-fetch";
import { getApiBaseUrl } from "./env";

// ─── Types ───

export type CallState =
  | "IDLE"
  | "RINGING"
  | "ACTIVE"
  | "CONNECTING"
  | "HOLDING"
  | "DISCONNECTED";

export interface RecentCall {
  number: string;
  name: string | null;
  type: number; // 1: Incoming, 2: Outgoing, 3: Missed, etc.
  date: number;
  duration: number;
}

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
  recentCalls?: RecentCall[];
}

export interface BridgeStatus {
  connected: boolean;
  authenticated: boolean;
  phoneOnline: boolean;
  currentCall: CallEvent | null;
  recentCalls: RecentCall[];
  authError: string | null;
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

function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

// ─── Ringtone Audio ───

let ringtoneAudio: HTMLAudioElement | null = null;

function createRingtone(): HTMLAudioElement {
  if (ringtoneAudio) return ringtoneAudio;

  // Create a synthetic ringtone using AudioContext
  // We'll use a simple oscillator-based approach stored as a data URL
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const sampleRate = audioCtx.sampleRate;
  const duration = 2; // 2 seconds per ring cycle
  const buffer = audioCtx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);

  // Generate a phone-like ringtone (two-tone pattern)
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    // Ring on for 0.4s, off 0.2s, ring 0.4s, off 1.0s
    const inRing = (t < 0.4) || (t >= 0.6 && t < 1.0);
    if (inRing) {
      // Two-frequency phone ring (440Hz + 480Hz)
      data[i] = 0.3 * (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 480 * t));
    } else {
      data[i] = 0;
    }
  }

  // Convert AudioBuffer to WAV blob
  const wav = audioBufferToWav(buffer);
  const blob = new Blob([wav], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);

  ringtoneAudio = new Audio(url);
  ringtoneAudio.loop = true;
  ringtoneAudio.volume = 0.7;
  audioCtx.close();

  return ringtoneAudio;
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;
  const data = buffer.getChannelData(0);
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const wavDataBytes = data.length * numChannels * bitsPerSample / 8;
  const headerBytes = 44;
  const totalBytes = headerBytes + wavDataBytes;

  const arrayBuffer = new ArrayBuffer(totalBytes);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, totalBytes - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, wavDataBytes, true);

  // Write PCM data
  let offset = 44;
  for (let i = 0; i < data.length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }

  return arrayBuffer;
}

function startRingtone() {
  try {
    const audio = createRingtone();
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay blocked — user hasn't interacted yet
      console.warn("[RemoteBridge] Ringtone autoplay blocked by browser");
    });
  } catch (e) {
    console.warn("[RemoteBridge] Could not create ringtone:", e);
  }
}

function stopRingtone() {
  if (ringtoneAudio) {
    ringtoneAudio.pause();
    ringtoneAudio.currentTime = 0;
  }
}

// ─── Browser Notification ───

let lastNotifiedCallState: string | null = null;

function showCallNotification(callEvent: CallEvent) {
  const callState = callEvent.callState;
  if (!callState) return;

  // Only notify on state transitions
  if (callState === lastNotifiedCallState) return;
  lastNotifiedCallState = callState;

  if (callState === "RINGING") {
    const callerName = callEvent.callerName || callEvent.callerNumber || "Unknown Caller";

    // Start ringtone
    startRingtone();

    // Show browser notification (works even when tab is not focused)
    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(`📞 Incoming Call`, {
        body: `${callerName} is calling...`,
        icon: "/icon-192.png",
        tag: "incoming-call",
        requireInteraction: true,
        silent: false, // Let the notification also make sound
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close when call state changes
      const checkInterval = setInterval(() => {
        if (lastNotifiedCallState !== "RINGING") {
          notification.close();
          clearInterval(checkInterval);
        }
      }, 500);
    }
  } else {
    // Call state changed from ringing — stop ringtone
    stopRingtone();
  }

  if (callState === "IDLE" || callState === "DISCONNECTED") {
    lastNotifiedCallState = null;
    stopRingtone();
  }
}

// ─── Hook ───

export function useRemoteBridge(options: UseBridgeOptions | null) {
  const [status, setStatus] = useState<BridgeStatus>({
    connected: false,
    authenticated: false,
    phoneOnline: false,
    currentCall: null,
    recentCalls: [],
    authError: null,
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
      if (wsRef.current.readyState !== WebSocket.OPEN) return;

      const payload = JSON.stringify({ commandType, ...extra });
      const { encrypted, iv } = await encrypt(payload, cryptoKeyRef.current);
      const ts = Date.now();
      const nonce = generateNonce();

      // HMAC covers the full envelope to prevent replay/tamper attacks
      // Must match Android's RemoteCallProtocol.Envelope.hmacInput() format:
      // "type|payload|iv|ts|deviceId|nonce"
      const hmacInput = `COMMAND|${encrypted}|${iv}|${ts}|${options.deviceId}|${nonce}`;
      const hmac = await computeHmac(hmacInput, options.encryptionKey);

      const envelope = {
        type: "COMMAND",
        payload: encrypted,
        iv,
        hmac,
        ts,
        deviceId: options.deviceId,
        nonce,
      };

      wsRef.current.send(JSON.stringify(envelope));
    },
    [options]
  );

  // ─── Connect ───

  useEffect(() => {
    if (!options) return;

    const { encryptionKey, deviceId, authToken } = options;

    // Request notification permission early
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    let shouldReconnect = true;

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
        setStatus((s) => ({ ...s, connected: true, authError: null }));
        reconnectAttempts.current = 0;

        // Send auth handshake — include device name for display
        const deviceNameFromUA = (() => {
          try {
            const ua = navigator.userAgent;
            if (/iPad/i.test(ua)) return "iPad";
            if (/iPhone/i.test(ua)) return "iPhone";
            if (/Android/i.test(ua)) return "Android Tablet";
            if (/Mac/i.test(ua)) return "Mac Browser";
            if (/Windows/i.test(ua)) return "Windows Browser";
            if (/Linux/i.test(ua)) return "Linux Browser";
            return "Web Browser";
          } catch { return "Web Browser"; }
        })();

        ws.send(
          JSON.stringify({
            type: "AUTH",
            token: authStorage.getAccessToken() || authToken,
            deviceId,
            deviceType: "tablet",
            deviceName: deviceNameFromUA,
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
              setStatus((s) => ({ ...s, authenticated: true, authError: null }));
              pingIntervalRef.current = setInterval(() => {
                ws.send(JSON.stringify({ type: "PING", ts: Date.now() }));
              }, 25_000);
              break;

            case "AUTH_FAIL":
              console.error("[RemoteBridge] Auth FAILED:", message.reason);
              if (/invalid token|jwt expired|token/i.test(message.reason || "")) {
                shouldReconnect = false;
                const refreshed = await ensureFreshAuthTokens();
                if (refreshed) {
                  reconnectTimerRef.current = setTimeout(connect, 250);
                  ws.close(1000, "Token refreshed");
                  break;
                }
              }

              shouldReconnect = false;
              setStatus((s) => ({
                ...s,
                authenticated: false,
                connected: false,
                authError: message.reason || "Authentication failed",
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

                  if (callEvent.eventType === "RECENT_CALLS") {
                    if (callEvent.recentCalls) {
                      setStatus((s) => ({ ...s, phoneOnline: true, recentCalls: callEvent.recentCalls! }));
                    }
                  } else {
                    setStatus((s) => ({
                      ...s,
                      phoneOnline: true,
                      currentCall: callEvent,
                    }));

                    // Show notification + play ringtone for incoming calls
                    showCallNotification(callEvent);
                  }
                } catch (err) {
                  console.error("Failed to decrypt event:", err);
                }
              }
              break;

            case "DEVICE_CONNECTED":
              if (message.deviceType === "phone") {
                setStatus((s) => ({ ...s, phoneOnline: true }));
                // Phone just connected — request status & calls after short delay
                // so the phone's state sync has time to initialize
                setTimeout(() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    // Send STATUS_REQUEST command
                    sendCommand("STATUS_REQUEST");
                    // Send GET_RECENT_CALLS command
                    sendCommand("GET_RECENT_CALLS");
                  }
                }, 1500);
              }
              break;

            case "DEVICE_DISCONNECTED":
              if (message.deviceType === "phone") {
                setStatus((s) => ({
                  ...s,
                  phoneOnline: false,
                  currentCall: null,
                }));
                stopRingtone();
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
        setStatus((s) => ({
          ...s,
          connected: false,
          authenticated: false,
          phoneOnline: false,
          currentCall: null,
        }));
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        stopRingtone();

        // Reconnect
        if (shouldReconnect) {
          const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
          reconnectAttempts.current++;
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = (ev) => {
        console.error("[RemoteBridge] WS error", ev);
        ws.close();
      };
    }

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      wsRef.current?.close();
      stopRingtone();
    };
  }, [options, sendCommand]);

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
    getRecentCalls: () => sendCommand("GET_RECENT_CALLS"),
    setPhoneOnline: (online: boolean) =>
      setStatus((s) => ({ ...s, phoneOnline: online })),
  };
}
