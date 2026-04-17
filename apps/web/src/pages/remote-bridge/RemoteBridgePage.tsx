import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useRemoteBridge, type CallState, type RecentCall } from "../../lib/use-remote-bridge";
import { getApiBaseUrl } from "../../lib/env";
import { authStorage } from "../../lib/auth-storage";

// Inject spin keyframe and responsive styles
if (typeof document !== "undefined" && !document.getElementById("rb-spin-style")) {
  const style = document.createElement("style");
  style.id = "rb-spin-style";
  style.textContent = `
    @keyframes spin { 
      from { transform: rotate(0deg); } 
      to { transform: rotate(360deg); } 
    }
    
    /* Responsive container */
    .rb-container {
      max-width: 480px;
      margin: 0 auto;
    }
    
    @media (min-width: 768px) {
      .rb-container {
        max-width: 720px;
      }
      
      .rb-dial-pad {
        gap: 16px !important;
      }
      
      .rb-dial-key {
        width: 90px !important;
        height: 70px !important;
        font-size: 26px !important;
      }
      
      .rb-call-actions {
        max-width: 480px !important;
      }
      
      .rb-action-btn {
        min-width: 140px !important;
        padding: 16px 28px !important;
        font-size: 16px !important;
      }
      
      .rb-recent-calls-container {
        padding: 0 24px 24px !important;
      }
      
      .rb-settings-panel {
        max-width: 600px;
        margin: 0 auto;
      }
    }
    
    @media (min-width: 1024px) {
      .rb-container {
        max-width: 900px;
      }
      
      .rb-content {
        padding: 24px 32px !important;
      }
      
      .rb-dial-pad {
        gap: 20px !important;
      }
      
      .rb-dial-key {
        width: 100px !important;
        height: 80px !important;
        font-size: 28px !important;
      }
      
      .rb-caller-avatar {
        width: 120px !important;
        height: 120px !important;
        font-size: 48px !important;
      }
      
      .rb-caller-name {
        font-size: 32px !important;
      }
      
      .rb-call-status {
        font-size: 16px !important;
      }
      
      .rb-setup-card {
        max-width: 500px !important;
        padding: 60px !important;
      }
      
      .rb-qr-box svg {
        width: 280px !important;
        height: 280px !important;
      }
    }
    
    @media (min-width: 1280px) {
      .rb-container {
        max-width: 1100px;
      }
      
      .rb-content-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
        align-items: start;
      }
    }
  `;
  document.head.appendChild(style);
}

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
  const [dialNumber, setDialNumber] = useState("");
  const [showSetup, setShowSetup] = useState(!config);
  const [activeTab, setActiveTab] = useState<"call" | "dial" | "settings">("call");
  const [refreshing, setRefreshing] = useState(false);

  const auth = authStorage.getState();
  const authToken = auth.accessToken || "";

  const bridgeOptions = useMemo(() => {
    if (!config || !authToken) return null;
    return { encryptionKey: config.encryptionKey, deviceId: config.deviceId, authToken };
  }, [config?.encryptionKey, config?.deviceId, authToken]);

  const bridge = useRemoteBridge(bridgeOptions);
  const { status, acceptCall, rejectCall, hangupCall, toggleMute, toggleSpeaker, holdCall, unholdCall, requestStatus, getRecentCalls, dialNumber: bridgeDialNumber, setPhoneOnline } = bridge;
  const currentCall = status.currentCall;
  const callState: CallState = (currentCall?.callState as CallState) || "IDLE";

  // Check phone status via REST API (for refresh button & initial load)
  const checkPhoneStatus = useCallback(async () => {
    if (!authToken) return;
    setRefreshing(true);
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/remote-bridge/phone-status`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPhoneOnline(data.phoneOnline);
        if (data.phoneOnline) {
          requestStatus();
          getRecentCalls();
        }
      }
    } catch {}
    setRefreshing(false);
  }, [authToken, requestStatus, getRecentCalls, setPhoneOnline]);

  // QR pairing confirmed callback
  const handleQrPaired = useCallback((encryptionKey: string) => {
    const deviceId = `tablet_${crypto.randomUUID().slice(0, 12)}`;
    const newConfig: BridgeConfig = { encryptionKey, deviceId };
    saveBridgeConfig(newConfig);
    setConfig(newConfig);
    setShowSetup(false);
  }, []);

  // Check phone status on websocket auth + request data when phone is online
  useEffect(() => {
    if (status.authenticated) {
      checkPhoneStatus();
    }
  }, [status.authenticated]);

  useEffect(() => {
    if (status.authenticated && status.phoneOnline) {
      requestStatus();
      getRecentCalls();
    }
  }, [status.authenticated, status.phoneOnline]);

  // Handle service worker messages (Answer/Decline from push notification)
  useEffect(() => {
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === "CALL_ACTION") {
        if (event.data.action === "ACCEPT_CALL") acceptCall();
        if (event.data.action === "REJECT_CALL") rejectCall();
      }
    };
    navigator.serviceWorker?.addEventListener("message", handleSWMessage);

    // Handle ?action=answer from notification click opening new window
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "answer" && status.authenticated) {
      acceptCall();
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }

    return () => {
      navigator.serviceWorker?.removeEventListener("message", handleSWMessage);
    };
  }, [status.authenticated, acceptCall, rejectCall]);

  // ─── Setup Screen (QR + Manual) ───

  if (showSetup || !config) {
    return (
      <div style={styles.container} className="rb-container">
        <SetupScreen
          onQrPaired={handleQrPaired}
        />
      </div>
    );
  }

  // ─── Main Dashboard ───

  return (
    <div style={styles.container} className="rb-container">
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
          {status.connected && status.authenticated && (
            <button
              onClick={checkPhoneStatus}
              disabled={refreshing}
              style={{
                ...styles.refreshBtn,
                ...(refreshing ? { animation: "spin 1s linear infinite" } : {}),
              }}
              title="Refresh connection (check if phone is online)"
            >
              🔄
            </button>
          )}
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
      <div style={styles.content} className="rb-content">
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
  phoneOnline: boolean;
  recentCalls: RecentCall[];
  onDialNumber: (num: string) => void;
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
    if (!recentCalls || recentCalls.length === 0) {
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
    
    return (
      <div style={styles.recentCallsContainer} className="rb-recent-calls-container">
        <h3 style={styles.recentCallsTitle}>Recent Calls</h3>
        <div style={styles.recentCallsList}>
          {recentCalls.map((call, i) => {
            const dateStr = new Date(call.date).toLocaleString([], {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
            });
            const typeIcon = call.type === 1 ? "↙️" : call.type === 2 ? "↗️" : call.type === 3 ? "❌" : "📞";
            const typeColor = call.type === 3 ? "#FF3B30" : "rgba(255,255,255,0.7)";
            
            return (
              <div key={i} style={styles.recentCallItem}>
                <div style={styles.recentCallAvatar}>
                  {(call.name || call.number).charAt(0).toUpperCase()}
                </div>
                <div style={styles.recentCallInfo}>
                  <div style={styles.recentCallName}>{call.name || call.number}</div>
                  <div style={{ ...styles.recentCallMeta, color: typeColor }}>
                    {typeIcon} {dateStr}
                    {call.duration > 0 && ` · ${Math.floor(call.duration / 60)}m ${call.duration % 60}s`}
                  </div>
                </div>
                <button 
                  onClick={() => onDialNumber(call.number)}
                  style={styles.recentCallDialBtn}
                  title={`Call ${call.name || call.number}`}
                >
                  📞
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const callerDisplay = currentCall?.callerName || currentCall?.callerNumber || "Unknown";
  const callerNumber = currentCall?.callerName ? currentCall?.callerNumber : null;

  return (
    <div style={styles.callPanel}>
      {/* Caller Info */}
      <div style={styles.callerInfo}>
        <div style={styles.callerAvatar} className="rb-caller-avatar">
          {callerDisplay.charAt(0).toUpperCase()}
        </div>
        <h2 style={styles.callerName} className="rb-caller-name">{callerDisplay}</h2>
        {callerNumber && <p style={styles.callerNumber}>{callerNumber}</p>}
        <p style={{
          ...styles.callStatus,
          color: callState === "RINGING" ? "#FF9500" :
                 callState === "ACTIVE" ? "#34C759" :
                 callState === "HOLDING" ? "#FF9500" :
                 "#8E8E93"
        }} className="rb-call-status">>
          {callState === "RINGING" ? "📞 Incoming Call..." :
           callState === "ACTIVE" ? `🟢 Active · ${formatDuration(currentCall?.durationSeconds || 0)}` :
           callState === "CONNECTING" ? "📲 Connecting..." :
           callState === "HOLDING" ? "⏸ On Hold" :
           callState}
        </p>
      </div>

      {/* Call Actions */}
      <div style={styles.callActions} className="rb-call-actions">
        {callState === "RINGING" && (
          <>
            <button onClick={onAccept} style={{ ...styles.actionBtn, ...styles.acceptBtn }} className="rb-action-btn">
              ✅ Accept
            </button>
            <button onClick={onReject} style={{ ...styles.actionBtn, ...styles.rejectBtn }} className="rb-action-btn">
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
              className="rb-action-btn"
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
              className="rb-action-btn"
            >
              {currentCall?.isSpeakerOn ? "🔊 Speaker" : "🔈 Speaker"}
            </button>
            <button onClick={onHold} style={{ ...styles.actionBtn, ...styles.controlBtn }} className="rb-action-btn">
              ⏸ Hold
            </button>
            <button onClick={onHangup} style={{ ...styles.actionBtn, ...styles.endBtn }} className="rb-action-btn">
              📞 End Call
            </button>
          </>
        )}

        {callState === "HOLDING" && (
          <>
            <button onClick={onUnhold} style={{ ...styles.actionBtn, ...styles.acceptBtn }} className="rb-action-btn">
              ▶️ Resume
            </button>
            <button onClick={onHangup} style={{ ...styles.actionBtn, ...styles.endBtn }} className="rb-action-btn">
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

      <div style={styles.dialPad} className="rb-dial-pad">
        {DIAL_PAD.map((row, ri) => (
          <div key={ri} style={styles.dialRow}>
            {row.map((digit) => (
              <button
                key={digit}
                onClick={() => onChange(number + digit)}
                style={styles.dialKey}
                className="rb-dial-key"
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
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Push notification state
  const [pushEnabled, setPushEnabled] = useState(false);
  const [phoneToggle, setPhoneToggle] = useState(false);
  const [pushConfigured, setPushConfigured] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = authStorage.getAccessToken();
    const base = getApiBaseUrl();
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    try {
      const [logRes, pushRes] = await Promise.all([
        fetch(`${base}/api/remote-bridge/activity?limit=20`, { headers }),
        fetch(`${base}/api/remote-bridge/push/status`, { headers }),
      ]);
      if (logRes.ok) setActivityLogs(await logRes.json());
      if (pushRes.ok) {
        const pushData = await pushRes.json();
        setPhoneToggle(pushData.phoneToggle);
        setPushEnabled(pushData.tabletToggle);
        setPushConfigured(pushData.pushConfigured);

        // Auto-recover: if browser has a push subscription but server doesn't, re-send it
        if (!pushData.hasSubscription && pushData.pushConfigured && "serviceWorker" in navigator) {
          try {
            const registration = await navigator.serviceWorker.ready;
            const existingSub = await registration.pushManager.getSubscription();
            if (existingSub) {
              const resubRes = await fetch(`${base}/api/remote-bridge/push/subscribe`, {
                method: "POST",
                headers,
                body: JSON.stringify({ subscription: existingSub.toJSON() }),
              });
              if (resubRes.ok) {
                const resubData = await resubRes.json();
                setPushEnabled(true);
                setPhoneToggle(resubData.phoneToggle);
              }
            }
          } catch (err) {
            console.warn("Push auto-recovery failed:", err);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch bridge data:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll push status every 5 seconds for live updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const token = authStorage.getAccessToken();
        const base = getApiBaseUrl();
        const res = await fetch(`${base}/api/remote-bridge/push/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPhoneToggle(data.phoneToggle);
          setPushConfigured(data.pushConfigured);
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to push notifications
  const handlePushToggle = async (enabled: boolean) => {
    setPushLoading(true);
    const token = authStorage.getAccessToken();
    const base = getApiBaseUrl();
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    try {
      if (enabled) {
        // 1. Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          alert("Notification permission denied. Please enable it in browser settings.");
          setPushLoading(false);
          return;
        }

        // 2. Get VAPID key
        const vapidRes = await fetch(`${base}/api/remote-bridge/push/vapid-key`, { headers });
        if (!vapidRes.ok) {
          alert("Push notifications not configured on server. Contact admin.");
          setPushLoading(false);
          return;
        }
        const { vapidPublicKey } = await vapidRes.json();

        // 3. Get push subscription from service worker
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as any,
        });

        // 4. Send subscription to server
        const subRes = await fetch(`${base}/api/remote-bridge/push/subscribe`, {
          method: "POST",
          headers,
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });

        if (subRes.ok) {
          const data = await subRes.json();
          setPushEnabled(true);
          setPhoneToggle(data.phoneToggle);
        }
      } else {
        // Unsubscribe
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) await subscription.unsubscribe();

        await fetch(`${base}/api/remote-bridge/push/unsubscribe`, {
          method: "POST",
          headers,
        });

        setPushEnabled(false);
      }
    } catch (err) {
      console.error("Push toggle error:", err);
      alert("Failed to toggle push notifications.");
    }
    setPushLoading(false);
  };

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
    <div style={styles.settingsPanel} className="rb-settings-panel">
      {/* ─── Background Notifications Toggle ─── */}
      <div style={styles.settingSection}>
        <h3 style={styles.settingTitle}>🔔 Background Notifications</h3>
        <p style={{ color: "#8E8E93", fontSize: 12, margin: "0 0 12px" }}>
          Get notified of incoming calls even when this tab is in the background or closed.
          Both toggles must be ON for notifications to work.
        </p>

        {/* Tablet Toggle */}
        <div style={{ ...styles.infoRow, cursor: "pointer" }} onClick={() => !pushLoading && handlePushToggle(!pushEnabled)}>
          <span>📲 This iPad (Background Alerts)</span>
          <div style={{
            width: 44, height: 24, borderRadius: 12,
            backgroundColor: pushEnabled ? "#34C759" : "#38383A",
            display: "flex", alignItems: "center", padding: "0 2px",
            justifyContent: pushEnabled ? "flex-end" : "flex-start",
            transition: "all 0.2s",
            opacity: pushLoading ? 0.5 : 1,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 10,
              backgroundColor: "#fff",
            }} />
          </div>
        </div>

        {/* Phone Toggle Status (read-only on web) */}
        <div style={styles.infoRow}>
          <span>📱 Phone (Allow iPad Alerts)</span>
          <span style={{ color: phoneToggle ? "#34C759" : "#FF9500", fontSize: 13, fontWeight: 600 }}>
            {phoneToggle ? "✓ ON" : "✕ OFF"}
          </span>
        </div>

        {/* Live Status Indicator */}
        <div style={{
          marginTop: 8, padding: "8px 12px", borderRadius: 8,
          backgroundColor: (pushEnabled && phoneToggle) ? "rgba(52,199,89,0.15)" :
                           (!pushEnabled && !phoneToggle) ? "rgba(142,142,147,0.15)" :
                           "rgba(255,149,0,0.15)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>
            {(pushEnabled && phoneToggle) ? "🟢" : (!pushEnabled && !phoneToggle) ? "⚪" : "⚠️"}
          </span>
          <span style={{ color: "#E5E5EA", fontSize: 12 }}>
            {(pushEnabled && phoneToggle) ? "Background notifications active — you'll receive call alerts" :
             (!pushEnabled && !phoneToggle) ? "Background notifications disabled on both devices" :
             pushEnabled && !phoneToggle ? "Phone toggle is OFF — enable it from AuraRing app to receive alerts" :
             "iPad toggle is OFF — enable it above to receive background alerts"}
          </span>
        </div>

        {!pushConfigured && (
          <p style={{ color: "#FF9500", fontSize: 11, marginTop: 8 }}>
            ⚠️ VAPID keys not configured on server. Push won't work until admin sets them up.
          </p>
        )}
      </div>

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

// Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}


// ─── Setup Screen (WhatsApp-style QR + Manual) ───

function SetupScreen({
  onQrPaired,
}: {
  onQrPaired: (encryptionKey: string) => void;
}) {
  const [setupTab, setSetupTab] = useState<"qr" | "manual">("qr");
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(60); // 1 min countdown
  const pairingIdRef = useRef<string | null>(null);
  const encryptionKeyRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  // Create pairing session & generate QR
  const createPairingSession = useCallback(async () => {
    setQrLoading(true);
    setQrError(null);
    setTimeLeft(60);

    const token = authStorage.getAccessToken();
    const base = getApiBaseUrl();

    try {
      const res = await fetch(`${base}/api/remote-bridge/pairing/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error("Failed to create pairing session");

      const data = await res.json();
      pairingIdRef.current = data.pairingId;
      encryptionKeyRef.current = data.encryptionKey;

      // QR payload: compact JSON
      const qrPayload = JSON.stringify({
        s: base,                   // server URL
        p: data.pairingId,         // pairing ID
        t: data.pairingToken,      // one-time pairing token
        k: data.encryptionKey,     // E2E encryption key
      });

      setQrData(qrPayload);
      setQrLoading(false);

      // Start polling for confirmation
      startPolling(data.pairingId, data.encryptionKey);

      // Start countdown
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Expired, stop countdown, do NOT auto-refresh
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0; // Stays at 0 until user manually refreshes
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setQrError("Failed to generate code. Check your connection.");
      setQrLoading(false);
    }
  }, []);

  // Poll server for pairing confirmation
  const startPolling = useCallback((pairingId: string, encryptionKey: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      const token = authStorage.getAccessToken();
      const base = getApiBaseUrl();

      try {
        const res = await fetch(`${base}/api/remote-bridge/pairing/${pairingId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.status === "confirmed") {
            // Phone scanned the QR! 🎉
            clearInterval(pollIntervalRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
            onQrPaired(encryptionKey);
          } else if (data.status === "expired") {
            clearInterval(pollIntervalRef.current);
            // Do NOT auto-refresh. Let user click 'Refresh' manually
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000); // Poll every 2 seconds
  }, [onQrPaired, createPairingSession]);

  // Initialize on mount
  useEffect(() => {
    if (setupTab === "qr") {
      createPairingSession();
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [setupTab]);

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div style={styles.setupCard}>
      <div style={styles.setupIcon}>🔗</div>
      <h2 style={styles.setupTitle}>Connect to AuraRing</h2>
      <p style={styles.setupDesc}>
        Pair your phone with this device to control calls remotely.
      </p>

      {/* Tab Switcher */}
      <div style={styles.setupTabs}>
        <button
          onClick={() => setSetupTab("qr")}
          style={{
            ...styles.setupTabBtn,
            ...(setupTab === "qr" ? styles.setupTabBtnActive : {}),
          }}
        >
          📷 Scan QR Code
        </button>
        <button
          onClick={() => setSetupTab("manual")}
          style={{
            ...styles.setupTabBtn,
            ...(setupTab === "manual" ? styles.setupTabBtnActive : {}),
          }}
        >
          ⌨️ Enter Key
        </button>
      </div>

      {/* QR Tab */}
      {setupTab === "qr" && (
        <div style={styles.qrContainer}>
          {qrLoading ? (
            <div style={styles.qrPlaceholder}>
              <div style={styles.qrSpinner}>⏳</div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                Generating secure QR code...
              </p>
            </div>
          ) : qrError ? (
            <div style={styles.qrPlaceholder}>
              <p style={{ color: "#FF3B30", fontSize: 14, marginBottom: 16 }}>{qrError}</p>
              <button onClick={createPairingSession} style={styles.refreshBtn}>
                🔄 Retry
              </button>
            </div>
          ) : timeLeft === 0 ? (
            <div style={styles.qrPlaceholder}>
              <p style={{ color: "#FF3B30", fontSize: 14, marginBottom: 16 }}>Code Expired</p>
              <button onClick={createPairingSession} style={styles.refreshBtn}>
                🔄 Generate New
              </button>
            </div>
          ) : (
            <>
              <div style={styles.qrBox} className="rb-qr-box">
                <QRCodeSVG
                  value={qrData || ""}
                  size={220}
                  bgColor="#ffffff"
                  fgColor="#0a0a1a"
                  level="Q"
                  marginSize={2}
                  style={{ borderRadius: 12 }}
                />
              </div>

              <div style={styles.qrInfo}>
                <p style={styles.qrInstruction}>
                  Open <strong>AuraRing</strong> → Settings → Remote Bridge → <strong>Scan QR</strong>
                </p>
                <div style={styles.qrTimer}>
                  <span style={{
                    color: timeLeft < 60 ? "#FF3B30" : "rgba(255,255,255,0.5)",
                    fontSize: 12,
                  }}>
                    Expires in {formatCountdown(timeLeft)}
                  </span>
                  <button
                    onClick={createPairingSession}
                    style={styles.refreshBtn}
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Manual Tab */}
      {setupTab === "manual" && (
        <div style={{ marginTop: 20 }}>
          <p style={{ ...styles.setupDesc, marginBottom: 16 }}>
            Copy this connection code and paste it into the <strong>Manual Login</strong> section of the AuraRing app.
          </p>
          
          {qrLoading ? (
             <div style={styles.qrPlaceholder}>
               <div style={styles.qrSpinner}>⏳</div>
               <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Generating code...</p>
             </div>
          ) : timeLeft === 0 ? (
             <div style={styles.qrPlaceholder}>
               <p style={{ color: "#FF3B30", fontSize: 14, marginBottom: 16 }}>Code Expired</p>
               <button onClick={createPairingSession} style={styles.refreshBtn}>
                 🔄 Generate New
               </button>
             </div>
          ) : qrError ? (
             <div style={styles.qrPlaceholder}>
               <p style={{ color: "#FF3B30", fontSize: 14, marginBottom: 16 }}>{qrError}</p>
               <button onClick={createPairingSession} style={styles.refreshBtn}>🔄 Retry</button>
             </div>
          ) : (
            <>
              <div 
                style={{
                  background: "rgba(255,255,255,0.05)",
                  padding: 16,
                  borderRadius: 12,
                  wordBreak: "break-all",
                  fontSize: 13,
                  fontFamily: "monospace",
                  color: "#E5E5EA",
                  border: "1px solid rgba(255,255,255,0.1)",
                  marginBottom: 16
                }}
              >
                {btoa(qrData || "")}
              </div>
              
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(btoa(qrData || ""));
                    alert("Copied to clipboard!");
                  }}
                  style={{ ...styles.primaryBtn, flex: 1 }}
                >
                  📋 Copy Code
                </button>
              </div>

              <div style={styles.qrTimer}>
                <span style={{ color: timeLeft < 60 ? "#FF3B30" : "rgba(255,255,255,0.5)", fontSize: 12 }}>
                  Expires in {formatDuration(timeLeft)}
                </span>
              </div>
            </>
          )}
        </div>
      )}
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
    width: "100%",
    margin: "0 auto",
  },
  // Status bar
  statusBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    flexWrap: "wrap" as const,
    gap: 12,
  },
  statusLeft: { display: "flex", alignItems: "center", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: "50%" },
  statusText: { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  refreshBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    padding: "2px 6px",
    borderRadius: 8,
    transition: "transform 0.2s",
    opacity: 0.7,
  },
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
    maxWidth: 420,
    width: "100%",
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
  // Recent Calls
  recentCallsContainer: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    width: "100%",
    padding: "0 16px 16px",
    boxSizing: "border-box" as const,
  },
  recentCallsTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 16,
    color: "#fff",
  },
  recentCallsList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    overflowY: "auto" as const,
    paddingBottom: 24,
  },
  recentCallItem: {
    display: "flex",
    alignItems: "center",
    padding: "12px",
    background: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.05)",
  },
  recentCallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 600,
    color: "#fff",
    marginRight: 12,
    flexShrink: 0,
  },
  recentCallInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    overflow: "hidden" as const,
  },
  recentCallName: {
    fontSize: 16,
    fontWeight: 500,
    color: "#fff",
    whiteSpace: "nowrap" as const,
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    marginBottom: 2,
  },
  recentCallMeta: {
    fontSize: 13,
  },
  recentCallDialBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: "rgba(52, 199, 89, 0.15)",
    border: "none",
    color: "#34C759",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    cursor: "pointer",
    marginLeft: 12,
    flexShrink: 0,
    transition: "transform 0.1s, background 0.2s",
  },
  // Dial
  dialPanel: { display: "flex", flexDirection: "column" as const, alignItems: "center", width: "100%" },
  dialInput: {
    width: "100%",
    maxWidth: 400,
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
  dialActions: { display: "flex", gap: 12, width: "100%", maxWidth: 320 },
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
  // Setup tabs (QR / Manual)
  setupTabs: {
    display: "flex",
    gap: 6,
    marginBottom: 4,
    background: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 4,
  },
  setupTabBtn: {
    flex: 1,
    padding: "10px 0",
    border: "none",
    borderRadius: 10,
    background: "transparent",
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: 500 as const,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  setupTabBtnActive: {
    background: "rgba(108,99,255,0.2)",
    color: "#fff",
  },
  // QR code
  qrContainer: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    marginTop: 20,
  },
  qrPlaceholder: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    width: 260,
    height: 260,
  },
  qrSpinner: { fontSize: 32, marginBottom: 12, animation: "spin 2s linear infinite" },
  qrBox: {
    padding: 16,
    borderRadius: 16,
    background: "#ffffff",
    boxShadow: "0 0 40px rgba(108,99,255,0.15), 0 0 80px rgba(108,99,255,0.05)",
  },
  qrInfo: {
    marginTop: 20,
    textAlign: "center" as const,
  },
  qrInstruction: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 1.6,
    marginBottom: 12,
  },
  qrTimer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  refreshBtn: {
    padding: "6px 14px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "transparent",
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.2s",
  },
};
