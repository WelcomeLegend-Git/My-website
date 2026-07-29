import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Unlock, Copy, Check, Loader2, Shield } from 'lucide-react';
import { useChatIdentity } from '../hooks/useChatIdentity';
import clsx from 'clsx';

export function VaultSetup() {
  const { setup, isLoading, identity } = useChatIdentity();
  const [displayName, setDisplayName] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    await setup(displayName.trim());
  };

  const copyInviteCode = () => {
    if (identity?.inviteCode) {
      navigator.clipboard.writeText(identity.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-paper min-h-screen">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-3xl border border-line p-8 max-w-md w-full"
      >
        <div className="flex justify-center mb-6 relative">
          <motion.div
            animate={{ 
              rotateY: identity ? 180 : 0,
            }}
            transition={{ duration: 0.8, type: 'spring' }}
            className="w-20 h-20 rounded-full bg-surface-2 flex items-center justify-center border border-line"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {!identity ? (
              <Lock className="text-brass w-10 h-10" />
            ) : (
              <motion.div 
                initial={{ opacity: 0, rotateY: -180 }}
                animate={{ opacity: 1, rotateY: 180 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Unlock className="text-signal w-10 h-10" />
              </motion.div>
            )}
          </motion.div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-space font-medium text-ink mb-2">
            {identity ? 'Vault Unlocked' : 'Initialize Vault'}
          </h2>
          <p className="text-ink-muted text-sm">
            {identity 
              ? 'Your identity has been securely generated.' 
              : 'End-to-end encrypted chat requires a unique local identity.'}
          </p>
        </div>

        {!identity ? (
          <form onSubmit={handleSetup} className="space-y-6">
            <div>
              <label className="block text-xs font-mono text-ink-muted mb-2 uppercase">
                Alias
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How others will see you"
                className="w-full bg-surface-2 border border-line rounded-xl px-4 py-3 text-ink focus:border-brass/50 focus:outline-none transition-colors font-space"
                required
                disabled={isLoading}
                maxLength={32}
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !displayName.trim()}
              className="w-full bg-brass/10 hover:bg-brass/20 border border-brass/30 text-brass rounded-xl py-3 px-4 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating Keys...</>
              ) : (
                <><Shield className="w-4 h-4" /> Generate Identity</>
              )}
            </button>
          </form>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 text-center"
          >
            <div className="p-4 rounded-xl bg-surface-2 border border-line">
              <p className="text-xs font-mono text-ink-muted uppercase mb-2">Your Invite Code</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl font-mono font-medium text-brass tracking-widest">
                  {identity.inviteCode}
                </span>
                <button
                  onClick={copyInviteCode}
                  className={clsx(
                    "p-2 rounded-lg transition-colors",
                    copied ? "bg-signal/10 text-signal" : "hover:bg-surface-3 text-ink-muted hover:text-ink"
                  )}
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            <div className="text-xs text-ink-muted/70 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-left flex gap-3">
              <Shield className="w-5 h-5 text-amber-500 shrink-0" />
              <p>
                <strong className="text-amber-500 block mb-1">Important</strong>
                Your private keys are stored only on this device. If you clear your browser data without backing up, you will lose access to your conversations.
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
