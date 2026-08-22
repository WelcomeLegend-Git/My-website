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
  type RemotePhotoItem,
  type PhotoDataPayload,
  type ScreenSnapshotPayload,
  type NotificationItem,
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
  const [activeTab, setActiveTab] = useState<"call" | "dial" | "logs" | "recordings" | "photos" | "screen" | "notifications" | "vault" | "settings" | "diag">("call");
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
    getPhotosList,
    fetchPhotoData,
    captureScreenSnapshot,
    clearActivePhoto,
    clearScreenSnapshot,
    clearCurrentAudio,
    getNotificationsList,
    clearAllNotifications,
    deleteNotification,
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
          getNotificationsList();
        }
      }
    } catch {}
    setRefreshing(false);
  }, [authToken, requestStatus, getRecentCalls, getAllCallLogs, getRecordingsList, getAppSettings, getNotificationsList, setPhoneOnline]);

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
            { id: "photos", label: "📸 Photos", count: status.photos?.length },
            { id: "screen", label: "📱 Live Screen" },
            { id: "notifications", label: "🔔 Notifications", count: status.notifications?.length },
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
                if (tab.id === "photos") getPhotosList(0, 40);
                if (tab.id === "screen" && !status.screenSnapshot) captureScreenSnapshot();
                if (tab.id === "notifications") getNotificationsList();
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

          {activeTab === "photos" && (
            <PhotosPanel
              photos={status.photos || []}
              totalPhotosCount={status.totalPhotosCount}
              currentPage={status.photoPage}
              pageSize={status.photoPageSize}
              isLoading={status.isLoadingPhotos}
              currentPhotoData={status.currentPhotoData}
              onRefresh={() => getPhotosList(status.photoPage, 40)}
              onPageChange={(page) => getPhotosList(page, 40)}
              onFetchPhoto={fetchPhotoData}
              onClearPhoto={clearActivePhoto}
              phoneOnline={status.phoneOnline}
            />
          )}

          {activeTab === "screen" && (
            <LiveScreenPanel
              snapshot={status.screenSnapshot}
              isCapturing={status.isCapturingScreen}
              onCapture={captureScreenSnapshot}
              phoneOnline={status.phoneOnline}
            />
          )}

          {activeTab === "notifications" && (
            <NotificationCenterPanel
              notifications={status.notifications || []}
              totalCount={status.totalNotificationsCount}
              isLoading={status.isLoadingNotifications}
              onRefresh={() => getNotificationsList()}
              onClearAll={clearAllNotifications}
              onDeleteNotification={deleteNotification}
              phoneOnline={status.phoneOnline}
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

// ─── 3. Full Call Logs Panel with Contact History Modal ───

function formatCallDateGroup(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const callDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (callDay.getTime() === today.getTime()) return "Today";
  if (callDay.getTime() === yesterday.getTime()) return "Yesterday";

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const diffDays = Math.floor((today.getTime() - callDay.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays < 7) {
    return `${daysOfWeek[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  }
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatCallTime(timestamp: number): string {
  const d = new Date(timestamp);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayStr = days[d.getDay()];
  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  return `${dayStr} ${timeStr}`;
}

function CallLogsPanel({
  logs,
  onRefresh,
  onCallNumber,
}: {
  logs: FullCallLog[];
  onRefresh: () => void;
  onCallNumber: (num: string) => void;
}) {
  const [viewMode, setViewMode] = useState<"all" | "contacts">("all");
  const [filter, setFilter] = useState<"all" | "missed" | "incoming" | "outgoing">("all");
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<{
    name?: string | null;
    number: string;
    contactLogs: FullCallLog[];
  } | null>(null);

  // Filtered chronological logs
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

  // Grouped by Contact
  const contactGroups = useMemo(() => {
    const map = new Map<string, { name?: string | null; number: string; logs: FullCallLog[]; lastDate: number }>();
    logs.forEach((log) => {
      const key = log.number || "Unknown";
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          name: log.name,
          number: log.number,
          logs: [log],
          lastDate: log.date,
        });
      } else {
        existing.logs.push(log);
        if (log.date > existing.lastDate) {
          existing.lastDate = log.date;
        }
        if (!existing.name && log.name) {
          existing.name = log.name;
        }
      }
    });

    let list = Array.from(map.values());
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name?.toLowerCase().includes(q) || c.number.includes(q));
    }
    return list.sort((a, b) => b.lastDate - a.lastDate);
  }, [logs, search]);

  // Open contact history drawer
  const openContactHistory = (number: string, name?: string | null) => {
    const contactLogs = logs.filter((l) => l.number === number);
    setSelectedContact({
      name: name || contactLogs[0]?.name,
      number,
      contactLogs,
    });
  };

  // Group selected contact's logs by date
  const groupedContactLogs = useMemo(() => {
    if (!selectedContact) return [];
    const groups: { dateLabel: string; items: FullCallLog[] }[] = [];
    selectedContact.contactLogs.forEach((log) => {
      const label = formatCallDateGroup(log.date);
      const group = groups.find((g) => g.dateLabel === label);
      if (group) {
        group.items.push(log);
      } else {
        groups.push({ dateLabel: label, items: [log] });
      }
    });
    return groups;
  }, [selectedContact]);

  const contactStats = useMemo(() => {
    if (!selectedContact) return { total: 0, incoming: 0, outgoing: 0, missed: 0, duration: 0 };
    let incoming = 0, outgoing = 0, missed = 0, duration = 0;
    selectedContact.contactLogs.forEach((l) => {
      if (l.type === 1) incoming++;
      else if (l.type === 2) outgoing++;
      else if (l.type === 3) missed++;
      duration += l.duration || 0;
    });
    return {
      total: selectedContact.contactLogs.length,
      incoming,
      outgoing,
      missed,
      duration,
    };
  }, [selectedContact]);

  return (
    <div style={styles.card} className="rb-glass">
      <div style={styles.panelHeader}>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>📋 Full Call Logs & Contact History</h3>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "4px 0 0 0" }}>
            Complete real-time synced call logs from phone ({logs.length.toLocaleString()} calls loaded)
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: 2 }}>
            <button
              onClick={() => setViewMode("all")}
              style={{
                ...(viewMode === "all" ? styles.filterBtnActive : styles.filterBtn),
                padding: "6px 12px",
                fontSize: 12,
              }}
            >
              📜 All Calls
            </button>
            <button
              onClick={() => setViewMode("contacts")}
              style={{
                ...(viewMode === "contacts" ? styles.filterBtnActive : styles.filterBtn),
                padding: "6px 12px",
                fontSize: 12,
              }}
            >
              👥 By Contact ({contactGroups.length})
            </button>
          </div>
          <button onClick={onRefresh} style={styles.refreshBtn}>
            🔄 Refresh
          </button>
        </div>
      </div>

      <div style={styles.filterRow}>
        <input
          type="text"
          placeholder="Search logs by name or number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        {viewMode === "all" && (
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
        )}
      </div>

      {viewMode === "all" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          {filtered.length === 0 ? (
            <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: 32 }}>No call logs found</p>
          ) : (
            filtered.map((log, idx) => (
              <div
                key={idx}
                style={{
                  ...styles.logItem,
                  cursor: "pointer",
                }}
                onClick={() => openContactHistory(log.number, log.name)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 22 }}>
                    {log.type === 1 ? "↙️" : log.type === 2 ? "↗️" : log.type === 3 ? "❌" : "🚫"}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{log.name || log.number}</span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "rgba(212,175,55,0.15)",
                          color: "#D4AF37",
                        }}
                      >
                        📜 History
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                      {log.number} • {new Date(log.date).toLocaleString()} • {formatDuration(log.duration)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCallNumber(log.number);
                  }}
                  style={styles.smallCallBtn}
                >
                  📞 Call
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Grouped by Contact View */
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          {contactGroups.length === 0 ? (
            <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: 32 }}>No contacts found</p>
          ) : (
            contactGroups.map((contact, idx) => (
              <div
                key={idx}
                onClick={() => openContactHistory(contact.number, contact.name)}
                style={{
                  ...styles.logItem,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      background: "rgba(212,175,55,0.2)",
                      border: "1px solid rgba(212,175,55,0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      color: "#D4AF37",
                      fontSize: 16,
                    }}
                  >
                    {(contact.name || contact.number).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{contact.name || contact.number}</span>
                      <span style={{ fontSize: 11, background: "rgba(255,255,255,0.1)", padding: "1px 6px", borderRadius: 10 }}>
                        {contact.logs.length} calls
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                      {contact.number} • Last: {new Date(contact.lastDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openContactHistory(contact.number, contact.name);
                    }}
                    style={{ ...styles.filterBtn, fontSize: 12, padding: "6px 10px" }}
                  >
                    📜 View History
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCallNumber(contact.number);
                    }}
                    style={styles.smallCallBtn}
                  >
                    📞 Call
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Contact History Details Modal (Matching Google Phone UI) ─── */}
      {selectedContact && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(12px)",
            zIndex: 150,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setSelectedContact(null)}
        >
          <div
            style={{
              maxWidth: 480,
              width: "100%",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              background: "#111827",
              borderRadius: 20,
              border: "1px solid rgba(212,175,55,0.35)",
              overflow: "hidden",
              boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Contact Top Header */}
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "rgba(212,175,55,0.25)",
                    border: "2px solid #D4AF37",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    color: "#D4AF37",
                    fontSize: 18,
                  }}
                >
                  {(selectedContact.name || selectedContact.number).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17, color: "#fff" }}>
                    {selectedContact.name || selectedContact.number}
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                    Phone • {selectedContact.number}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={() => {
                    onCallNumber(selectedContact.number);
                    setSelectedContact(null);
                  }}
                  style={{
                    background: "#10B981",
                    color: "#fff",
                    border: "none",
                    borderRadius: 20,
                    padding: "8px 14px",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  📞 Call
                </button>
                <button onClick={() => setSelectedContact(null)} style={styles.closeBtn}>
                  ✕
                </button>
              </div>
            </div>

            {/* Quick Stats Banner */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
                padding: "12px 16px",
                background: "rgba(255,255,255,0.03)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                textAlign: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Total</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#D4AF37" }}>{contactStats.total}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Incoming</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#3B82F6" }}>{contactStats.incoming}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Outgoing</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#10B981" }}>{contactStats.outgoing}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Missed</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#EF4444" }}>{contactStats.missed}</div>
              </div>
            </div>

            {/* Date-Grouped Calls List */}
            <div
              style={{
                padding: "16px 20px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {groupedContactLogs.map((group, gIdx) => (
                <div key={gIdx}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.5)",
                      marginBottom: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {group.dateLabel}
                  </div>

                  <div
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.06)",
                      overflow: "hidden",
                    }}
                  >
                    {group.items.map((item, itemIdx) => {
                      const isIncoming = item.type === 1;
                      const isOutgoing = item.type === 2;
                      const isMissed = item.type === 3;
                      const isRejected = item.type === 4 || item.type === 5;

                      const icon = isIncoming ? "↙️" : isOutgoing ? "↗️" : isMissed ? "❌" : "🚫";
                      const label = isIncoming
                        ? "Incoming call"
                        : isOutgoing
                        ? "Outgoing call"
                        : isMissed
                        ? "Missed call"
                        : "Rejected call";

                      const durationText = isMissed
                        ? "Rang"
                        : item.duration > 0
                        ? formatDuration(item.duration)
                        : "0s";

                      return (
                        <div
                          key={itemIdx}
                          style={{
                            padding: "12px 14px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderBottom:
                              itemIdx < group.items.length - 1
                                ? "1px solid rgba(255,255,255,0.04)"
                                : "none",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 18 }}>{icon}</span>
                            <div>
                              <div
                                style={{
                                  fontSize: 14,
                                  fontWeight: 600,
                                  color: isMissed ? "#EF4444" : "#fff",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <span>{label}</span>
                                {item.duration > 0 && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      background: "rgba(255,255,255,0.1)",
                                      padding: "1px 4px",
                                      borderRadius: 4,
                                      color: "rgba(255,255,255,0.7)",
                                    }}
                                  >
                                    HD
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                                {formatCallTime(item.date)}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: isMissed ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.8)",
                            }}
                          >
                            {durationText}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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

// ─── Photos & Gallery Panel ───

function PhotosPanel({
  photos,
  totalPhotosCount,
  currentPage,
  pageSize,
  isLoading,
  currentPhotoData,
  onRefresh,
  onPageChange,
  onFetchPhoto,
  onClearPhoto,
  phoneOnline,
}: {
  photos: RemotePhotoItem[];
  totalPhotosCount: number;
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  currentPhotoData: PhotoDataPayload | null;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
  onFetchPhoto: (photoId: number) => void;
  onClearPhoto: () => void;
  phoneOnline: boolean;
}) {
  const [selectedPhoto, setSelectedPhoto] = useState<RemotePhotoItem | null>(null);

  const handleDownload = (photoData: PhotoDataPayload) => {
    const link = document.createElement("a");
    link.href = `data:${photoData.mimeType};base64,${photoData.base64Data}`;
    link.download = photoData.displayName || `photo_${photoData.photoId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.max(1, Math.ceil(totalPhotosCount / pageSize));
  const startItem = totalPhotosCount > 0 ? currentPage * pageSize + 1 : 0;
  const endItem = Math.min(totalPhotosCount, (currentPage + 1) * pageSize);

  // Generate visible page numbers
  const getPageNumbers = () => {
    const delta = 2;
    const range: number[] = [];
    for (
      let i = Math.max(0, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }
    return range;
  };

  return (
    <div style={styles.card} className="rb-glass">
      <div style={styles.panelHeader}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: 20 }}>📸 Phone Photos & Gallery</h2>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
            {totalPhotosCount > 0
              ? `Showing photos ${startItem}–${endItem} of ${totalPhotosCount.toLocaleString()}`
              : `${photos.length} photos loaded from phone`}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={!phoneOnline || isLoading}
          style={styles.refreshBtn}
        >
          {isLoading ? "⏳ Loading..." : "🔄 Refresh Photos"}
        </button>
      </div>

      {photos.length === 0 ? (
        <div style={styles.emptyCard}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🖼️</div>
          <h3 style={{ margin: "0 0 8px 0" }}>No photos loaded</h3>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            {!phoneOnline
              ? "Connect your phone to load your photos securely over the bridge."
              : "Tap 'Refresh Photos' to fetch the latest gallery images."}
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 12,
              marginTop: 16,
            }}
          >
            {photos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => {
                  setSelectedPhoto(photo);
                  onFetchPhoto(photo.id);
                }}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  flexDirection: "column",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#D4AF37";
                  e.currentTarget.style.transform = "scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1/1",
                    background: "#161B22",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {photo.thumbnailBase64 ? (
                    <img
                      src={`data:image/jpeg;base64,${photo.thumbnailBase64}`}
                      alt={photo.displayName}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span style={{ fontSize: 32 }}>🖼️</span>
                  )}
                </div>
                <div style={{ padding: 8 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {photo.displayName}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                    {new Date(photo.dateAdded).toLocaleDateString()} • {(photo.size / (1024 * 1024)).toFixed(1)} MB
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                marginTop: 28,
                padding: "16px 0",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => onPageChange(0)}
                disabled={currentPage === 0 || isLoading}
                style={{
                  ...styles.filterBtn,
                  opacity: currentPage === 0 ? 0.4 : 1,
                  padding: "8px 12px",
                }}
                title="First Page"
              >
                « First
              </button>
              <button
                onClick={() => onPageChange(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0 || isLoading}
                style={{
                  ...styles.filterBtn,
                  opacity: currentPage === 0 ? 0.4 : 1,
                  padding: "8px 14px",
                }}
              >
                ‹ Prev
              </button>

              {getPageNumbers().map((p) => (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  disabled={isLoading}
                  style={{
                    ...(p === currentPage ? styles.filterBtnActive : styles.filterBtn),
                    padding: "8px 14px",
                    fontWeight: p === currentPage ? 800 : 600,
                  }}
                >
                  {p + 1}
                </button>
              ))}

              <button
                onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1 || isLoading}
                style={{
                  ...styles.filterBtn,
                  opacity: currentPage >= totalPages - 1 ? 0.4 : 1,
                  padding: "8px 14px",
                }}
              >
                Next ›
              </button>
              <button
                onClick={() => onPageChange(totalPages - 1)}
                disabled={currentPage >= totalPages - 1 || isLoading}
                style={{
                  ...styles.filterBtn,
                  opacity: currentPage >= totalPages - 1 ? 0.4 : 1,
                  padding: "8px 12px",
                }}
                title="Last Page"
              >
                Last »
              </button>
            </div>
          )}
        </>
      )}

      {/* Lightbox Modal */}
      {(selectedPhoto || currentPhotoData) && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(10px)",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => {
            setSelectedPhoto(null);
            onClearPhoto();
          }}
        >
          <div
            style={{
              maxWidth: 900,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "#121826",
              borderRadius: 16,
              border: "1px solid rgba(212,175,55,0.3)",
              overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "100%",
                padding: "12px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                {selectedPhoto?.displayName || currentPhotoData?.displayName || "Photo Viewer"}
              </span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {currentPhotoData && (
                  <button
                    onClick={() => handleDownload(currentPhotoData)}
                    style={styles.downloadBtn}
                  >
                    ⬇️ Download High-Res
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedPhoto(null);
                    onClearPhoto();
                  }}
                  style={styles.closeBtn}
                >
                  ✕
                </button>
              </div>
            </div>

            <div
              style={{
                padding: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                maxHeight: "75vh",
                overflow: "auto",
              }}
            >
              {currentPhotoData ? (
                <img
                  src={`data:${currentPhotoData.mimeType};base64,${currentPhotoData.base64Data}`}
                  alt={currentPhotoData.displayName}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "70vh",
                    borderRadius: 8,
                    objectFit: "contain",
                  }}
                />
              ) : selectedPhoto?.thumbnailBase64 ? (
                <div style={{ textAlign: "center" }}>
                  <img
                    src={`data:image/jpeg;base64,${selectedPhoto.thumbnailBase64}`}
                    alt="Loading..."
                    style={{
                      maxWidth: "100%",
                      maxHeight: "50vh",
                      filter: "blur(4px)",
                      borderRadius: 8,
                    }}
                  />
                  <div style={{ marginTop: 12, fontSize: 13, color: "#D4AF37" }}>
                    ⏳ Fetching full high-resolution image from phone...
                  </div>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: "center", color: "#D4AF37" }}>
                  ⏳ Loading image from phone...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Live Screen Panel ───

function LiveScreenPanel({
  snapshot,
  isCapturing,
  onCapture,
  phoneOnline,
}: {
  snapshot: ScreenSnapshotPayload | null;
  isCapturing: boolean;
  onCapture: () => void;
  phoneOnline: boolean;
}) {
  const handleDownload = () => {
    if (!snapshot?.base64Data) return;
    const link = document.createElement("a");
    link.href = `data:image/jpeg;base64,${snapshot.base64Data}`;
    link.download = `phone_screenshot_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={styles.card} className="rb-glass">
      <div style={styles.panelHeader}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: 20 }}>📱 Live Screen Snapshot</h2>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
            Instant silent phone screen capture powered by Android Accessibility Service
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {snapshot?.base64Data && (
            <button onClick={handleDownload} style={styles.downloadBtn}>
              ⬇️ Save
            </button>
          )}
          <button
            onClick={onCapture}
            disabled={!phoneOnline || isCapturing}
            style={{
              ...styles.primaryBtn,
              opacity: !phoneOnline || isCapturing ? 0.6 : 1,
            }}
          >
            {isCapturing ? "⏳ Capturing..." : "📸 Take Snapshot"}
          </button>
        </div>
      </div>

      {snapshot?.error && (
        <div
          style={{
            padding: 12,
            background: "rgba(239,68,68,0.15)",
            border: "1px solid #EF4444",
            borderRadius: 10,
            color: "#EF4444",
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          ⚠️ {snapshot.error}
        </div>
      )}

      {!snapshot?.base64Data ? (
        <div style={styles.emptyCard}>
          <div style={{ fontSize: 50, marginBottom: 12 }}>📱</div>
          <h3 style={{ margin: "0 0 8px 0" }}>No screen snapshot taken yet</h3>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, maxWidth: 450, margin: "0 auto" }}>
            Click <strong>"Take Snapshot"</strong> above to capture the current active phone display directly from your browser.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <div
            style={{
              maxWidth: 380,
              width: "100%",
              borderRadius: 24,
              border: "4px solid rgba(255,255,255,0.15)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
              overflow: "hidden",
              background: "#000",
            }}
          >
            <img
              src={`data:image/jpeg;base64,${snapshot.base64Data}`}
              alt="Phone Screen Snapshot"
              style={{ width: "100%", display: "block" }}
            />
          </div>
          {snapshot.timestamp && (
            <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              Captured at {new Date(snapshot.timestamp).toLocaleTimeString()} ({snapshot.width} × {snapshot.height}px)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Notification Centre Panel ───

function NotificationCenterPanel({
  notifications,
  totalCount,
  isLoading,
  onRefresh,
  onClearAll,
  onDeleteNotification,
  phoneOnline,
}: {
  notifications: NotificationItem[];
  totalCount: number;
  isLoading: boolean;
  onRefresh: () => void;
  onClearAll: () => void;
  onDeleteNotification: (id: number) => void;
  phoneOnline: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [appFilter, setAppFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "1h" | "today" | "yesterday" | "week">("all");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // App Filter Categories
  const appFilters = [
    { id: "all", label: "All Apps", icon: "📱" },
    { id: "whatsapp", label: "WhatsApp", icon: "💬", color: "#25D366" },
    { id: "w4b", label: "WhatsApp Business", icon: "💼", color: "#128C7E" },
    { id: "instagram", label: "Instagram", icon: "📸", color: "#E1306C" },
    { id: "telegram", label: "Telegram", icon: "✈️", color: "#0088cc" },
    { id: "sms", label: "Messages / SMS", icon: "✉️", color: "#FF8C00" },
    { id: "gmail", label: "Gmail", icon: "📧", color: "#EA4335" },
    { id: "other", label: "Other", icon: "⚙️", color: "#9E9E9E" },
  ];

  // Helper for App Badge Color
  const getAppColor = (pkg: string): string => {
    const p = pkg.toLowerCase();
    if (p.includes("w4b")) return "#128C7E";
    if (p.includes("whatsapp")) return "#25D366";
    if (p.includes("instagram")) return "#E1306C";
    if (p.includes("telegram")) return "#0088cc";
    if (p.includes("messaging") || p.includes("mms")) return "#FF8C00";
    if (p.includes("google.android.gm")) return "#EA4335";
    return "#D4AF37";
  };

  // Helper for App Icon
  const getAppIcon = (pkg: string): string => {
    const p = pkg.toLowerCase();
    if (p.includes("w4b")) return "💼";
    if (p.includes("whatsapp")) return "💬";
    if (p.includes("instagram")) return "📸";
    if (p.includes("telegram")) return "✈️";
    if (p.includes("messaging") || p.includes("mms")) return "✉️";
    if (p.includes("google.android.gm")) return "📧";
    return "🔔";
  };

  // Filtering Logic
  const filteredNotifications = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    return notifications.filter((n) => {
      // 1. Text Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = n.title?.toLowerCase().includes(q);
        const textMatch = n.text?.toLowerCase().includes(q);
        const appMatch = n.appName?.toLowerCase().includes(q);
        const subMatch = n.subText?.toLowerCase().includes(q);
        if (!titleMatch && !textMatch && !appMatch && !subMatch) return false;
      }

      // 2. App Filter
      const p = n.packageName.toLowerCase();
      if (appFilter === "whatsapp" && (!p.includes("whatsapp") || p.includes("w4b"))) return false;
      if (appFilter === "w4b" && !p.includes("w4b")) return false;
      if (appFilter === "instagram" && !p.includes("instagram")) return false;
      if (appFilter === "telegram" && !p.includes("telegram")) return false;
      if (appFilter === "sms" && !p.includes("messaging") && !p.includes("mms")) return false;
      if (appFilter === "gmail" && !p.includes("google.android.gm")) return false;
      if (appFilter === "other") {
        if (
          p.includes("whatsapp") ||
          p.includes("instagram") ||
          p.includes("telegram") ||
          p.includes("messaging") ||
          p.includes("mms") ||
          p.includes("google.android.gm")
        )
          return false;
      }

      // 3. Time Filter
      if (timeFilter === "1h" && n.timestamp < now - 60 * 60 * 1000) return false;
      if (timeFilter === "today" && n.timestamp < todayStart.getTime()) return false;
      if (
        timeFilter === "yesterday" &&
        (n.timestamp < yesterdayStart.getTime() || n.timestamp >= todayStart.getTime())
      )
        return false;
      if (timeFilter === "week" && n.timestamp < now - 7 * 24 * 60 * 60 * 1000) return false;

      return true;
    });
  }, [notifications, searchQuery, appFilter, timeFilter]);

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all notification history? This will delete all saved notification logs from your phone.")) {
      onClearAll();
    }
  };

  return (
    <div style={styles.card} className="rb-glass">
      {/* Header */}
      <div style={styles.panelHeader}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: 20 }}>🔔 Notification History & Centre</h2>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
            {totalCount > 0
              ? `${totalCount.toLocaleString()} notifications recorded (Auto-pruned at 10,000 text / 500 images)`
              : "No notification history recorded yet"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onRefresh}
            disabled={!phoneOnline || isLoading}
            style={styles.refreshBtn}
          >
            {isLoading ? "⏳ Loading..." : "🔄 Refresh"}
          </button>
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              style={{
                ...styles.filterBtn,
                background: "rgba(239, 68, 68, 0.15)",
                color: "#EF4444",
                border: "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              🗑️ Clear All
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div style={{ marginTop: 16 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search notifications, senders, messages, emojis..."
          style={{
            ...styles.input,
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 14px",
            fontSize: 14,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
          }}
        />
      </div>

      {/* App Filter Chips */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          padding: "12px 0 4px 0",
          scrollbarWidth: "none",
        }}
      >
        {appFilters.map((f) => {
          const isActive = appFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setAppFilter(f.id)}
              style={{
                ...(isActive ? styles.filterBtnActive : styles.filterBtn),
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                fontSize: 12,
                borderRadius: 20,
                whiteSpace: "nowrap",
                border: isActive
                  ? `1px solid ${f.color || "#D4AF37"}`
                  : "1px solid rgba(255,255,255,0.08)",
                background: isActive
                  ? "rgba(212,175,55,0.18)"
                  : "rgba(255,255,255,0.04)",
              }}
            >
              <span>{f.icon}</span>
              <span>{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* Time Filter Chips */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          padding: "4px 0 16px 0",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          scrollbarWidth: "none",
        }}
      >
        {[
          { id: "all", label: "All Time" },
          { id: "1h", label: "⏱️ Last 1 Hour" },
          { id: "today", label: "📅 Today" },
          { id: "yesterday", label: "📆 Yesterday" },
          { id: "week", label: "🗓️ This Week" },
        ].map((t) => {
          const isActive = timeFilter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTimeFilter(t.id as any)}
              style={{
                ...(isActive ? styles.filterBtnActive : styles.filterBtn),
                padding: "4px 10px",
                fontSize: 11,
                borderRadius: 14,
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div style={styles.emptyCard}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
          <h3 style={{ margin: "0 0 8px 0" }}>No notifications found</h3>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            {!phoneOnline
              ? "Connect your phone to view live & preserved notification history."
              : searchQuery || appFilter !== "all" || timeFilter !== "all"
              ? "No notifications match your search and filter criteria."
              : "Incoming notifications from WhatsApp, Instagram, SMS, etc., will be preserved here automatically!"}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          {filteredNotifications.map((item) => {
            const appColor = getAppColor(item.packageName);
            const appIcon = getAppIcon(item.packageName);

            return (
              <div
                key={item.id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(212,175,55,0.3)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                }}
              >
                {/* Notification Top Bar */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: `${appColor}22`,
                        color: appColor,
                        border: `1px solid ${appColor}55`,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span>{appIcon}</span>
                      <span>{item.appName}</span>
                    </span>
                    {item.subText && (
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                        • {item.subText}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      • {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => onDeleteNotification(item.id)}
                      title="Delete notification"
                      style={{
                        background: "none",
                        border: "none",
                        color: "rgba(255,255,255,0.3)",
                        cursor: "pointer",
                        fontSize: 14,
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Sender Title */}
                {item.title && (
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                    {item.title}
                  </div>
                )}

                {/* Message Body */}
                {item.text && (
                  <div
                    style={{
                      fontSize: 13.5,
                      color: "rgba(255,255,255,0.85)",
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {item.text}
                  </div>
                )}

                {/* Picture Attachment Thumbnail */}
                {item.hasPicture && item.pictureBase64 && (
                  <div style={{ marginTop: 4 }}>
                    <img
                      src={`data:image/jpeg;base64,${item.pictureBase64}`}
                      alt="Notification Attachment"
                      onClick={() => setPreviewImage(item.pictureBase64!)}
                      style={{
                        maxWidth: 240,
                        maxHeight: 160,
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.1)",
                        cursor: "pointer",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Picture Lightbox Modal */}
      {previewImage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(10px)",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setPreviewImage(null)}
        >
          <div
            style={{
              maxWidth: 700,
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "#121826",
              borderRadius: 16,
              border: "1px solid rgba(212,175,55,0.3)",
              overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "100%",
                padding: "12px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 14 }}>Notification Attachment</span>
              <button onClick={() => setPreviewImage(null)} style={styles.closeBtn}>
                ✕
              </button>
            </div>
            <div style={{ padding: 16 }}>
              <img
                src={`data:image/jpeg;base64,${previewImage}`}
                alt="Full Attachment"
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  borderRadius: 8,
                  objectFit: "contain",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Setup Screen (Dynamic 6-Digit Code & QR) ───

function SetupScreen({ onPaired }: { onPaired: (key: string, isPermanent?: boolean) => void }) {
  const [tab, setTab] = useState<"code" | "qr">("code");
  const [pairingData, setPairingData] = useState<{
    pairingId: string;
    code: string;
    qrPayload: string;
    expiresInSeconds: number;
    encryptionKey: string;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const createSession = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const base = getApiBaseUrl();
      const res = await authenticatedFetch(`${base}/api/remote-bridge/pairing/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "manual" }),
      });
      if (!res.ok) {
        throw new Error("Failed to generate pairing session");
      }
      const data = await res.json();
      setPairingData(data);
      setTimeLeft(data.expiresInSeconds || 300);
    } catch (e: any) {
      setError(e.message || "Failed to generate pairing session");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    createSession();
  }, [createSession]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Polling for phone confirmation
  useEffect(() => {
    if (!pairingData?.pairingId) return;

    let stopped = false;
    const interval = setInterval(async () => {
      if (stopped) return;
      try {
        const base = getApiBaseUrl();
        const res = await authenticatedFetch(
          `${base}/api/remote-bridge/pairing/${pairingData.pairingId}/status`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.status === "confirmed" && !stopped) {
            stopped = true;
            clearInterval(interval);
            const encryptionKey = data.encryptionKey || pairingData.encryptionKey;
            const tabletDeviceId = getOrCreateBridgeDeviceId();

            // Register tablet device
            await authenticatedFetch(`${base}/api/remote-bridge/devices/register`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                deviceId: tabletDeviceId,
                deviceType: "tablet",
                deviceName: "Web Mirror Hub",
                encryptionKey,
              }),
            }).catch(() => {});

            onPaired(encryptionKey, true);
          }
        }
      } catch {}
    }, 1500);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [pairingData?.pairingId, pairingData?.encryptionKey, onPaired]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div style={styles.setupCard} className="rb-glass">
      <div style={{ fontSize: 44, marginBottom: 12 }}>⚡</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Connect AuraRing Phone Mirror</h2>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: "8px 0 24px 0" }}>
        Pair with your phone using a one-time dynamic code or by scanning the QR code.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <button
          onClick={() => setTab("code")}
          style={tab === "code" ? styles.setupTabActive : styles.setupTab}
        >
          ⚡ One-Time 6-Digit Code
        </button>
        <button
          onClick={() => setTab("qr")}
          style={tab === "qr" ? styles.setupTabActive : styles.setupTab}
        >
          📷 Scan QR Code
        </button>
      </div>

      {tab === "code" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center" }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", textAlign: "center", margin: 0 }}>
            Enter this 6-digit code in <strong>AuraRing → Settings → Personal Ecosystem</strong>:
          </p>

          {loading ? (
            <div style={{ padding: 24, fontSize: 16, color: "#D4AF37" }}>Generating unique code...</div>
          ) : pairingData?.code ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%" }}>
              <div
                style={{
                  padding: "16px 28px",
                  fontSize: 36,
                  fontWeight: 900,
                  textAlign: "center",
                  background: "rgba(212, 175, 55, 0.12)",
                  border: "2px solid #D4AF37",
                  borderRadius: 16,
                  color: "#D4AF37",
                  letterSpacing: 12,
                  fontFamily: "monospace",
                  boxShadow: "0 0 20px rgba(212, 175, 55, 0.25)",
                }}
              >
                {pairingData.code}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: timeLeft < 30 ? "#EF4444" : "rgba(255,255,255,0.5)" }}>
                <span>⏱️ Code expires in {formatTimer(timeLeft)}</span>
                {timeLeft === 0 && (
                  <button onClick={createSession} style={styles.iconBtn}>
                    🔄 Refresh Code
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {error && <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{error}</p>}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34D399", animation: "pulse 1.5s infinite" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Waiting for phone connection...</span>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 10 }}>
          {pairingData?.qrPayload ? (
            <div style={{ padding: 16, background: "#fff", borderRadius: 16, display: "inline-block" }}>
              <QRCodeSVG value={pairingData.qrPayload} size={220} bgColor="#FFFFFF" fgColor="#000000" />
            </div>
          ) : (
            <div style={{ padding: 24, color: "#D4AF37" }}>Loading QR...</div>
          )}
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 16 }}>
            In AuraRing app, tap <strong>Scan Website QR Code</strong>
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
