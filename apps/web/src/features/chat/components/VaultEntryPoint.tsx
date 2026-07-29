import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X } from 'lucide-react';
import { ChatShell } from './ChatShell';
import clsx from 'clsx';

export function VaultEntryPoint() {
  const [clickCount, setClickCount] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);

  useEffect(() => {
    if (clickCount > 0 && clickCount < 5) {
      const timer = setTimeout(() => setClickCount(0), 3000);
      return () => clearTimeout(timer);
    }
    if (clickCount >= 5) {
      setIsRevealed(true);
      setClickCount(0);
    }
  }, [clickCount]);

  if (vaultOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-paper flex flex-col">
        <ChatShell onClose={() => setVaultOpen(false)} />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center justify-center mt-12 mb-8 relative">
      <AnimatePresence>
        {isRevealed && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="mb-8 w-full max-w-sm"
          >
            <div 
              onClick={() => setVaultOpen(true)}
              className="glass-card rounded-2xl border border-line p-6 flex flex-col items-center justify-center cursor-pointer hover:border-brass/50 transition-colors group relative overflow-hidden"
            >
              <button
                onClick={(e) => { e.stopPropagation(); setIsRevealed(false); }}
                className="absolute top-2 right-2 p-1 text-ink-muted hover:text-ink transition-colors"
              >
                <X size={16} />
              </button>
              
              <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mb-4 group-hover:bg-brass/20 transition-colors">
                <Lock className="text-brass" size={24} />
              </div>
              <h3 className="font-space font-medium text-lg text-ink">The Vault</h3>
              <p className="text-sm text-ink-muted mt-1 text-center">
                End-to-end encrypted communications.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        onClick={() => setClickCount(prev => prev + 1)}
        className={clsx(
          "text-[10px] text-ink-muted/30 text-center py-4 select-none cursor-default transition-all duration-300",
          clickCount > 0 && clickCount < 5 && "text-brass/40 scale-105"
        )}
      >
        v1.0.0
      </div>
    </div>
  );
}
