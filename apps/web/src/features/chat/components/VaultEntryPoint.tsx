import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { ChatShell } from './ChatShell';

export function VaultEntryPoint() {
  const [chatOpen, setChatOpen] = useState(false);

  if (chatOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-paper flex flex-col">
        <ChatShell onClose={() => setChatOpen(false)} />
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 mt-6">
      <div
        onClick={() => setChatOpen(true)}
        className="flex items-center gap-4 cursor-pointer group"
      >
        <div className="w-12 h-12 rounded-full bg-brass/10 flex items-center justify-center border border-brass/20 group-hover:bg-brass/20 transition-colors">
          <MessageCircle className="text-brass" size={22} />
        </div>
        <div className="flex-1">
          <h3 className="font-space font-medium text-ink group-hover:text-brass transition-colors">Chat</h3>
          <p className="text-xs text-ink-muted mt-0.5">
            End-to-end encrypted messaging
          </p>
        </div>
        <div className="text-ink-muted group-hover:text-brass transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>
    </section>
  );
}
