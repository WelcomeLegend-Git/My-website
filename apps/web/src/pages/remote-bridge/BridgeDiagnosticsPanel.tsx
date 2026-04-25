import { useState, useEffect, useCallback } from "react";
import { authenticatedFetch } from "../../lib/auth-fetch";
import { getApiBaseUrl } from "../../lib/env";

interface DiagLog {
  id: string;
  source: string;
  event: string;
  details: string | null;
  createdAt: string;
}

type TimeFilter = "1h" | "2h" | "3h" | "6h" | "1w" | "all";

const TIME_FILTERS: { key: TimeFilter; label: string; hours: number | null }[] = [
  { key: "1h", label: "1 Hr", hours: 1 },
  { key: "2h", label: "2 Hr", hours: 2 },
  { key: "3h", label: "3 Hr", hours: 3 },
  { key: "6h", label: "6 Hr", hours: 6 },
  { key: "1w", label: "Week", hours: 24 * 7 },
  { key: "all", label: "All", hours: null },
];

export function BridgeDiagnosticsPanel() {
  const [logs, setLogs] = useState<DiagLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("3h");
  const [copied, setCopied] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const filter = TIME_FILTERS.find((f) => f.key === timeFilter);
      const base = getApiBaseUrl();
      let url = `${base}/api/remote-bridge/diagnostics`;
      if (filter?.hours) {
        const since = new Date(Date.now() - filter.hours * 3600_000).toISOString();
        url += `?since=${since}`;
      }
      const res = await authenticatedFetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch diagnostics:", err);
    } finally {
      setLoading(false);
    }
  }, [timeFilter]);

  const clearLogs = useCallback(async () => {
    try {
      await authenticatedFetch(`${getApiBaseUrl()}/api/remote-bridge/diagnostics`, { method: "DELETE" });
      setLogs([]);
    } catch (err) {
      console.error("Failed to clear diagnostics:", err);
    }
  }, []);

  const testPing = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${getApiBaseUrl()}/api/remote-bridge/diagnostics/test`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setTestResult(`✅ Write OK! (${data.totalLogs} total logs)`);
        fetchLogs(); // Refresh to show the test entry
      } else {
        setTestResult(`❌ Write FAILED: ${data.error}`);
      }
    } catch (err: any) {
      setTestResult(`❌ Request failed: ${err.message}`);
    }
    setTimeout(() => setTestResult(null), 5000);
  }, [fetchLogs]);

  const copyLogs = useCallback(() => {
    const text = logs
      .slice()
      .reverse() // oldest first for reading
      .map((l) => {
        const t = new Date(l.createdAt).toLocaleString("en-IN", {
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          hour12: false, day: "2-digit", month: "short",
        });
        return `[${t}] [${l.source.toUpperCase()}] ${l.event}${l.details ? " " + l.details : ""}`;
      })
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [logs]);

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
      case "server": return "#60a5fa";
      case "phone": return "#34d399";
      case "tablet": return "#c084fc";
      default: return "#9ca3af";
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
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }) + "." + String(d.getMilliseconds()).padStart(3, "0");
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" });
  };

  // Group logs by date
  const groupedByDate: Record<string, DiagLog[]> = {};
  for (const log of logs) {
    const dateKey = formatDate(log.createdAt);
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(log);
  }

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    background: active ? "rgba(96, 165, 250, 0.25)" : "rgba(255,255,255,0.06)",
    border: active ? "1px solid rgba(96, 165, 250, 0.5)" : "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    padding: "5px 10px",
    color: active ? "#60a5fa" : "#e2e8f0",
    cursor: "pointer",
    fontSize: "12px",
    fontFamily: "system-ui",
    transition: "all 0.2s",
  });

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
        marginBottom: "12px",
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
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button onClick={() => setAutoRefresh((a) => !a)} style={btnStyle()}>
            {autoRefresh ? "⏸ Pause" : "▶ Resume"}
          </button>
          <button onClick={fetchLogs} disabled={loading} style={btnStyle()}>
            🔄 Refresh
          </button>
          <button onClick={copyLogs} style={btnStyle()}>
            {copied ? "✅ Copied!" : "📋 Copy"}
          </button>
          <button onClick={clearLogs} style={{
            ...btnStyle(),
            background: "rgba(248, 113, 113, 0.1)",
            border: "1px solid rgba(248, 113, 113, 0.2)",
            color: "#f87171",
          }}>
            🗑 Clear
          </button>
          <button onClick={testPing} style={{
            ...btnStyle(),
            background: "rgba(251, 191, 36, 0.1)",
            border: "1px solid rgba(251, 191, 36, 0.2)",
            color: "#fbbf24",
          }}>
            🧪 Test
          </button>
        </div>
      </div>
      {testResult && (
        <div style={{
          padding: "8px 12px",
          marginBottom: "12px",
          borderRadius: "8px",
          background: testResult.startsWith("✅") ? "rgba(52, 211, 153, 0.1)" : "rgba(248, 113, 113, 0.1)",
          border: `1px solid ${testResult.startsWith("✅") ? "rgba(52, 211, 153, 0.3)" : "rgba(248, 113, 113, 0.3)"}`,
          color: testResult.startsWith("✅") ? "#34d399" : "#f87171",
          fontSize: "13px",
          fontFamily: "system-ui",
        }}>
          {testResult}
        </div>
      )}

      {/* Time Filters */}
      <div style={{
        display: "flex",
        gap: "6px",
        marginBottom: "12px",
        flexWrap: "wrap",
        alignItems: "center",
      }}>
        <span style={{ color: "#6b7280", fontSize: "12px", fontFamily: "system-ui", marginRight: "4px" }}>
          Show:
        </span>
        {TIME_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setTimeFilter(f.key)}
            style={btnStyle(timeFilter === f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        display: "flex",
        gap: "16px",
        marginBottom: "12px",
        fontSize: "11px",
        fontFamily: "system-ui",
        color: "#9ca3af",
      }}>
        <span><span style={{ color: "#60a5fa" }}>●</span> Server</span>
        <span><span style={{ color: "#34d399" }}>●</span> Phone</span>
        <span><span style={{ color: "#c084fc" }}>●</span> Tablet</span>
        <span style={{ marginLeft: "auto" }}>{logs.length} events</span>
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
            {loading ? "Loading..." : "No diagnostic logs found for this time range. Events are recorded automatically — try selecting a wider range or click Refresh."}
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
        Auto-refreshes every 10s when live
      </div>
    </div>
  );
}
