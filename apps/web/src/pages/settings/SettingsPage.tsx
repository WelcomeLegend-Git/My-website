import { useAuth } from "../../app/providers/AuthProvider";

export const SettingsPage = () => {
  const { user } = useAuth();

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
                Connect Google Drive to store encrypted backups of your formulas, mistakes and quiz
                history. You&apos;ll be able to restore everything even if you switch accounts or
                devices.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-slate-900/60 px-3 py-1 text-[11px] font-medium text-slate-400 border border-slate-700/60">
              Coming soon
            </span>
          </div>

          <div className="space-y-4 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3">
              <div>
                <p className="font-medium text-slate-100">Google Drive</p>
                <p className="text-xs text-slate-400">
                  You&apos;ll be able to link your Google account here to upload and restore backups.
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
                  One-click backup of your current data. Will upload a secure JSON snapshot.
                </p>
              </button>
              <button
                type="button"
                disabled
                className="rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3 text-left text-xs font-semibold text-slate-400 cursor-not-allowed"
              >
                Restore from backup
                <p className="mt-1 text-[11px] font-normal text-slate-500">
                  Choose a backup file to restore your formulas, mistakes and quiz sessions.
                </p>
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3">
              <div>
                <p className="font-medium text-slate-100 text-sm">Auto backup</p>
                <p className="text-xs text-slate-400">
                  When enabled, your data will be backed up periodically without you needing to
                  click anything.
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
          </div>
        </section>
      </div>
    </div>
  );
};
