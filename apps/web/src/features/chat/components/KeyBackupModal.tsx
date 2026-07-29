import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Download, Upload, AlertTriangle } from 'lucide-react';
import { exportKeyBackup, importKeyBackup } from '../crypto/key-store';
import clsx from 'clsx';

export function KeyBackupModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (passphrase !== confirm) {
      setError('Passphrases do not match');
      return;
    }
    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }
    try {
      await exportKeyBackup(passphrase);
      setSuccess('Backup exported successfully');
      setTimeout(() => { setSuccess(''); onClose(); }, 2000);
    } catch (err: any) {
      setError(err.message || 'Export failed');
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!file) {
      setError('Please select a backup file');
      return;
    }
    try {
      await importKeyBackup(file, passphrase);
      setSuccess('Key restored successfully. Please refresh.');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      setError(err.message || 'Import failed. Check password.');
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-paper/80 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl glass-card border border-line p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-space font-medium text-ink flex justify-between items-center mb-4">
                  Key Backup
                  <button onClick={onClose} className="text-ink-muted hover:text-ink"><X className="w-5 h-5"/></button>
                </Dialog.Title>

                <div className="flex border-b border-line mb-6">
                  <button 
                    onClick={() => { setTab('export'); setError(''); setSuccess(''); }}
                    className={clsx("flex-1 py-2 text-sm font-medium transition-colors", tab === 'export' ? "text-brass border-b-2 border-brass" : "text-ink-muted")}
                  >Export</button>
                  <button 
                    onClick={() => { setTab('import'); setError(''); setSuccess(''); }}
                    className={clsx("flex-1 py-2 text-sm font-medium transition-colors", tab === 'import' ? "text-brass border-b-2 border-brass" : "text-ink-muted")}
                  >Restore</button>
                </div>

                {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-lg">{error}</div>}
                {success && <div className="mb-4 p-3 bg-signal/10 border border-signal/20 text-signal text-sm rounded-lg">{success}</div>}

                {tab === 'export' ? (
                  <form onSubmit={handleExport} className="space-y-4">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3 text-amber-500 text-xs mb-4">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <p>If you lose this device without a backup, you will permanently lose access to all your conversations.</p>
                    </div>
                    <input
                      type="password"
                      value={passphrase}
                      onChange={e => setPassphrase(e.target.value)}
                      placeholder="Encryption Passphrase"
                      className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-ink focus:border-brass/50 focus:outline-none"
                    />
                    <input
                      type="password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Confirm Passphrase"
                      className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-ink focus:border-brass/50 focus:outline-none"
                    />
                    <button type="submit" className="w-full bg-brass/10 text-brass border border-brass/30 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-brass/20 transition-colors">
                      <Download className="w-4 h-4" /> Download Backup
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleImport} className="space-y-4">
                    <input 
                      type="file"
                      accept=".json"
                      onChange={e => setFile(e.target.files?.[0] || null)}
                      className="w-full text-sm text-ink-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-surface-3 file:text-ink hover:file:bg-surface-2"
                    />
                    <input
                      type="password"
                      value={passphrase}
                      onChange={e => setPassphrase(e.target.value)}
                      placeholder="Backup Passphrase"
                      className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-ink focus:border-brass/50 focus:outline-none"
                    />
                    <button type="submit" className="w-full bg-brass/10 text-brass border border-brass/30 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-brass/20 transition-colors">
                      <Upload className="w-4 h-4" /> Restore Key
                    </button>
                  </form>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
