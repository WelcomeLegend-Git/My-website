import { useState, useEffect, useCallback } from "react";
import { useRemoteBridge, type CallState } from "../../lib/use-remote-bridge";
import { getApiBaseUrl } from "../../lib/env";
import { authStorage } from "../../lib/auth-storage";

// ─── Config Storage (persisted in localStorage) ───

const BRIDGE_CONFIG_KEY = "aura-remote-bridge-config";

interface BridgeConfig {
  encryptionKey: string;
  deviceId: string;
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

// ─── Dial Pad Buttons ───

const DIAL_PAD = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

// ─── Page Component ───

export function RemoteBridgePage() {
  const [config, setConfig] = useState<BridgeConfig | null>(loadBridgeConfig);
  const [setupKey, setSetupKey] = useState("");
  const [dialNumber, setDialNumber] = useState("");
  const [showSetup, setShowSetup] = useState(!config);
  const [activeTab, setActiveTab] = useState<"call" | "dial" | "settings">("call");

  const auth = authStorage.getState();
  const authToken = auth.accessToken || "";

  const bridgeOptions = config && authToken
    ? { encryptionKey: config.encryptionKey, deviceId: config.deviceId, authToken }
    : null;

  const bridge = useRemoteBridge(bridgeOptions);
  const { status, acceptCall, rejectCall, hangupCall, toggleMute, toggleSpeaker, holdCall, unholdCall, requestStatus } = bridge;
  const currentCall = status.currentCall;
  const callState: CallState = (currentCall?.callState as CallState) || "IDLE";

  // Generate device ID on first setup
  const handleSetup = useCallback(() => {
    if (!setupKey.trim()) return;
    const deviceId = `tablet_${crypto.randomUUID().slice(0, 12)}`;
    const newConfig: BridgeConfig = { encryptionKey: setupKey.trim(), deviceId };
    saveBridgeConfig(newConfig);
    setConfig(newConfig);
    setShowSetup(false);
  }, [setupKey]);

  // Request status on connect
  useEffect(() => {
    if (status.authenticated && status.phoneOnline) {
      requestStatus();
    }
  }, [status.authenticated, status.phoneOnline]);

  // ─── Setup Screen ───

  if (showSetup || !config) {
    return (
      <div style={styles.container}>
        <div style={styles.setupCard}>
          <div style={styles.setupIcon}>🔗</div>
          <h2 style={styles.setupTitle}>Connect to AuraRing</h2>
          <p style={styles.setupDesc}>
            Enter the E2E encryption key shown in AuraRing → Settings → Remote Bridge on your phone.
          </p>
          <input
            type="text"
            value={setupKey}
            onChange={(e) => setSetupKey(e.target.value)}
            placeholder="Paste encryption key here"
            style={styles.input}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={handleSetup}
            disabled={!setupKey.trim()}
            style={{
              ...styles.primaryBtn,
              opacity: setupKey.trim() ? 1 : 0.5,
            }}
          >
            Connect
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Dashboard ───

  return (
    <div style={styles.container}>
      {/* Status Bar */}
      <div style={styles.statusBar}>
        <div style={styles.statusLeft}>
          <div
            style={{
              ...styles.statusDot,
              backgroundColor: status.connected && status.authenticated
                ? status.phoneOnline ? "#34C759" : "#FF9500"
                : "#FF3B30",
            }}
          />
          <span style={styles.statusText}>
            {!status.connected ? "Disconnected" :
             !status.authenticated ? "Authenticating..." :
             !status.phoneOnline ? "Phone Offline" :
             "Connected"}
          </span>
        </div>
        {currentCall?.bluetoothDeviceName && (
          <div style={styles.btBadge}>
            🎧 {currentCall.bluetoothDeviceName}
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div style={styles.tabBar}>
        {(["call", "dial", "settings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
            }}
          >
            {tab === "call" ? "📞 Calls" : tab === "dial" ? "⌨️ Dial" : "⚙️ Settings"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === "call" && (
          <CallPanel
            callState={callState}
            currentCall={currentCall}
            onAccept={acceptCall}
            onReject={rejectCall}
            onHangup={hangupCall}
            onToggleMute={toggleMute}
            onToggleSpeaker={toggleSpeaker}
            onHold={holdCall}
            onUnhold={unholdCall}
            phoneOnline={status.phoneOnline}
          />
        )}

        {activeTab === "dial" && (
          <DialPanel
            number={dialNumber}
            onChange={setDialNumber}
            onDial={() => {
              if (dialNumber.trim()) {
                bridge.dialNumber(dialNumber.trim());
                setDialNumber("");
              }
            }}
            disabled={!status.phoneOnline}
          />
        )}

        {activeTab === "settings" && (
          <SettingsPanel
            config={config}
            onReset={() => {
              clearBridgeConfig();
              setConfig(null);
              setShowSetup(true);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Call Panel ───

function CallPanel({
  callState,
  currentCall,
  onAccept,
  onReject,
  onHangup,
  onToggleMute,
  onToggleSpeaker,
  onHold,
  onUnhold,
  phoneOnline,
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
  phoneOnline: boolean;
}) {
  if (!phoneOnline) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>📱</div>
        <h3 style={styles.emptyTitle}>Phone Not Connected</h3>
        <p style={styles.emptyDesc}>
          Make sure AuraRing is running and the Remote Bridge is enabled.
        </p>
      </div>
    );
  }

  if (callState === "IDLE" || callState === "DISCONNECTED") {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>✨</div>
        <h3 style={styles.emptyTitle}>No Active Call</h3>
        <p style={styles.emptyDesc}>
          Incoming calls will appear here. Use the Dial tab to make a call.
        </p>
      </div>
    );
  }

  const callerDisplay = currentCall?.callerName || currentCall?.callerNumber || "Unknown";
  const callerNumber = currentCall?.callerName ? currentCall?.callerNumber : null;

  return (
    <div style={styles.callPanel}>
      {/* Caller Info */}
      <div style={styles.callerInfo}>
        <div style={styles.callerAvatar}>
          {callerDisplay.charAt(0).toUpperCase()}
        </div>
        <h2 style={styles.callerName}>{callerDisplay}</h2>
        {callerNumber && <p style={styles.callerNumber}>{callerNumber}</p>}
        <p style={{
          ...styles.callStatus,
          color: callState === "RINGING" ? "#FF9500" :
                 callState === "ACTIVE" ? "#34C759" :
                 callState === "HOLDING" ? "#FF9500" :
                 "#8E8E93"
        }}>
          {callState === "RINGING" ? "📞 Incoming Call..." :
           callState === "ACTIVE" ? `🟢 Active · ${formatDuration(currentCall?.durationSeconds || 0)}` :
           callState === "CONNECTING" ? "📲 Connecting..." :
           callState === "HOLDING" ? "⏸ On Hold" :
           callState}
        </p>
      </div>

      {/* Call Actions */}
      <div style={styles.callActions}>
        {callState === "RINGING" && (
          <>
            <button onClick={onAccept} style={{ ...styles.actionBtn, ...styles.acceptBtn }}>
              ✅ Accept
            </button>
            <button onClick={onReject} style={{ ...styles.actionBtn, ...styles.rejectBtn }}>
              ❌ Reject
            </button>
          </>
        )}

        {(callState === "ACTIVE" || callState === "CONNECTING") && (
          <>
            <button
              onClick={onToggleMute}
              style={{
                ...styles.actionBtn,
                ...styles.controlBtn,
                ...(currentCall?.isMuted ? styles.controlBtnActive : {}),
              }}
            >
              {currentCall?.isMuted ? "🔇 Muted" : "🎤 Mute"}
            </button>
            <button
              onClick={onToggleSpeaker}
              style={{
                ...styles.actionBtn,
                ...styles.controlBtn,
                ...(currentCall?.isSpeakerOn ? styles.controlBtnActive : {}),
              }}
            >
              {currentCall?.isSpeakerOn ? "🔊 Speaker" : "🔈 Speaker"}
            </button>
            <button onClick={onHold} style={{ ...styles.actionBtn, ...styles.controlBtn }}>
              ⏸ Hold
            </button>
            <button onClick={onHangup} style={{ ...styles.actionBtn, ...styles.endBtn }}>
              📞 End Call
            </button>
          </>
        )}

        {callState === "HOLDING" && (
          <>
            <button onClick={onUnhold} style={{ ...styles.actionBtn, ...styles.acceptBtn }}>
              ▶️ Resume
            </button>
            <button onClick={onHangup} style={{ ...styles.actionBtn, ...styles.endBtn }}>
              📞 End Call
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Dial Panel ───

function DialPanel({
  number,
  onChange,
  onDial,
  disabled,
}: {
  number: string;
  onChange: (n: string) => void;
  onDial: () => void;
  disabled: boolean;
}) {
  return (
    <div style={styles.dialPanel}>
      <input
        type="tel"
        value={number}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter number..."
        style={styles.dialInput}
        autoComplete="off"
      />

      <div style={styles.dialPad}>
        {DIAL_PAD.map((row, ri) => (
          <div key={ri} style={styles.dialRow}>
            {row.map((digit) => (
              <button
                key={digit}
                onClick={() => onChange(number + digit)}
                style={styles.dialKey}
              >
                {digit}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div style={styles.dialActions}>
        <button
          onClick={() => onChange(number.slice(0, -1))}
          style={styles.dialDelete}
          disabled={!number}
        >
          ⌫
        </button>
        <button
          onClick={onDial}
          disabled={disabled || !number.trim()}
          style={{
            ...styles.dialCallBtn,
            opacity: disabled || !number.trim() ? 0.4 : 1,
          }}
        >
          📞 Call
        </button>
      </div>
    </div>
  );
}

// ─── Settings Panel ───

function SettingsPanel({
  config,
  onReset,
}: {
  config: BridgeConfig;
  onReset: () => void;
}) {
  const [devices, setDevices] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = authStorage.getAccessToken();
    const base = getApiBaseUrl();
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    try {
      const [devRes, logRes] = await Promise.all([
        fetch(`${base}/api/remote-bridge/devices`, { headers }),
        fetch(`${base}/api/remote-bridge/activity?limit=20`, { headers }),
      ]);
      if (devRes.ok) setDevices(await devRes.json());
      if (logRes.ok) setActivityLogs(await logRes.json());
    } catch (err) {
      console.error("Failed to fetch bridge data:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleKillSwitch = async () => {
    if (!window.confirm("This will disconnect ALL devices and revoke all sessions. Continue?")) return;
    const token = authStorage.getAccessToken();
    const base = getApiBaseUrl();
    await fetch(`${base}/api/remote-bridge/kill-switch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    onReset();
  };

  return (
    <div style={styles.settingsPanel}>
      <div style={styles.settingSection}>
        <h3 style={styles.settingTitle}>Device Info</h3>
        <div style={styles.infoRow}>
          <span>Device ID</span>
          <code style={styles.codeText}>{config.deviceId}</code>
        </div>
        <div style={styles.infoRow}>
          <span>Encryption</span>
          <span style={{ color: "#34C759" }}>✓ AES-256-GCM</span>
        </div>
      </div>

      <div style={styles.settingSection}>
        <h3 style={styles.settingTitle}>Connected Devices</h3>
        {loading ? (
          <p style={styles.loadingText}>Loading...</p>
        ) : devices.length === 0 ? (
          <p style={styles.emptyDesc}>No devices registered</p>
        ) : (
          devices.map((d: any) => (
            <div key={d.id} style={styles.deviceRow}>
              <span>{d.deviceType === "phone" ? "📱" : "📲"} {d.deviceId}</span>
              <span style={{ color: d.trusted ? "#34C759" : "#FF9500", fontSize: 12 }}>
                {d.trusted ? "Trusted" : "Pending"}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={styles.settingSection}>
        <h3 style={styles.settingTitle}>Recent Activity</h3>
        {activityLogs.length === 0 ? (
          <p style={styles.emptyDesc}>No activity logged</p>
        ) : (
          <div style={styles.logList}>
            {activityLogs.slice(0, 10).map((log: any) => (
              <div key={log.id} style={styles.logRow}>
                <span style={styles.logAction}>{log.action}</span>
                <span style={styles.logTime}>
                  {new Date(log.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.settingSection}>
        <h3 style={{ ...styles.settingTitle, color: "#FF3B30" }}>Danger Zone</h3>
        <button onClick={handleKillSwitch} style={styles.killBtn}>
          🚨 Emergency Kill Switch
        </button>
        <button onClick={onReset} style={styles.resetBtn}>
          Reset Connection
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ───

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Styles ───

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #16213e 100%)",
    color: "#fff",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    display: "flex",
    flexDirection: "column",
    maxWidth: 480,
    margin: "0 auto",
  },
  // Status bar
  statusBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  statusLeft: { display: "flex", alignItems: "center", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: "50%" },
  statusText: { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  btBadge: {
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 12,
    background: "rgba(0,122,255,0.15)",
    color: "#0A84FF",
  },
  // Tabs
  tabBar: {
    display: "flex",
    gap: 4,
    padding: "8px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  tab: {
    flex: 1,
    padding: "10px 0",
    border: "none",
    borderRadius: 10,
    background: "transparent",
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  tabActive: {
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
  },
  content: { flex: 1, padding: "16px 20px" },
  // Setup
  setupCard: {
    margin: "auto",
    padding: 40,
    textAlign: "center" as const,
    maxWidth: 380,
  },
  setupIcon: { fontSize: 48, marginBottom: 16 },
  setupTitle: { fontSize: 22, fontWeight: 600, marginBottom: 8 },
  setupDesc: { fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 24, lineHeight: 1.5 },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontSize: 14,
    outline: "none",
    marginBottom: 16,
    boxSizing: "border-box" as const,
  },
  primaryBtn: {
    width: "100%",
    padding: "14px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #6C63FF, #5A52D5)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
  // Empty state
  emptyState: { textAlign: "center" as const, padding: "60px 20px" },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: 600, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 },
  // Call panel
  callPanel: { display: "flex", flexDirection: "column" as const, alignItems: "center", paddingTop: 40 },
  callerInfo: { textAlign: "center" as const, marginBottom: 40 },
  callerAvatar: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6C63FF, #5A52D5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    fontWeight: 700,
    margin: "0 auto 16px",
  },
  callerName: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  callerNumber: { fontSize: 14, color: "rgba(255,255,255,0.5)" },
  callStatus: { fontSize: 14, marginTop: 8, fontWeight: 500 },
  callActions: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 12,
    justifyContent: "center",
    maxWidth: 320,
  },
  actionBtn: {
    padding: "14px 24px",
    borderRadius: 16,
    border: "none",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
    minWidth: 120,
  },
  acceptBtn: { background: "#34C759", color: "#fff" },
  rejectBtn: { background: "#FF3B30", color: "#fff" },
  endBtn: { background: "#FF3B30", color: "#fff", width: "100%" },
  controlBtn: {
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  controlBtnActive: {
    background: "rgba(255,149,0,0.2)",
    borderColor: "#FF9500",
    color: "#FF9500",
  },
  // Dial
  dialPanel: { display: "flex", flexDirection: "column" as const, alignItems: "center" },
  dialInput: {
    width: "100%",
    padding: "16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontSize: 22,
    textAlign: "center" as const,
    outline: "none",
    marginBottom: 20,
    letterSpacing: 2,
    boxSizing: "border-box" as const,
  },
  dialPad: { display: "flex", flexDirection: "column" as const, gap: 10, marginBottom: 20 },
  dialRow: { display: "flex", gap: 10, justifyContent: "center" },
  dialKey: {
    width: 72,
    height: 56,
    borderRadius: 14,
    border: "none",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    fontSize: 22,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.15s",
  },
  dialActions: { display: "flex", gap: 12, width: "100%", maxWidth: 240 },
  dialDelete: {
    flex: 1,
    padding: "14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "transparent",
    color: "#fff",
    fontSize: 18,
    cursor: "pointer",
  },
  dialCallBtn: {
    flex: 2,
    padding: "14px",
    borderRadius: 14,
    border: "none",
    background: "#34C759",
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
  // Settings
  settingsPanel: { display: "flex", flexDirection: "column" as const, gap: 24 },
  settingSection: {
    background: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 16,
  },
  settingTitle: { fontSize: 15, fontWeight: 600, marginBottom: 12, marginTop: 0 },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    fontSize: 13,
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  codeText: {
    fontSize: 11,
    background: "rgba(255,255,255,0.06)",
    padding: "2px 8px",
    borderRadius: 6,
    fontFamily: "monospace",
  },
  deviceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    fontSize: 13,
  },
  loadingText: { fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center" as const },
  logList: { maxHeight: 200, overflowY: "auto" as const },
  logRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    fontSize: 12,
    borderBottom: "1px solid rgba(255,255,255,0.03)",
  },
  logAction: { color: "rgba(255,255,255,0.8)" },
  logTime: { color: "rgba(255,255,255,0.4)" },
  killBtn: {
    width: "100%",
    padding: "14px",
    borderRadius: 12,
    border: "1px solid #FF3B30",
    background: "rgba(255,59,48,0.1)",
    color: "#FF3B30",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: 8,
  },
  resetBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "transparent",
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    cursor: "pointer",
  },
};
