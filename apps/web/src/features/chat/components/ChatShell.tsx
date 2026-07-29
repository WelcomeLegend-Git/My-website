import React, { useState, useEffect } from 'react';
import { ArrowLeft, Key, Plus, Loader2, Shield } from 'lucide-react';
import { useChatIdentity } from '../hooks/useChatIdentity';
import { useChatSocket } from '../hooks/useChatSocket';
import { initCrypto } from '../crypto/crypto';
import { VaultSetup } from './VaultSetup';
import { ConversationList } from './ConversationList';
import { ChatThread } from './ChatThread';
import { AddContactModal } from './AddContactModal';
import { KeyBackupModal } from './KeyBackupModal';

export function ChatShell({ onClose }: { onClose: () => void }) {
  const { isSetUp, isLoading } = useChatIdentity();
  const { isConnected } = useChatSocket();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showKeyBackup, setShowKeyBackup] = useState(false);
  const [cryptoInitialized, setCryptoInitialized] = useState(false);

  useEffect(() => {
    initCrypto().then(() => setCryptoInitialized(true));
  }, []);

  if (isLoading || !cryptoInitialized) {
    return (
      <div className="flex-1 flex items-center justify-center bg-paper">
        <Loader2 className="w-8 h-8 text-brass animate-spin" />
      </div>
    );
  }

  if (!isSetUp) {
    return (
      <div className="flex-1 flex flex-col h-full bg-paper relative">
         <button onClick={onClose} className="absolute top-6 left-6 p-2 rounded-full hover:bg-surface-2 text-ink-muted hover:text-ink z-10">
            <ArrowLeft className="w-5 h-5" />
          </button>
        <VaultSetup />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-paper font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-line flex items-center justify-between px-4 bg-surface/50 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-2 text-ink-muted hover:text-ink transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-space font-medium text-lg text-ink flex items-center gap-2">
            Chat <span className="text-brass">💬</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-signal' : 'bg-red-500'}`} />
            <span className="text-ink-muted hidden sm:inline">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <button 
            onClick={() => setShowKeyBackup(true)}
            className="p-2 rounded-full hover:bg-surface-2 text-ink-muted hover:text-ink transition-colors"
            title="Key Backup"
          >
            <Key className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <div className={`w-full md:w-80 border-r border-line flex flex-col bg-surface-2/30 ${activeConversationId ? 'hidden md:flex' : 'flex'}`}>
          <ConversationList 
            activeId={activeConversationId} 
            onSelect={setActiveConversationId} 
          />
          <div className="p-4 border-t border-line mt-auto">
            <button 
              onClick={() => setShowAddContact(true)}
              className="w-full bg-brass/10 hover:bg-brass/20 text-brass border border-brass/20 rounded-xl py-3 flex items-center justify-center gap-2 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col relative ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
          {activeConversationId ? (
            <ChatThread 
              conversationId={activeConversationId} 
              onBack={() => setActiveConversationId(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-ink-muted">
              <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-4 border border-line">
                <Key className="w-8 h-8 text-brass/50" />
              </div>
              <p className="font-space">Select a conversation to start</p>
            </div>
          )}
          <div className="h-8 shrink-0 flex items-center justify-center border-t border-line bg-surface/30 backdrop-blur">
             <p className="text-[10px] text-ink-muted uppercase tracking-widest font-mono flex items-center gap-1">
                Messages are end-to-end encrypted <Shield className="w-3 h-3 text-brass ml-1" />
             </p>
          </div>
        </div>
      </main>

      <AddContactModal 
        isOpen={showAddContact} 
        onClose={() => setShowAddContact(false)}
        onSuccess={(id) => { 
          setShowAddContact(false);
          setActiveConversationId(id);
        }}
      />
      <KeyBackupModal isOpen={showKeyBackup} onClose={() => setShowKeyBackup(false)} />
    </div>
  );
}
