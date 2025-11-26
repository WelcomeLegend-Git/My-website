import { useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { trpc } from "../../lib/trpc";

export const SettingsPage = () => {
  const { user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusQuery = trpc.backupApi.getStatus.useQuery();
  const exportMutation = trpc.backupApi.exportMyData.useMutation();
  const googleAuthUrlQuery = trpc.backupApi.getGoogleAuthUrl.useQuery(undefined, {
    enabled: false,
    retry: false,
  });
  const backupDriveMutation = trpc.backupApi.backupToDrive.useMutation();
  const restoreDriveMutation = trpc.backupApi.restoreFromDrive.useMutation();
  const autoBackupMutation = trpc.backupApi.setAutoBackupEnabled.useMutation();
  const restoreLocalMutation = trpc.backupApi.restoreFromLocal.useMutation();

  const cloudStatusLabel = (() => {
    if (statusQuery.isLoading) return "Checking...";
    const data = statusQuery.data;
    if (!data || !data.isConfigured) return "Drive not configured";
    if (!data.isConnected) return "Not connected";
    if (data.hasCloudBackup) return "Connected, backup available";
    return "Connected to Drive";
  })();

  const lastBackupLabel = (() => {
    const last = statusQuery.data?.lastBackupAt;
    if (!last) return "No cloud backups created yet.";
    const value = typeof last === "string" || typeof last === "number" ? new Date(last) : last;
    if (Number.isNaN(value.getTime())) return "No cloud backups created yet.";
    return `Last cloud backup: ${value.toLocaleString()}`;
  })();

  const connectDisabled =
    !statusQuery.data?.isConfigured || statusQuery.isLoading || googleAuthUrlQuery.isFetching;

  const backupDriveDisabled =
    !statusQuery.data?.isConfigured ||
    !statusQuery.data?.isConnected ||
    statusQuery.isLoading ||
    backupDriveMutation.isPending;

  const restoreDriveDisabled =
    !statusQuery.data?.isConfigured ||
    !statusQuery.data?.isConnected ||
    !statusQuery.data?.hasCloudBackup ||
    statusQuery.isLoading ||
    restoreDriveMutation.isPending;

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

  const handleRestoreFromDrive = async () => {
    setMessage(null);
    setError(null);

    if (!statusQuery.data?.hasCloudBackup) {
      setError("No cloud backups found to restore.");
      return;
    }

    const confirmed = window.confirm(
      "This will replace your current formulas, mistakes, quizzes, Study Guru chats, bookmarks and subjects with the data from your latest backup in Google Drive. Continue?",
    );
    if (!confirmed) return;

    try {
      await restoreDriveMutation.mutateAsync();
      await statusQuery.refetch();
      setMessage("Data restored from your latest Google Drive backup.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to restore backup from Google Drive";
      setError(message);
      await statusQuery.refetch();
    }
  };

  const handleToggleAutoBackup = async () => {
    if (!statusQuery.data) return;

    const nextEnabled = !statusQuery.data.autoBackupEnabled;
    setMessage(null);
    setError(null);

    try {
      await autoBackupMutation.mutateAsync({ enabled: nextEnabled });
      await statusQuery.refetch();
      setMessage(nextEnabled ? "Auto backup enabled." : "Auto backup disabled.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update auto backup setting";
      setError(message);
    }
  };

  const handleConnectDrive = async () => {
    setMessage(null);
    setError(null);
    try {
      const result = await googleAuthUrlQuery.refetch();
      const url = result.data?.url;
      if (!url) {
        throw new Error("Could not get Google sign-in link. Please try again.");
      }
      window.location.href = url;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start Google Drive connection";
      setError(message);
    }
  };

  const handleBackupToDrive = async () => {
    setMessage(null);
    setError(null);
    try {
      await backupDriveMutation.mutateAsync();
      await statusQuery.refetch();
      setMessage("Backup uploaded to Google Drive.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to upload backup to Google Drive";
      setError(message);
      await statusQuery.refetch();
    }
  };

  const handleRestoreFromLocalFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage(null);
    setError(null);

    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Please select a valid JSON backup file (.json).");
      event.target.value = "";
      return;
    }

    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      setError("Invalid or corrupted backup file. Please check the file and try again.");
      event.target.value = "";
      return;
    }

    const confirmed = window.confirm(
      "This will replace your current formulas, mistakes, quizzes, Study Guru chats, bookmarks and subjects with the data from this backup file. Continue?",
    );
    if (!confirmed) {
      event.target.value = "";
      return;
    }

    try {
      await restoreLocalMutation.mutateAsync(parsed);
      await statusQuery.refetch();
      setMessage("Data restored from your local backup file.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to restore backup from local file";
      setError(message);
    } finally {
      event.target.value = "";
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

        <section className="glass-card rounded-2xl border border-slate-800/60 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Developer Journey</h2>
          <p className="text-xs text-slate-400">
            Read about the story behind this project, the technical challenges, and the 17-day sprint to build it.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/journey"
              className="group relative overflow-hidden rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3 transition-colors hover:bg-slate-800/60"
            >
              <div className="relative z-10">
                <h3 className="text-sm font-semibold text-emerald-400 mb-1 group-hover:text-emerald-300">The Journey</h3>
                <p className="text-[11px] text-slate-400">My personal story, schedule, and struggles.</p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            <Link
              to="/deep-dive"
              className="group relative overflow-hidden rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3 transition-colors hover:bg-slate-800/60"
            >
              <div className="relative z-10">
                <h3 className="text-sm font-semibold text-blue-400 mb-1 group-hover:text-blue-300">Tech Deep Dive</h3>
                <p className="text-[11px] text-slate-400">Architecture, stack, and deployment wars.</p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </div>
        </section>

        <section className="glass-card rounded-2xl border border-slate-800/60 p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Backup &amp; Sync</h2>
              <p className="text-xs text-slate-400">
                Connect Google Drive to store backups of your formulas, mistakes, quiz history, Study Guru chats, and bookmarks.
                You&apos;ll be able to restore everything even if you switch accounts or devices.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-slate-900/60 px-3 py-1 text-[11px] font-medium text-slate-400 border border-slate-700/60">
              {cloudStatusLabel}
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
                onClick={handleConnectDrive}
                disabled={connectDisabled}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold border border-slate-700/70 transition-colors ${connectDisabled
                  ? "bg-slate-800/80 text-slate-500 cursor-not-allowed"
                  : "bg-emerald-500/90 text-slate-950 hover:bg-emerald-400"
                  }`}
              >
                {googleAuthUrlQuery.isFetching ? "Connecting..." : "Connect"}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleBackupToDrive}
                disabled={backupDriveDisabled}
                className="rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3 text-left text-xs font-semibold text-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                {backupDriveMutation.isPending ? "Backing up..." : "Backup to Google Drive"}
                <p className="mt-1 text-[11px] font-normal text-slate-500">
                  One-click backup of your current data to your Google Drive account.
                </p>
              </button>
              <button
                type="button"
                onClick={handleRestoreFromDrive}
                disabled={restoreDriveDisabled}
                className="rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3 text-left text-xs font-semibold text-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                {restoreDriveMutation.isPending ? "Restoring..." : "Restore from Drive"}
                <p className="mt-1 text-[11px] font-normal text-slate-500">
                  Restore everything from a previous backup stored in Google Drive.
                </p>
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              {lastBackupLabel}
            </p>

            <div className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3">
              <div>
                <p className="font-medium text-slate-100 text-sm">Auto backup</p>
                <p className="text-xs text-slate-400">
                  When enabled, your data will be backed up automatically to Google Drive.
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleAutoBackup}
                disabled={
                  !statusQuery.data?.isConfigured ||
                  !statusQuery.data?.isConnected ||
                  statusQuery.isLoading ||
                  autoBackupMutation.isPending
                }
                className={`relative inline-flex h-7 w-12 items-center rounded-full border border-slate-700/70 px-1 transition-colors ${statusQuery.data?.autoBackupEnabled
                  ? "bg-emerald-500/80"
                  : "bg-slate-900/80"
                  } ${!statusQuery.data?.isConfigured ||
                    !statusQuery.data?.isConnected ||
                    statusQuery.isLoading ||
                    autoBackupMutation.isPending
                    ? "cursor-not-allowed opacity-70"
                    : "cursor-pointer"
                  }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-slate-600 shadow-sm transition-transform ${statusQuery.data?.autoBackupEnabled ? "translate-x-5 bg-slate-950" : ""
                    }`}
                />
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

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-100 text-sm">Restore from local backup</p>
                  <p className="text-xs text-slate-400">
                    Upload a JSON backup file you previously downloaded to restore your data.
                  </p>
                </div>
                <label className="inline-flex items-center rounded-lg border border-slate-700/70 bg-slate-900/80 px-4 py-2 text-xs font-semibold text-slate-100 shadow-sm hover:border-primary/60 hover:text-primary cursor-pointer">
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={handleRestoreFromLocalFile}
                    disabled={restoreLocalMutation.isPending}
                  />
                  {restoreLocalMutation.isPending ? "Restoring..." : "Restore from file"}
                </label>
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
