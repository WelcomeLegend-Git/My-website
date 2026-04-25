import { useState, useEffect, useCallback } from "react";
import { authenticatedFetch } from "../../lib/auth-fetch";

interface DiagLog {
  id: string;
  source: string;
  event: string;
  details: string | null;
  createdAt: string;
}

export function BridgeDiagnosticsPanel() {
  const [logs, setLogs] = useState<DiagLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authenticatedFetch("/api/remote-bridge/diagnostics?limit=300");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch diagnostics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearLogs = useCallback(async () => {
    try {
      await authenticatedFetch("/api/remote-bridge/diagnostics", { method: "DELETE" });
      setLogs([]);
    } catch (err) {
      console.error("Failed to clear diagnostics:", err);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 10_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const sourceColor = (source: string) => {
    switch (source) {
      case "server": return "#60a5fa";   // blue
      case "phone": return "#34d399";    // green
      case "tablet": return "#c084fc";   // purple
      default: return "#9ca3af";         // gray
    }
  };

  const eventColor = (event: string) => {
    if (event.includes("FAIL") || event.includes("ERROR")) return "#f87171";
    if (event.includes("DISCONNECT") || event.includes("CLOSED")) return "#fb923c";
    if (event.includes("CONNECT") || event.includes("AUTH_OK")) return "#34d399";
    if (event.includes("CALL_STATE") || event.includes("CALL_SIGNAL")) return "#fbbf24";
    if (event.includes("WAKE") || event.includes("FCM")) return "#818cf8";
    return "#e2e8f0";
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }) + "." + String(d.getMilliseconds()).padStart(3, "0");
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  // Group logs by date
  const groupedByDate: Record<string, DiagLog[]> = {};
  for (const log of logs) {
    const dateKey = formatDate(log.createdAt);
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(log);
  }

  return (
    <div style={{
      background: "rgba(0, 0, 0, 0.3)",
      borderRadius: "16px",
      border: "1px solid rgba(255,255,255,0.08)",
      padding: "20px",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: "13px",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "16px",
        flexWrap: "wrap",
        gap: "10px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>🔍</span>
          <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "15px", fontFamily: "system-ui" }}>
            Bridge Diagnostics
          </span>
          <span style={{
            background: autoRefresh ? "rgba(52, 211, 153, 0.2)" : "rgba(156, 163, 175, 0.2)",
            color: autoRefresh ? "#34d399" : "#9ca3af",
            padding: "2px 8px",
            borderRadius: "9999px",
            fontSize: "11px",
          }}>
            {autoRefresh ? "● LIVE" : "○ PAUSED"}
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setAutoRefresh((a) => !a)}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              padding: "6px 12px",
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: "12px",
              fontFamily: "system-ui",
            }}
          >
            {autoRefresh ? "⏸ Pause" : "▶ Resume"}
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            style={{
              background: "rgba(96, 165, 250, 0.15)",
              border: "1px solid rgba(96, 165, 250, 0.3)",
              borderRadius: "8px",
              padding: "6px 12px",
              color: "#60a5fa",
              cursor: "pointer",
              fontSize: "12px",
              fontFamily: "system-ui",
            }}
          >
            🔄 Refresh
          </button>
          <button
            onClick={clearLogs}
            style={{
              background: "rgba(248, 113, 113, 0.1)",
              border: "1px solid rgba(248, 113, 113, 0.2)",
              borderRadius: "8px",
              padding: "6px 12px",
              color: "#f87171",
              cursor: "pointer",
              fontSize: "12px",
              fontFamily: "system-ui",
            }}
          >
            🗑 Clear
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex",
        gap: "16px",
        marginBottom: "12px",
        fontSize: "11px",
        fontFamily: "system-ui",
      }}>
        <span><span style={{ color: "#60a5fa" }}>●</span> Server</span>
        <span><span style={{ color: "#34d399" }}>●</span> Phone</span>
        <span><span style={{ color: "#c084fc" }}>●</span> Tablet</span>
      </div>

      {/* Logs */}
      <div style={{
        maxHeight: "500px",
        overflowY: "auto",
        borderRadius: "8px",
        background: "rgba(0, 0, 0, 0.4)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}>
        {logs.length === 0 ? (
          <div style={{
            padding: "40px",
            textAlign: "center",
            color: "#6b7280",
            fontFamily: "system-ui",
          }}>
            No diagnostic logs yet. Connect your phone and use the bridge — events will appear here automatically.
          </div>
        ) : (
          Object.entries(groupedByDate).map(([date, dateLogs]) => (
            <div key={date}>
              {/* Date separator */}
              <div style={{
                padding: "6px 12px",
                background: "rgba(255,255,255,0.03)",
                color: "#6b7280",
                fontSize: "11px",
                fontWeight: 600,
                fontFamily: "system-ui",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                position: "sticky",
                top: 0,
                zIndex: 1,
              }}>
                {date} — {dateLogs.length} events
              </div>
              {dateLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: "flex",
                    gap: "8px",
                    padding: "5px 12px",
                    borderBottom: "1px solid rgba(255,255,255,0.02)",
                    alignItems: "baseline",
                    lineHeight: "1.5",
                  }}
                >
                  {/* Time */}
                  <span style={{ color: "#6b7280", flexShrink: 0, fontSize: "11px" }}>
                    {formatTime(log.createdAt)}
                  </span>
                  {/* Source badge */}
                  <span style={{
                    color: sourceColor(log.source),
                    flexShrink: 0,
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    width: "48px",
                    textAlign: "center",
                  }}>
                    {log.source}
                  </span>
                  {/* Event */}
                  <span style={{
                    color: eventColor(log.event),
                    fontWeight: 600,
                    flexShrink: 0,
                  }}>
                    {log.event}
                  </span>
                  {/* Details */}
                  {log.details && (
                    <span style={{ color: "#9ca3af", wordBreak: "break-all" }}>
                      {log.details}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: "8px",
        color: "#4b5563",
        fontSize: "11px",
        fontFamily: "system-ui",
        textAlign: "right",
      }}>
        {logs.length} events • Auto-refreshes every 10s when live
      </div>
    </div>
  );
}
