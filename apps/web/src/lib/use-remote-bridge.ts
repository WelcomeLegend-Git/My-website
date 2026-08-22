import { useState, useEffect, useRef, useCallback } from "react";

// Diagnostic logging helper
const DIAG = true; // Set false to disable diagnostic logs
function diagLog(msg: string) {
  if (!DIAG) return;
  console.log(`[DIAG ${new Date().toISOString()}] ${msg}`);
}
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

export interface FullCallLog {
  number: string;
  name: string | null;
  type: number;
  date: number;
  duration: number;
  simSlot: string;
  isPrivate?: boolean;
}

export interface CallRecordingItem {
  id: number;
  contactName: string | null;
  number: string;
  timestamp: number;
  durationSeconds: number;
  isBothSides: boolean;
  customName: string | null;
  fileSize: number;
}

export interface RecordingAudioData {
  recordingId: number;
  mimeType: string;
  fileName: string;
  audioData: string;
  durationSeconds: number;
  contactName: string | null;
  number: string;
}

export interface PrivateVaultEntry {
  number: string;
  name: string | null;
  durationSeconds: number;
  isIncoming: boolean;
  timestamp: number;
  callType: string;
}

export interface RemoteAppSettings {
  autoRecordUnknown: boolean;
  autoRecordSelected: boolean;
  spamEnabled: boolean;
  autoReplyEnabled: boolean;
  shakeToAnswer: boolean;
  flipToReject: boolean;
  oneHandMode: boolean;
  blockUnknown: boolean;
  recordingRetention: string;
}

export interface RemotePhotoItem {
  id: number;
  displayName: string;
  dateAdded: number;
  size: number;
  width: number;
  height: number;
  mimeType: string;
  thumbnailBase64?: string;
}

export interface PhotoDataPayload {
  photoId: number;
  displayName: string;
  mimeType: string;
  base64Data: string;
  size: number;
}

export interface ScreenSnapshotPayload {
  success: boolean;
  base64Data?: string;
  width?: number;
  height?: number;
  timestamp?: number;
  error?: string;
}

export interface NotificationItem {
  id: number;
  packageName: string;
  appName: string;
  title?: string;
  text?: string;
  subText?: string;
  timestamp: number;
  hasPicture: boolean;
  pictureBase64?: string;
  notificationKey?: string;
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
  callLogs?: FullCallLog[];
  recordings?: CallRecordingItem[];
  privateVault?: PrivateVaultEntry[];
  settings?: RemoteAppSettings | Record<string, unknown>;
  audioChunk?: RecordingAudioData;
  isRecordingActive?: boolean;
  photos?: RemotePhotoItem[];
  photoData?: PhotoDataPayload;
  screenSnapshot?: ScreenSnapshotPayload;
  totalPhotosCount?: number;
  photoPage?: number;
  photoLimit?: number;
  notifications?: NotificationItem[];
  notificationItem?: NotificationItem;
  totalNotificationsCount?: number;
}

export interface BridgeStatus {
  connected: boolean;
  authenticated: boolean;
  phoneOnline: boolean;
  currentCall: CallEvent | null;
  recentCalls: RecentCall[];
  allCallLogs: FullCallLog[];
  recordings: CallRecordingItem[];
  currentAudio: RecordingAudioData | null;
  privateVault: { history: PrivateVaultEntry[]; privateNumbers: string[] } | null;
  remoteSettings: RemoteAppSettings | null;
  authError: string | null;
  photos: RemotePhotoItem[];
  totalPhotosCount: number;
  photoPage: number;
  photoPageSize: number;
  currentPhotoData: PhotoDataPayload | null;
  screenSnapshot: ScreenSnapshotPayload | null;
  isCapturingScreen: boolean;
  isLoadingPhotos: boolean;
  notifications: NotificationItem[];
  totalNotificationsCount: number;
  isLoadingNotifications: boolean;
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
    allCallLogs: [],
    recordings: [],
    currentAudio: null,
    privateVault: null,
    remoteSettings: null,
    authError: null,
    photos: [],
    totalPhotosCount: 0,
    photoPage: 0,
    photoPageSize: 40,
    currentPhotoData: null,
    screenSnapshot: null,
    isCapturingScreen: false,
    isLoadingPhotos: false,
    notifications: [],
    totalNotificationsCount: 0,
    isLoadingNotifications: false,
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

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    let shouldReconnect = true;
    let lastWakePhoneAt = 0;

    async function wakePhone(reason: string) {
      if (!navigator.onLine) return;

      const now = Date.now();
      if (now - lastWakePhoneAt < 10_000) return;
      lastWakePhoneAt = now;

      const sendWake = () =>
        fetch(`${getApiBaseUrl()}/api/remote-bridge/wake-phone`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authStorage.getAccessToken() || authToken}`,
          },
        });

      try {
        let res = await sendWake();
        if (res.status === 401 && await ensureFreshAuthTokens()) {
          res = await sendWake();
        }
        diagLog(`WAKE_PHONE reason=${reason} status=${res.status}`);
      } catch {
        diagLog(`WAKE_PHONE_FAILED reason=${reason}`);
      }
    }

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
        diagLog(`WS_OPEN — sending auth handshake`);
        setStatus((s) => ({ ...s, connected: true, authError: null }));
        reconnectAttempts.current = 0;

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
              diagLog(`AUTH_OK — starting ping interval`);
              setStatus((s) => ({ ...s, authenticated: true, authError: null, phoneOnline: false }));
              pingIntervalRef.current = setInterval(() => {
                ws.send(JSON.stringify({ type: "PING", ts: Date.now() }));
              }, 25_000);
              break;

            case "AUTH_FAIL":
              console.error("[RemoteBridge] Auth FAILED:", message.reason);
              diagLog(`AUTH_FAIL reason=${message.reason}`);
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
              if (cryptoKeyRef.current) {
                try {
                  const plaintext = await decrypt(
                    message.payload,
                    message.iv,
                    cryptoKeyRef.current
                  );
                  const callEvent = JSON.parse(plaintext) as CallEvent;

                  diagLog(`EVENT decrypted: eventType=${callEvent.eventType} callState=${callEvent.callState || 'none'}`);

                  if (callEvent.eventType === "RECENT_CALLS") {
                    if (callEvent.recentCalls) {
                      setStatus((s) => ({ ...s, phoneOnline: true, recentCalls: callEvent.recentCalls! }));
                    }
                  } else if (callEvent.eventType === "FULL_CALL_LOGS_RESPONSE") {
                    if (callEvent.callLogs) {
                      setStatus((s) => ({ ...s, phoneOnline: true, allCallLogs: callEvent.callLogs! }));
                    }
                  } else if (callEvent.eventType === "RECORDINGS_LIST_RESPONSE") {
                    if (callEvent.recordings) {
                      setStatus((s) => ({ ...s, phoneOnline: true, recordings: callEvent.recordings! }));
                    }
                  } else if (callEvent.eventType === "RECORDING_AUDIO_COMPLETE") {
                    if (callEvent.audioChunk) {
                      setStatus((s) => ({ ...s, phoneOnline: true, currentAudio: callEvent.audioChunk! }));
                    }
                  } else if (callEvent.eventType === "PRIVATE_VAULT_RESPONSE") {
                    const vaultData = (callEvent.settings as any) || {
                      history: callEvent.privateVault || [],
                      privateNumbers: [],
                    };
                    setStatus((s) => ({ ...s, phoneOnline: true, privateVault: vaultData }));
                  } else if (callEvent.eventType === "APP_SETTINGS_RESPONSE") {
                    if (callEvent.settings) {
                      setStatus((s) => ({ ...s, phoneOnline: true, remoteSettings: callEvent.settings as RemoteAppSettings }));
                    }
                  } else if (callEvent.eventType === "PHOTOS_LIST_RESPONSE") {
                    if (callEvent.photos) {
                      setStatus((s) => ({
                        ...s,
                        phoneOnline: true,
                        photos: callEvent.photos!,
                        totalPhotosCount: callEvent.totalPhotosCount || callEvent.photos!.length,
                        photoPage: callEvent.photoPage ?? s.photoPage,
                        photoPageSize: callEvent.photoLimit || 40,
                        isLoadingPhotos: false,
                      }));
                    }
                  } else if (callEvent.eventType === "PHOTO_DATA_RESPONSE") {
                    if (callEvent.photoData) {
                      setStatus((s) => ({ ...s, phoneOnline: true, currentPhotoData: callEvent.photoData! }));
                    }
                  } else if (callEvent.eventType === "SCREEN_SNAPSHOT_RESPONSE") {
                    if (callEvent.screenSnapshot) {
                      setStatus((s) => ({ ...s, phoneOnline: true, screenSnapshot: callEvent.screenSnapshot!, isCapturingScreen: false }));
                    }
                  } else if (callEvent.eventType === "NOTIFICATIONS_LIST_RESPONSE") {
                    if (callEvent.notifications) {
                      setStatus((s) => ({
                        ...s,
                        phoneOnline: true,
                        notifications: callEvent.notifications!,
                        totalNotificationsCount: callEvent.totalNotificationsCount || callEvent.notifications!.length,
                        isLoadingNotifications: false,
                      }));
                    }
                  } else if (callEvent.eventType === "NOTIFICATION_ARRIVED") {
                    if (callEvent.notificationItem) {
                      const newItem = callEvent.notificationItem;
                      setStatus((s) => {
                        const exists = s.notifications.some((n) => n.id === newItem.id);
                        const updated = exists ? s.notifications : [newItem, ...s.notifications];
                        return {
                          ...s,
                          phoneOnline: true,
                          notifications: updated.slice(0, 10000),
                          totalNotificationsCount: s.totalNotificationsCount + (exists ? 0 : 1),
                        };
                      });
                    }
                  } else {
                    setStatus((s) => ({
                      ...s,
                      phoneOnline: true,
                      currentCall: callEvent,
                    }));

                    showCallNotification(callEvent);
                  }
                } catch (err) {
                  console.error("Failed to decrypt event:", err);
                }
              }
              break;

            case "DEVICE_CONNECTED":
              diagLog(`DEVICE_CONNECTED type=${message.deviceType} id=${message.deviceId}`);
              if (message.deviceType === "phone") {
                setStatus((s) => ({ ...s, phoneOnline: true }));
                setTimeout(() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    sendCommand("STATUS_REQUEST");
                    sendCommand("GET_RECENT_CALLS");
                    sendCommand("GET_ALL_CALL_LOGS");
                    sendCommand("GET_RECORDINGS_LIST");
                    sendCommand("GET_APP_SETTINGS");
                  }
                }, 1500);
              }
              break;

            case "DEVICE_DISCONNECTED":
              diagLog(`DEVICE_DISCONNECTED type=${message.deviceType} id=${message.deviceId}`);
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
        diagLog(`WS_CLOSED code=${ev.code} reason=${ev.reason} shouldReconnect=${shouldReconnect} online=${navigator.onLine}`);
        setStatus((s) => ({
          ...s,
          connected: false,
          authenticated: false,
          currentCall: null,
        }));
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        stopRingtone();

        if (shouldReconnect && navigator.onLine) {
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
    wakePhone("mount");

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && shouldReconnect) {
        const ws = wsRef.current;
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          console.log("[RemoteBridge] Tab became visible — reconnecting");
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectAttempts.current = 0;
          connect();
        }
        wakePhone("visible");
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    function handleOnline() {
      console.log("[RemoteBridge] Network came back online");
      const ws = wsRef.current;
      if (shouldReconnect && (!ws || ws.readyState !== WebSocket.OPEN)) {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectAttempts.current = 0;
        connect();
      }
      wakePhone("online");
    }
    function handleOffline() {
      console.log("[RemoteBridge] Network went offline — pausing reconnect");
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      shouldReconnect = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      wsRef.current?.close();
      stopRingtone();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
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
    getAllCallLogs: () => sendCommand("GET_ALL_CALL_LOGS"),
    getRecordingsList: () => sendCommand("GET_RECORDINGS_LIST"),
    fetchRecordingAudio: (recordingId: number) =>
      sendCommand("FETCH_RECORDING_AUDIO", { recordingId }),
    toggleInCallRecording: (enable?: boolean) =>
      sendCommand("TOGGLE_IN_CALL_RECORDING", { enableRecording: enable }),
    getPrivateVault: (pin: string) =>
      sendCommand("GET_PRIVATE_VAULT_LOGS", { pin }),
    getAppSettings: () => sendCommand("GET_APP_SETTINGS"),
    updateAppSettings: (settingsPayload: Record<string, unknown>) =>
      sendCommand("UPDATE_APP_SETTINGS", { settingsPayload }),
    getPhotosList: (page?: number, limit?: number) => {
      setStatus((s) => ({ ...s, isLoadingPhotos: true }));
      sendCommand("GET_PHOTOS_LIST", { page: page || 0, limit: limit || 40 });
    },
    fetchPhotoData: (photoId: number) =>
      sendCommand("FETCH_PHOTO_DATA", { photoId }),
    captureScreenSnapshot: () => {
      setStatus((s) => ({ ...s, isCapturingScreen: true }));
      sendCommand("CAPTURE_SCREEN_SNAPSHOT");
    },
    clearActivePhoto: () =>
      setStatus((s) => ({ ...s, currentPhotoData: null })),
    clearScreenSnapshot: () =>
      setStatus((s) => ({ ...s, screenSnapshot: null })),
    clearCurrentAudio: () =>
      setStatus((s) => ({ ...s, currentAudio: null })),
    getNotificationsList: (options?: { searchQuery?: string; packageFilter?: string; sinceTimestamp?: number; page?: number; limit?: number }) => {
      setStatus((s) => ({ ...s, isLoadingNotifications: true }));
      sendCommand("GET_NOTIFICATIONS_LIST", options || {});
    },
    clearAllNotifications: () => {
      sendCommand("CLEAR_NOTIFICATIONS");
      setStatus((s) => ({ ...s, notifications: [], totalNotificationsCount: 0 }));
    },
    deleteNotification: (id: number) => {
      sendCommand("DELETE_NOTIFICATION", { notificationId: id });
      setStatus((s) => ({
        ...s,
        notifications: s.notifications.filter((n) => n.id !== id),
        totalNotificationsCount: Math.max(0, s.totalNotificationsCount - 1),
      }));
    },
    setPhoneOnline: (online: boolean) =>
      setStatus((s) => ({ ...s, phoneOnline: online })),
  };
}
