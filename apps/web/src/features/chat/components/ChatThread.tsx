import React, { useEffect, useRef, useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { useChatIdentity } from '../hooks/useChatIdentity';
import { useChatSocket } from '../hooks/useChatSocket';
import { decryptMessage, encryptMessage, fromBase64 } from '../crypto/crypto';
import { DecryptedMessage, WsServerMessage, MessageContent } from '../types';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { ArrowLeft, Loader2, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

export function ChatThread({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const { keyPair, identity } = useChatIdentity();
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isDecrypting, setIsDecrypting] = useState(true);

  const { data: conversations } = trpc.chat.listConversations.useQuery();
  const convData = conversations?.find((c: any) => c.id === conversationId);
  const { data: initialMessagesData, isLoading: isMsgsLoading } = trpc.chat.getMessages.useQuery({ conversationId });
  const markRead = trpc.chat.markAsRead.useMutation();

  // Websocket setup
  const { sendWsMessage, sendTypingIndicator, sendReadReceipt } = useChatSocket({
    onMessage: (msg) => handleIncomingMessage(msg),
    onTyping: (cid, uid, typing) => {
      if (cid === conversationId && uid !== identity?.id) setIsTyping(typing);
    },
    onOnlineStatus: (uid, online) => {
      if (uid === convData?.participant.id) setIsOnline(online);
    },
    onReadReceipt: (cid, readBy, readAt) => {
      if (cid === conversationId && readBy !== identity?.id) {
         setMessages(prev => prev.map(m => m.isOwn && !(m as any).readAt ? { ...m, readAt } : m));
      }
    }
  });

  const handleIncomingMessage = async (msg: WsServerMessage) => {
    if (msg.type === 'message' && msg.conversationId === conversationId && keyPair && convData) {
      try {
        const partnerPubKey = fromBase64(convData.participant.publicKey);
        const decryptedStr = decryptMessage(msg.ciphertext, msg.nonce, partnerPubKey, keyPair.privateKey);
        
        const decryptedMsg: DecryptedMessage = {
          id: msg.id,
          conversationId: msg.conversationId,
          senderId: msg.senderId,
          type: msg.messageType,
          content: decryptedStr,
          mediaUrl: msg.mediaUrl,
          createdAt: new Date(msg.createdAt),
          isOwn: msg.senderId === identity?.id
        };

        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          // If it's our own message echoed back, replace the optimistic temp message
          if (decryptedMsg.isOwn) {
            const tempIdx = prev.findIndex(m => m.id.startsWith('temp-') && m.isOwn);
            if (tempIdx !== -1) {
              const updated = [...prev];
              updated[tempIdx] = decryptedMsg;
              return updated;
            }
          }
          return [...prev, decryptedMsg];
        });

        if (!decryptedMsg.isOwn) {
          markRead.mutate({ conversationId });
          sendReadReceipt(conversationId);
        }
      } catch (err) {
        console.error('Failed to decrypt incoming message', err);
      }
    }
  };

  // Decrypt initial messages
  useEffect(() => {
    if (initialMessagesData?.messages && keyPair && convData) {
      setIsDecrypting(true);
      const partnerPubKey = fromBase64(convData.participant.publicKey);
      
      const decrypted = initialMessagesData.messages.map((msg: any) => {
        try {
          const isOwn = msg.senderId === identity?.id;
          
          const content = decryptMessage(msg.ciphertext, msg.nonce, partnerPubKey, keyPair.privateKey);
          return {
            id: msg.id,
            conversationId,
            senderId: msg.senderId,
            type: msg.messageType,
            content,
            mediaUrl: msg.mediaUrl,
            createdAt: new Date(msg.createdAt),
            isOwn,
            readAt: msg.readAt,
          } as DecryptedMessage & { readAt?: string };
        } catch (e) {
          return {
            id: msg.id,
            conversationId,
            senderId: msg.senderId,
            type: msg.messageType || 'text',
            content: JSON.stringify({ type: 'text', text: '<Decryption failed>' }),
            createdAt: new Date(msg.createdAt),
            isOwn: msg.senderId === identity?.id,
          } as DecryptedMessage;
        }
      });
      
      setMessages(decrypted);
      setIsDecrypting(false);
      
      // Mark all read on load if there are messages
      if (decrypted.length > 0) {
        markRead.mutate({ conversationId });
        sendReadReceipt(conversationId);
      }
    }
  }, [initialMessagesData, keyPair, convData, identity]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (content: MessageContent) => {
    if (!keyPair || !convData) return;
    
    const partnerPubKey = fromBase64(convData.participant.publicKey);
    const contentStr = JSON.stringify(content);
    
    const { ciphertext, nonce } = encryptMessage(contentStr, partnerPubKey, keyPair.privateKey);
    
    // Send via WS
    sendWsMessage({
      type: 'message',
      conversationId,
      messageType: content.type,
      ciphertext,
      nonce,
      mediaUrl: content.type === 'photo' ? (content as any).url : undefined
    });

    // Optimistically add to UI
    const tempMsg: DecryptedMessage = {
      id: `temp-${Date.now()}`,
      conversationId,
      senderId: identity!.id,
      type: content.type,
      content: contentStr,
      createdAt: new Date(),
      isOwn: true
    };
    setMessages(prev => [...prev, tempMsg]);
  };

  if (isMsgsLoading || isDecrypting || !convData) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 text-brass animate-spin" /></div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-paper">
      <div className="h-14 border-b border-line flex items-center px-4 bg-surface/80 backdrop-blur z-10 shrink-0">
        <button onClick={onBack} className="md:hidden mr-3 p-2 rounded-full hover:bg-surface-2 text-ink-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
           <div className="relative w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center">
              <span className="font-space text-xs text-ink-muted">{convData?.participant.displayName?.charAt(0).toUpperCase() || '?'}</span>
              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-paper ${isOnline ? 'bg-signal' : 'bg-surface-3'}`} />
           </div>
           <div>
             <h2 className="font-medium text-sm text-ink">{convData?.participant.displayName || convData?.participant.inviteCode}</h2>
             <p className="text-[10px] text-ink-muted">{isOnline ? 'Online' : 'Offline'}</p>
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
        <div className="flex justify-center mb-6">
           <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500/80 text-[10px] uppercase tracking-wider font-mono py-1 px-3 rounded-full flex items-center gap-1.5">
             <Shield className="w-3 h-3" /> End-to-end encrypted
           </div>
        </div>

        {messages.map((msg) => (
          <MessageBubble 
            key={msg.id} 
            message={msg} 
            partnerPublicKey={convData?.participant.publicKey} 
          />
        ))}
        
        {isTyping && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex self-start bg-surface-2 rounded-2xl rounded-tl-sm px-4 py-3 w-16"
          >
            <div className="flex gap-1 items-center justify-center h-2">
              <div className="w-1.5 h-1.5 bg-ink-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-ink-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-ink-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput 
        onSend={handleSendMessage}
        onTyping={(typing) => sendTypingIndicator(conversationId, typing)}
        conversationId={conversationId}
        partnerPubKeyStr={convData?.participant.publicKey}
      />
    </div>
  );
}
