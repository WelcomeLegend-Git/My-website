import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useChatIdentity } from '../hooks/useChatIdentity';
import clsx from 'clsx';

export function MyInviteCode() {
  const { identity } = useChatIdentity();
  const [copied, setCopied] = useState(false);

  if (!identity) return null;

  const copyCode = () => {
    navigator.clipboard.writeText(identity.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-surface-2 border border-line rounded-xl p-3 flex items-center justify-between group">
      <div>
        <p className="text-[10px] text-ink-muted uppercase font-mono tracking-wider mb-1">Your Code</p>
        <p className="font-mono text-lg font-medium tracking-widest text-brass">{identity.inviteCode}</p>
      </div>
      <button 
        onClick={copyCode}
        className={clsx(
          "p-2 rounded-lg transition-colors",
          copied ? "bg-signal/20 text-signal" : "bg-surface-3 text-ink-muted hover:text-ink"
        )}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}
