import { useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { trpc } from "../../lib/trpc";

export const SettingsPage = () => {
  const { user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusQuery = trpc.backupApi.getStatus.useQuery();
  const exportMutation = trpc.backupApi.exportMyData.useMutation();

  const handleDownloadBackup = async () => {
    setMessage(null);
    setError(null);
    try {
      const payload = await exportMutation.mutateAsync();
      const timestamp = new Date(payload.exportedAt ?? Date.now())
        .toISOString()
        .replace(/[:.]/g, "-");

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `jee-companion-backup-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setMessage("Backup downloaded successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to download backup";
      setError(message);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          Manage your account and backup options. Google Drive sync and automatic backups will
          appear here so you can keep your JEE Companion data safe across devices.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,3fr)]">
        <section className="glass-card rounded-2xl border border-slate-800/60 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Account</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Name</span>
              <span className="font-medium text-slate-100">{user?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Email</span>
              <span className="font-medium text-slate-100">{user?.email}</span>
            </div>
          </div>
        </section>

        <section className="glass-card rounded-2xl border border-slate-800/60 p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Backup &amp; Sync</h2>
              <p className="text-xs text-slate-400">
                Connect Google Drive to store backups of your formulas, mistakes and quiz history.
                You&apos;ll be able to restore everything even if you switch accounts or devices.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-slate-900/60 px-3 py-1 text-[11px] font-medium text-slate-400 border border-slate-700/60">
              {statusQuery.isLoading ? "Checking..." : "Drive sync coming soon"}
            </span>
          </div>

          <div className="space-y-4 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3">
              <div>
                <p className="font-medium text-slate-100">Google Drive</p>
                <p className="text-xs text-slate-400">
                  You&apos;ll be able to link your Google account here to upload and restore backups
                  directly to your Drive.
                </p>
              </div>
              <button
                type="button"
                disabled
                className="rounded-lg bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-400 border border-slate-700/70 cursor-not-allowed"
              >
                Connect
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled
                className="rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3 text-left text-xs font-semibold text-slate-400 cursor-not-allowed"
              >
                Backup to Google Drive
                <p className="mt-1 text-[11px] font-normal text-slate-500">
                  One-click backup of your current data to your Google Drive account.
                </p>
              </button>
              <button
                type="button"
                disabled
                className="rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3 text-left text-xs font-semibold text-slate-400 cursor-not-allowed"
              >
                Restore from Drive
                <p className="mt-1 text-[11px] font-normal text-slate-500">
                  Restore everything from a previous backup stored in Google Drive.
                </p>
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3">
              <div>
                <p className="font-medium text-slate-100 text-sm">Auto backup</p>
                <p className="text-xs text-slate-400">
                  When enabled, your data will be backed up automatically to Google Drive.
                </p>
              </div>
              <button
                type="button"
                disabled
                className="relative inline-flex h-7 w-12 cursor-not-allowed items-center rounded-full border border-slate-700/70 bg-slate-900/80 px-1"
              >
                <span className="inline-block h-5 w-5 rounded-full bg-slate-600 shadow-sm transition-transform" />
              </button>
            </div>

            <div className="rounded-xl border border-slate-800/70 bg-slate-900/60 px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-100 text-sm">Local backup (JSON)</p>
                  <p className="text-xs text-slate-400">
                    Download a snapshot of all your data as a JSON file. You can keep it in your own
                    storage or later import it into a new account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={exportMutation.isPending}
                  className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-primary/30 hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                >
                  {exportMutation.isPending ? "Preparing..." : "Download backup"}
                </button>
              </div>

              {(message || error) && (
                <div className={`rounded-lg border px-3 py-2 text-xs ${error ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"}`}>
                  {error || message}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
