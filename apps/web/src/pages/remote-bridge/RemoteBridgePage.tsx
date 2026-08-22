import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  useRemoteBridge,
  type CallState,
  type RecentCall,
  type FullCallLog,
  type CallRecordingItem,
  type RecordingAudioData,
  type PrivateVaultEntry,
  type RemoteAppSettings,
} from "../../lib/use-remote-bridge";
import { getApiBaseUrl } from "../../lib/env";
import { authStorage } from "../../lib/auth-storage";
import { authenticatedFetch } from "../../lib/auth-fetch";
import { BridgeDiagnosticsPanel } from "./BridgeDiagnosticsPanel";

// ─── Animations and Styles ───
if (typeof document !== "undefined" && !document.getElementById("rb-spin-style")) {
  const style = document.createElement("style");
  style.id = "rb-spin-style";
  style.textContent = `
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.05); } }
    @keyframes recordingPulse { 0%, 100% { opacity: 1; box-shadow: 0 0 16px #ff3b30; } 50% { opacity: 0.4; box-shadow: 0 0 4px #ff3b30; } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    
    .rb-container { width: 100%; max-width: 100%; margin: 0; animation: fadeIn 0.4s ease-out; }
    .rb-glass { background: rgba(18, 24, 38, 0.85); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; }
    .rb-glass:hover { border-color: rgba(212, 175, 55, 0.3); }
    .rb-recording-active { animation: recordingPulse 1.5s infinite; }
  `;
  document.head.appendChild(style);
}

// ─── Config Storage ───
const BRIDGE_CONFIG_KEY = "aura-remote-bridge-config";
const BRIDGE_DEVICE_ID_KEY = "aura-remote-bridge-device-id";

interface BridgeConfig {
  encryptionKey: string;
  deviceId: string;
  isPermanent?: boolean;
}

function loadBridgeConfig(): BridgeConfig | null {
  try {
    const raw = localStorage.getItem(BRIDGE_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveBridgeConfig(config: BridgeConfig) {
  localStorage.setItem(BRIDGE_CONFIG_KEY, JSON.stringify(config));
}

function clearBridgeConfig() {
  localStorage.removeItem(BRIDGE_CONFIG_KEY);
}

function getOrCreateBridgeDeviceId(): string {
  const existing = localStorage.getItem(BRIDGE_DEVICE_ID_KEY);
  if (existing) return existing;
  const deviceId = `tablet_${crypto.randomUUID().slice(0, 12)}`;
  localStorage.setItem(BRIDGE_DEVICE_ID_KEY, deviceId);
  return deviceId;
}

const DIAL_PAD = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

export function RemoteBridgePage() {
  const [config, setConfig] = useState<BridgeConfig | null>(loadBridgeConfig);
  const [dialNumber, setDialNumber] = useState("");
  const [showSetup, setShowSetup] = useState(!config);
  const [activeTab, setActiveTab] = useState<"call" | "dial" | "logs" | "recordings" | "vault" | "settings" | "diag">("call");
  const [refreshing, setRefreshing] = useState(false);

  const auth = authStorage.getState();
  const authToken = auth.accessToken || "";

  const bridgeOptions = useMemo(() => {
    if (!config || !authToken) return null;
    return { encryptionKey: config.encryptionKey, deviceId: config.deviceId, authToken };
  }, [config?.encryptionKey, config?.deviceId, authToken]);

  const bridge = useRemoteBridge(bridgeOptions);
  const {
    status,
    acceptCall,
    rejectCall,
    hangupCall,
    toggleMute,
    toggleSpeaker,
    holdCall,
    unholdCall,
    requestStatus,
    getRecentCalls,
    getAllCallLogs,
    getRecordingsList,
    fetchRecordingAudio,
    toggleInCallRecording,
    getPrivateVault,
    getAppSettings,
    updateAppSettings,
    clearCurrentAudio,
    dialNumber: bridgeDialNumber,
    setPhoneOnline,
  } = bridge;

  const currentCall = status.currentCall;
  const callState: CallState = (currentCall?.callState as CallState) || "IDLE";

  const checkPhoneStatus = useCallback(async () => {
    if (!authToken) return;
    setRefreshing(true);
    try {
      const base = getApiBaseUrl();
      const res = await authenticatedFetch(`${base}/api/remote-bridge/phone-status`);
      if (res.ok) {
        const data = await res.json();
        setPhoneOnline(data.phoneOnline);
        if (data.phoneOnline) {
          requestStatus();
          getRecentCalls();
          getAllCallLogs();
          getRecordingsList();
          getAppSettings();
        }
      }
    } catch {}
    setRefreshing(false);
  }, [authToken, requestStatus, getRecentCalls, getAllCallLogs, getRecordingsList, getAppSettings, setPhoneOnline]);

  const handlePairingSuccess = useCallback((encryptionKey: string, isPermanent = false) => {
    const deviceId = getOrCreateBridgeDeviceId();
    const newConfig: BridgeConfig = { encryptionKey, deviceId, isPermanent };
    saveBridgeConfig(newConfig);
    setConfig(newConfig);
    setShowSetup(false);
  }, []);

  useEffect(() => {
    if (status.authenticated) {
      checkPhoneStatus();
    }
  }, [status.authenticated]);

  if (showSetup || !config) {
    return (
      <div style={styles.container} className="rb-container">
        <SetupScreen onPaired={handlePairingSuccess} />
      </div>
    );
  }

  return (
    <div style={styles.container} className="rb-container">
      {/* Sticky Header Group */}
      <div style={styles.headerGroup}>
        <div style={styles.statusBar}>
          <div style={styles.statusLeft}>
            <div
              style={{
                ...styles.statusDot,
                backgroundColor: status.connected && status.authenticated
                  ? status.phoneOnline ? "#34D399" : "#F59E0B"
                  : "#EF4444",
              }}
            />
            <span style={styles.statusText}>
              {!status.connected ? "Connecting Bridge..." :
               !status.authenticated ? "Authenticating..." :
               !status.phoneOnline ? "Phone Offline" :
               "AuraRing Phone Live"}
            </span>
            {status.connected && (
              <button
                onClick={checkPhoneStatus}
                disabled={refreshing}
                style={{
                  ...styles.iconBtn,
                  ...(refreshing ? { animation: "spin 1s linear infinite" } : {}),
                }}
                title="Refresh phone connection"
              >
                🔄
              </button>
            )}
          </div>
          <div style={styles.statusRight}>
            {currentCall?.bluetoothDeviceName && (
              <span style={styles.badge}>🎧 {currentCall.bluetoothDeviceName}</span>
            )}
            <span style={styles.badgeGold}>⚡ Ecosystem Mirror</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={styles.tabBar}>
          {[
            { id: "call", label: "📞 Live Call", badge: callState !== "IDLE" ? "● Active" : null },
            { id: "dial", label: "⌨️ Keypad" },
            { id: "logs", label: "📋 Call Logs", count: status.allCallLogs?.length },
            { id: "recordings", label: "🎙️ Recordings", count: status.recordings?.length },
            { id: "vault", label: "🔒 Private Vault" },
            { id: "settings", label: "⚙️ Remote Settings" },
            { id: "diag", label: "🔍 Diag" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                if (tab.id === "logs") getAllCallLogs();
                if (tab.id === "recordings") getRecordingsList();
                if (tab.id === "settings") getAppSettings();
              }}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.tabActive : {}),
              }}
            >
              {tab.label}
              {tab.badge && <span style={styles.liveCallPill}>{tab.badge}</span>}
              {tab.count !== undefined && tab.count > 0 && <span style={styles.countPill}>{tab.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={styles.scrollArea}>
        <div style={styles.content}>
          {activeTab === "call" && (
            <LiveCallPanel
              callState={callState}
              currentCall={currentCall}
              onAccept={acceptCall}
              onReject={rejectCall}
              onHangup={hangupCall}
              onToggleMute={toggleMute}
              onToggleSpeaker={toggleSpeaker}
              onHold={holdCall}
              onUnhold={unholdCall}
              onToggleRecording={toggleInCallRecording}
              phoneOnline={status.phoneOnline}
              recentCalls={status.recentCalls}
              onDialNumber={(num) => {
                bridgeDialNumber(num);
                setActiveTab("dial");
                setDialNumber(num);
              }}
            />
          )}

          {activeTab === "dial" && (
            <DialPanel
              number={dialNumber}
              onChange={setDialNumber}
              onDial={() => {
                if (dialNumber.trim()) {
                  bridgeDialNumber(dialNumber.trim());
                  setDialNumber("");
                  setActiveTab("call");
                }
              }}
              disabled={!status.phoneOnline}
            />
          )}

          {activeTab === "logs" && (
            <CallLogsPanel
              logs={status.allCallLogs || []}
              onRefresh={getAllCallLogs}
              onCallNumber={(num) => {
                bridgeDialNumber(num);
                setActiveTab("call");
              }}
            />
          )}

          {activeTab === "recordings" && (
            <RecordingsPanel
              recordings={status.recordings || []}
              currentAudio={status.currentAudio}
              onFetchAudio={fetchRecordingAudio}
              onClearAudio={clearCurrentAudio}
              onRefresh={getRecordingsList}
            />
          )}

          {activeTab === "vault" && (
            <PrivateVaultPanel
              vaultData={status.privateVault}
              onUnlock={getPrivateVault}
              onCallNumber={(num) => {
                bridgeDialNumber(num);
                setActiveTab("call");
              }}
            />
          )}

          {activeTab === "settings" && (
            <SettingsPanel
              config={config}
              remoteSettings={status.remoteSettings}
              onUpdateSetting={(key, val) => updateAppSettings({ [key]: val })}
              onRefreshSettings={getAppSettings}
              onReset={() => {
                clearBridgeConfig();
                setConfig(null);
                setShowSetup(true);
              }}
            />
          )}

          {activeTab === "diag" && <BridgeDiagnosticsPanel />}
        </div>
      </div>
    </div>
  );
}

// ─── 1. Live Call Mirror HUD ───

function LiveCallPanel({
  callState,
  currentCall,
  onAccept,
  onReject,
  onHangup,
  onToggleMute,
  onToggleSpeaker,
  onHold,
  onUnhold,
  onToggleRecording,
  phoneOnline,
  recentCalls,
  onDialNumber,
}: {
  callState: CallState;
  currentCall: any;
  onAccept: () => void;
  onReject: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onHold: () => void;
  onUnhold: () => void;
  onToggleRecording: (enable?: boolean) => void;
  phoneOnline: boolean;
  recentCalls: RecentCall[];
  onDialNumber: (num: string) => void;
}) {
  if (!phoneOnline) {
    return (
      <div style={styles.emptyCard} className="rb-glass">
        <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Phone Offline</h3>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 8 }}>
          Your phone is currently in deep sleep or bridge is connecting. It will auto-wake on incoming calls.
        </p>
      </div>
    );
  }

  if (callState === "IDLE" || callState === "DISCONNECTED") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={styles.emptyCard} className="rb-glass">
          <div style={{ fontSize: 48, marginBottom: 8 }}>✨</div>
          <h3 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Ready & Mirrored</h3>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 6 }}>
            Phone call app is actively linked. Any incoming or outgoing calls will appear here in real time.
          </p>
        </div>

        {recentCalls && recentCalls.length > 0 && (
          <div style={styles.card} className="rb-glass">
            <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#D4AF37" }}>Recent Activity</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentCalls.slice(0, 5).map((call, idx) => (
                <div key={idx} style={styles.recentItem}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{call.name || call.number}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                      {call.type === 1 ? "↙️ Incoming" : call.type === 2 ? "↗️ Outgoing" : "❌ Missed"} • {formatDuration(call.duration)}
                    </div>
                  </div>
                  <button onClick={() => onDialNumber(call.number)} style={styles.smallCallBtn}>
                    📞 Call
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const isRinging = callState === "RINGING";
  const isActive = callState === "ACTIVE";
  const isHolding = callState === "HOLDING";
  const isRecording = !!currentCall?.isRecordingActive;

  return (
    <div style={styles.callCard} className="rb-glass">
      {/* Recording indicator */}
      {isRecording && (
        <div style={styles.recordingBanner} className="rb-recording-active">
          🔴 Recording Call to Phone Storage...
        </div>
      )}

      {/* Avatar / Status */}
      <div style={styles.callerAvatar}>
        {currentCall?.callerName ? currentCall.callerName[0].toUpperCase() : "👤"}
      </div>

      <h2 style={{ fontSize: 28, fontWeight: 800, margin: "12px 0 4px 0" }}>
        {currentCall?.callerName || currentCall?.callerNumber || "Unknown Caller"}
      </h2>
      {currentCall?.callerName && (
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", margin: 0 }}>
          {currentCall?.callerNumber}
        </p>
      )}

      <div style={styles.callStateBadge}>
        {isRinging ? "🔔 INCOMING CALL..." : isActive ? `🟢 ACTIVE (${formatDuration(currentCall?.durationSeconds || 0)})` : isHolding ? "⏸️ ON HOLD" : "CONNECTING..."}
      </div>

      {/* Call Actions */}
      <div style={styles.callButtonsRow}>
        {isRinging ? (
          <>
            <button onClick={onAccept} style={styles.acceptBtn}>
              📞 Accept Call
            </button>
            <button onClick={onReject} style={styles.rejectBtn}>
              ✕ Decline
            </button>
          </>
        ) : (
          <>
            <button onClick={onToggleMute} style={currentCall?.isMuted ? styles.controlBtnActive : styles.controlBtn}>
              {currentCall?.isMuted ? "🔇 Unmute" : "🎙️ Mute"}
            </button>
            <button onClick={onToggleSpeaker} style={currentCall?.isSpeakerOn ? styles.controlBtnActive : styles.controlBtn}>
              {currentCall?.isSpeakerOn ? "🔊 Speaker ON" : "🔈 Speaker"}
            </button>
            <button onClick={isHolding ? onUnhold : onHold} style={isHolding ? styles.controlBtnActive : styles.controlBtn}>
              {isHolding ? "▶️ Resume" : "⏸️ Hold"}
            </button>
            <button
              onClick={() => onToggleRecording()}
              style={isRecording ? styles.recordBtnActive : styles.recordBtn}
              title="Record this call to phone"
            >
              {isRecording ? "⏹️ Stop Rec" : "⏺️ Record"}
            </button>
            <button onClick={onHangup} style={styles.hangupBtn}>
              📴 End Call
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 2. Dial Panel ───

function DialPanel({
  number,
  onChange,
  onDial,
  disabled,
}: {
  number: string;
  onChange: (val: string) => void;
  onDial: () => void;
  disabled: boolean;
}) {
  return (
    <div style={styles.dialerCard} className="rb-glass">
      <input
        type="text"
        value={number}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter phone number..."
        style={styles.dialInput}
      />
      <div style={styles.dialGrid}>
        {DIAL_PAD.flat().map((k) => (
          <button key={k} onClick={() => onChange(number + k)} style={styles.dialKey}>
            {k}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button onClick={() => onChange(number.slice(0, -1))} style={styles.clearBtn}>
          ⌫
        </button>
        <button onClick={onDial} disabled={disabled || !number.trim()} style={styles.dialBtn}>
          📞 Call on Phone
        </button>
      </div>
    </div>
  );
}

// ─── 3. Full Call Logs Panel ───

function CallLogsPanel({
  logs,
  onRefresh,
  onCallNumber,
}: {
  logs: FullCallLog[];
  onRefresh: () => void;
  onCallNumber: (num: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "missed" | "incoming" | "outgoing">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (filter === "missed" && l.type !== 3) return false;
      if (filter === "incoming" && l.type !== 1) return false;
      if (filter === "outgoing" && l.type !== 2) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (l.name?.toLowerCase().includes(q) || l.number.includes(q));
      }
      return true;
    });
  }, [logs, filter, search]);

  return (
    <div style={styles.card} className="rb-glass">
      <div style={styles.panelHeader}>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>All Call Logs</h3>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "4px 0 0 0" }}>
            Real-time synced call logs from AuraRing ({logs.length} entries)
          </p>
        </div>
        <button onClick={onRefresh} style={styles.refreshBtn}>
          🔄 Refresh Logs
        </button>
      </div>

      <div style={styles.filterRow}>
        <input
          type="text"
          placeholder="Search logs by name or number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {(["all", "missed", "incoming", "outgoing"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={filter === f ? styles.filterBtnActive : styles.filterBtn}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {filtered.length === 0 ? (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: 32 }}>No call logs found</p>
        ) : (
          filtered.map((log, idx) => (
            <div key={idx} style={styles.logItem}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 22 }}>
                  {log.type === 1 ? "↙️" : log.type === 2 ? "↗️" : log.type === 3 ? "❌" : "🚫"}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{log.name || log.number}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                    {log.number} • {new Date(log.date).toLocaleString()} • {formatDuration(log.duration)}
                  </div>
                </div>
              </div>
              <button onClick={() => onCallNumber(log.number)} style={styles.smallCallBtn}>
                📞 Call
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── 4. Call Recordings Panel ───

function RecordingsPanel({
  recordings,
  currentAudio,
  onFetchAudio,
  onClearAudio,
  onRefresh,
}: {
  recordings: CallRecordingItem[];
  currentAudio: RecordingAudioData | null;
  onFetchAudio: (id: number) => void;
  onClearAudio: () => void;
  onRefresh: () => void;
}) {
  const [activeRecId, setActiveRecId] = useState<number | null>(null);

  const audioBlobUrl = useMemo(() => {
    if (!currentAudio?.audioData) return null;
    const binary = atob(currentAudio.audioData);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: currentAudio.mimeType || "audio/mp4" });
    return URL.createObjectURL(blob);
  }, [currentAudio]);

  const handleDownload = (audio: RecordingAudioData) => {
    const binary = atob(audio.audioData);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: audio.mimeType || "audio/mp4" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = audio.fileName || `recording_${audio.recordingId}.m4a`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.card} className="rb-glass">
      <div style={styles.panelHeader}>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Call Recordings Hub</h3>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "4px 0 0 0" }}>
            Play and download decrypted phone call recordings directly on iPad ({recordings.length} recordings)
          </p>
        </div>
        <button onClick={onRefresh} style={styles.refreshBtn}>
          🔄 Refresh Recordings
        </button>
      </div>

      {/* Audio Player Card */}
      {currentAudio && audioBlobUrl && (
        <div style={styles.playerCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                🎵 Playing: {currentAudio.contactName || currentAudio.number}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                Duration: {formatDuration(currentAudio.durationSeconds)} • {currentAudio.fileName}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => handleDownload(currentAudio)} style={styles.downloadBtn}>
                ⬇️ Download M4A
              </button>
              <button onClick={onClearAudio} style={styles.closeBtn}>
                ✕
              </button>
            </div>
          </div>
          <audio controls autoPlay src={audioBlobUrl} style={{ width: "100%" }} />
        </div>
      )}

      {/* Recordings List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {recordings.length === 0 ? (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: 32 }}>
            No call recordings found on phone
          </p>
        ) : (
          recordings.map((rec) => (
            <div key={rec.id} style={styles.recordingItem}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {rec.customName || rec.contactName || rec.number}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                  {rec.number} • {new Date(rec.timestamp).toLocaleString()} • {formatDuration(rec.durationSeconds)} • {(rec.fileSize / 1024 / 1024).toFixed(1)} MB
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveRecId(rec.id);
                  onFetchAudio(rec.id);
                }}
                style={styles.playBtn}
              >
                {activeRecId === rec.id && currentAudio?.recordingId === rec.id ? "🔊 Playing" : "▶ Play / Download"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── 5. Private Vault Panel ───

function PrivateVaultPanel({
  vaultData,
  onUnlock,
  onCallNumber,
}: {
  vaultData: { history: PrivateVaultEntry[]; privateNumbers: string[] } | null;
  onUnlock: (pin: string) => void;
  onCallNumber: (num: string) => void;
}) {
  const [pin, setPin] = useState("");

  if (!vaultData) {
    return (
      <div style={styles.card} className="rb-glass">
        <div style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
          <h3 style={{ fontSize: 20, fontWeight: 700 }}>Private Vault Locked</h3>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
            Enter your master passcode (878955) to view hidden calls & private contacts.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
            <input
              type="password"
              placeholder="Enter 6-digit PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={styles.pinInput}
            />
            <button onClick={() => onUnlock(pin)} style={styles.primaryBtn}>
              Unlock Vault
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.card} className="rb-glass">
      <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#D4AF37" }}>🔒 Private Call Vault</h3>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "4px 0 16px 0" }}>
        Protected call logs and shielded contact numbers
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {vaultData.history?.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.4)" }}>No private call logs recorded</p>
        ) : (
          vaultData.history.map((h, idx) => (
            <div key={idx} style={styles.logItem}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{h.name || h.number}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                  {h.number} • {new Date(h.timestamp).toLocaleString()} • {formatDuration(h.durationSeconds)}
                </div>
              </div>
              <button onClick={() => onCallNumber(h.number)} style={styles.smallCallBtn}>
                📞 Call
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── 6. Remote Settings Panel ───

function SettingsPanel({
  config,
  remoteSettings,
  onUpdateSetting,
  onRefreshSettings,
  onReset,
}: {
  config: BridgeConfig | null;
  remoteSettings: RemoteAppSettings | null;
  onUpdateSetting: (key: string, val: any) => void;
  onRefreshSettings: () => void;
  onReset: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Remote Phone Settings */}
      <div style={styles.card} className="rb-glass">
        <div style={styles.panelHeader}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Remote Phone Control</h3>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "4px 0 0 0" }}>
              Configure AuraRing settings directly from your iPad
            </p>
          </div>
          <button onClick={onRefreshSettings} style={styles.refreshBtn}>
            🔄 Sync Settings
          </button>
        </div>

        {remoteSettings && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
            <SettingToggle
              title="Auto Record Unknown Calls"
              desc="Automatically start recording when calling or answering an unknown number"
              checked={remoteSettings.autoRecordUnknown}
              onChange={(c) => onUpdateSetting("autoRecordUnknown", c)}
            />
            <SettingToggle
              title="Spam Protection"
              desc="Intelligently detect and block spam incoming callers"
              checked={remoteSettings.spamEnabled}
              onChange={(c) => onUpdateSetting("spamEnabled", c)}
            />
            <SettingToggle
              title="Auto Reply SMS"
              desc="Send predefined quick message when rejecting a call"
              checked={remoteSettings.autoReplyEnabled}
              onChange={(c) => onUpdateSetting("autoReplyEnabled", c)}
            />
            <SettingToggle
              title="Shake Phone to Answer"
              desc="Shake device to automatically pick up ringing call"
              checked={remoteSettings.shakeToAnswer}
              onChange={(c) => onUpdateSetting("shakeToAnswer", c)}
            />
            <SettingToggle
              title="Flip Phone to Reject"
              desc="Turn phone face-down on table to silence or decline"
              checked={remoteSettings.flipToReject}
              onChange={(c) => onUpdateSetting("flipToReject", c)}
            />
          </div>
        )}
      </div>

      {/* Device Connection Settings */}
      <div style={styles.card} className="rb-glass">
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Bridge Device Config</h3>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "4px 0 16px 0" }}>
          Persistent Device ID: <code>{config?.deviceId}</code>
        </p>
        <button onClick={onReset} style={styles.dangerBtn}>
          Disconnect & Re-Pair Device
        </button>
      </div>
    </div>
  );
}

function SettingToggle({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{desc}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 22, height: 22, accentColor: "#D4AF37", cursor: "pointer" }}
      />
    </div>
  );
}

// ─── Setup Screen (1-Step Master Link + QR) ───

function SetupScreen({ onPaired }: { onPaired: (key: string, isPermanent?: boolean) => void }) {
  const [tab, setTab] = useState<"master" | "qr">("master");
  const [masterCode, setMasterCode] = useState("");
  const [pin, setPin] = useState("878955");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleMasterConnect = async () => {
    setError("");
    setLoading(true);
    try {
      let deviceId = `phone_${crypto.randomUUID().slice(0, 8)}`;
      let encryptionKey = "";

      if (masterCode.trim()) {
        try {
          const decoded = JSON.parse(atob(masterCode.trim()));
          if (decoded.deviceId) deviceId = decoded.deviceId;
          if (decoded.key) encryptionKey = decoded.key;
        } catch {
          // If raw json
          const raw = JSON.parse(masterCode.trim());
          if (raw.deviceId) deviceId = raw.deviceId;
          if (raw.key) encryptionKey = raw.key;
        }
      }

      const base = getApiBaseUrl();
      const res = await authenticatedFetch(`${base}/api/remote-bridge/personal-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: pin.trim(),
          deviceId,
          encryptionKey,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to link");
      }

      const data = await res.json();
      onPaired(data.encryptionKey || encryptionKey, true);
    } catch (e: any) {
      setError(e.message || "Master link failed");
    }
    setLoading(false);
  };

  return (
    <div style={styles.setupCard} className="rb-glass">
      <div style={{ fontSize: 44, marginBottom: 12 }}>⚡</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Connect AuraRing Phone Mirror</h2>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: "8px 0 20px 0" }}>
        Directly mirror calls, recordings, and settings on your iPad without ever disconnecting.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => setTab("master")}
          style={tab === "master" ? styles.setupTabActive : styles.setupTab}
        >
          ⚡ 1-Step Master Link (PIN 878955)
        </button>
        <button
          onClick={() => setTab("qr")}
          style={tab === "qr" ? styles.setupTabActive : styles.setupTab}
        >
          📷 Scan QR Code
        </button>
      </div>

      {tab === "master" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", textAlign: "left", margin: 0 }}>
            Paste the Master Code copied from AuraRing (<strong>Settings → Personal Ecosystem</strong>) or connect with PIN 878955:
          </p>
          <textarea
            placeholder="Paste Master Link Code from Phone..."
            value={masterCode}
            onChange={(e) => setMasterCode(e.target.value)}
            style={styles.codeTextarea}
          />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Master PIN:</span>
            <input
              type="text"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={styles.pinInput}
            />
          </div>
          {error && <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>}
          <button onClick={handleMasterConnect} disabled={loading} style={styles.primaryBtn}>
            {loading ? "Connecting..." : "⚡ Activate Permanent Phone Mirror"}
          </button>
        </div>
      ) : (
        <div style={{ padding: 20 }}>
          <QRCodeSVG value="auraring://pair" size={200} bgColor="#121826" fgColor="#FFFFFF" />
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 12 }}>
            Scan with your phone camera
          </p>
        </div>
      )}
    </div>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", background: "#0D1117", color: "#F3F4F6", display: "flex", flexDirection: "column", fontFamily: "sans-serif" },
  headerGroup: { position: "sticky", top: 0, zIndex: 50, background: "rgba(13, 17, 23, 0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  statusBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px" },
  statusLeft: { display: "flex", alignItems: "center", gap: 10 },
  statusRight: { display: "flex", alignItems: "center", gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: "50%", boxShadow: "0 0 10px currentColor" },
  statusText: { fontSize: 15, fontWeight: 700 },
  iconBtn: { background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", cursor: "pointer", borderRadius: 8, padding: "4px 8px" },
  badge: { background: "rgba(255,255,255,0.08)", padding: "4px 10px", borderRadius: 20, fontSize: 12 },
  badgeGold: { background: "rgba(212, 175, 55, 0.15)", border: "1px solid #D4AF37", color: "#D4AF37", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 },
  tabBar: { display: "flex", gap: 8, padding: "0 24px 12px 24px", overflowX: "auto" },
  tab: { background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" },
  tabActive: { background: "rgba(212, 175, 55, 0.2)", color: "#D4AF37", border: "1px solid rgba(212, 175, 55, 0.4)" },
  liveCallPill: { background: "#EF4444", color: "#fff", fontSize: 10, padding: "2px 6px", borderRadius: 10, fontWeight: 800 },
  countPill: { background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 11, padding: "2px 6px", borderRadius: 10 },
  scrollArea: { flex: 1, overflowY: "auto", padding: "24px" },
  content: { maxWidth: 900, margin: "0 auto" },
  card: { padding: 24, borderRadius: 16 },
  emptyCard: { padding: 48, textAlign: "center", borderRadius: 16 },
  callCard: { padding: 40, textAlign: "center", borderRadius: 20 },
  recordingBanner: { background: "#FF3B30", color: "#fff", fontWeight: 700, padding: "6px 14px", borderRadius: 20, display: "inline-block", marginBottom: 16, fontSize: 13 },
  callerAvatar: { width: 100, height: 100, borderRadius: "50%", background: "rgba(212, 175, 55, 0.2)", border: "2px solid #D4AF37", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 800, color: "#D4AF37" },
  callStateBadge: { display: "inline-block", background: "rgba(255,255,255,0.08)", padding: "6px 16px", borderRadius: 20, fontSize: 14, fontWeight: 700, margin: "16px 0 24px 0" },
  callButtonsRow: { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" },
  acceptBtn: { background: "#10B981", color: "#fff", border: "none", padding: "14px 28px", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer" },
  rejectBtn: { background: "#EF4444", color: "#fff", border: "none", padding: "14px 28px", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer" },
  hangupBtn: { background: "#EF4444", color: "#fff", border: "none", padding: "12px 24px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer" },
  controlBtn: { background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  controlBtnActive: { background: "rgba(212, 175, 55, 0.3)", color: "#D4AF37", border: "1px solid #D4AF37", padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  recordBtn: { background: "rgba(239, 68, 68, 0.15)", color: "#EF4444", border: "1px solid #EF4444", padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  recordBtnActive: { background: "#EF4444", color: "#fff", border: "none", padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  recentItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 10 },
  smallCallBtn: { background: "rgba(212, 175, 55, 0.2)", border: "1px solid #D4AF37", color: "#D4AF37", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 },
  dialerCard: { padding: 32, maxWidth: 400, margin: "0 auto", textAlign: "center" },
  dialInput: { width: "100%", padding: "16px", fontSize: 24, textAlign: "center", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, color: "#fff", marginBottom: 20, boxSizing: "border-box" },
  dialGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 },
  dialKey: { padding: "18px 0", fontSize: 22, fontWeight: 700, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", cursor: "pointer" },
  clearBtn: { flex: 1, padding: "14px", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 12, color: "#fff", fontSize: 18, cursor: "pointer" },
  dialBtn: { flex: 3, padding: "14px", background: "#10B981", border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  refreshBtn: { background: "rgba(212, 175, 55, 0.15)", border: "1px solid #D4AF37", color: "#D4AF37", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 },
  filterRow: { display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" },
  searchInput: { flex: 1, minWidth: 200, padding: "10px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" },
  filterBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" },
  filterBtnActive: { background: "#D4AF37", border: "1px solid #D4AF37", color: "#000", padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer" },
  logItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 },
  playerCard: { background: "rgba(212, 175, 55, 0.1)", border: "1px solid #D4AF37", padding: 20, borderRadius: 14, marginBottom: 20 },
  downloadBtn: { background: "#10B981", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 },
  closeBtn: { background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 16 },
  recordingItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 },
  playBtn: { background: "rgba(212, 175, 55, 0.2)", border: "1px solid #D4AF37", color: "#D4AF37", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 },
  pinInput: { width: 140, padding: "10px", fontSize: 18, textAlign: "center", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#fff", letterSpacing: 4 },
  primaryBtn: { background: "#D4AF37", color: "#000", border: "none", padding: "12px 24px", borderRadius: 8, fontWeight: 800, fontSize: 15, cursor: "pointer" },
  dangerBtn: { background: "rgba(239, 68, 68, 0.15)", border: "1px solid #EF4444", color: "#EF4444", padding: "10px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
  setupCard: { maxWidth: 540, margin: "60px auto", padding: 40, textAlign: "center" },
  setupTab: { flex: 1, padding: "10px", background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, color: "rgba(255,255,255,0.6)", fontWeight: 600, cursor: "pointer" },
  setupTabActive: { flex: 1, padding: "10px", background: "#D4AF37", border: "none", borderRadius: 8, color: "#000", fontWeight: 800, cursor: "pointer" },
  codeTextarea: { width: "100%", height: 90, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#fff", padding: 12, fontFamily: "monospace", fontSize: 12, boxSizing: "border-box" },
};
