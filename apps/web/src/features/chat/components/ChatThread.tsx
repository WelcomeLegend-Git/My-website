import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  const sendMessageMutation = trpc.chat.sendMessage.useMutation();

  // WebSocket — real-time relay only (NOT the source of truth for sending)
  const { sendWsMessage, sendTypingIndicator, sendReadReceipt, sendDeliveryReceipt } = useChatSocket({
    onMessage: (msg) => handleIncomingMessage(msg),
    onTyping: (cid, uid, typing) => {
      if (cid === conversationId && uid !== identity?.id) setIsTyping(typing);
    },
    onOnlineStatus: (uid, online) => {
      if (uid === convData?.participant.id) setIsOnline(online);
    },
    onReadReceipt: (cid, _readBy, readAt) => {
      if (cid === conversationId) {
        // Mark ALL own messages as read
        setMessages(prev => prev.map(m =>
          m.isOwn && !m.readAt ? { ...m, readAt, deliveredAt: m.deliveredAt || readAt } : m
        ));
      }
    },
    onDeliveryReceipt: (cid, messageIds, deliveredAt) => {
      if (cid === conversationId) {
        setMessages(prev => prev.map(m =>
          m.isOwn && messageIds.includes(m.id) && !m.deliveredAt
            ? { ...m, deliveredAt }
            : m
        ));
      }
    },
    onMessageAck: (id, cid, createdAt) => {
      if (cid === conversationId) {
        // Replace temp message with server-confirmed message (single tick)
        setMessages(prev => {
          const tempIdx = prev.findIndex(m => m.id.startsWith('temp-') && m.isOwn);
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = { ...updated[tempIdx], id, createdAt: new Date(createdAt) };
            return updated;
          }
          return prev;
        });
      }
    },
  });

  const handleIncomingMessage = useCallback(async (msg: WsServerMessage) => {
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
          isOwn: msg.senderId === identity?.id,
        };

        setMessages(prev => {
          // Dedup by server ID
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, decryptedMsg];
        });

        // If it's someone else's message, send delivery receipt + mark read
        if (!decryptedMsg.isOwn) {
          sendDeliveryReceipt(conversationId, [msg.id]);
          markRead.mutate({ conversationId });
          sendReadReceipt(conversationId);

          // Browser notification if tab is hidden
          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            try {
              const parsed = JSON.parse(decryptedStr);
              const preview = parsed.type === 'text' ? parsed.text : `Sent a ${parsed.type}`;
              new Notification(convData.participant.displayName || 'New message', {
                body: preview,
                icon: '/favicon.ico',
                tag: `chat-${conversationId}`,
              });
            } catch {}
          }
        }
      } catch (err) {
        console.error('Failed to decrypt incoming message', err);
      }
    }
  }, [conversationId, keyPair, convData, identity, sendDeliveryReceipt, sendReadReceipt, markRead]);

  // Decrypt initial messages from DB
  useEffect(() => {
    if (initialMessagesData?.messages && keyPair && convData) {
      setIsDecrypting(true);
      const partnerPubKey = fromBase64(convData.participant.publicKey);

      const decrypted: DecryptedMessage[] = initialMessagesData.messages.map((msg: any) => {
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
            deliveredAt: msg.deliveredAt || null,
            readAt: msg.readAt || null,
          };
        } catch {
          return {
            id: msg.id,
            conversationId,
            senderId: msg.senderId,
            type: msg.messageType || 'text',
            content: JSON.stringify({ type: 'text', text: '<Decryption failed>' }),
            createdAt: new Date(msg.createdAt),
            isOwn: msg.senderId === identity?.id,
          };
        }
      });

      setMessages(decrypted);
      setIsDecrypting(false);

      // Mark all read on load
      if (decrypted.length > 0) {
        markRead.mutate({ conversationId });
        sendReadReceipt(conversationId);
      }
    }
  }, [initialMessagesData, keyPair, convData, identity]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleSendMessage = async (content: MessageContent) => {
    if (!keyPair || !convData) return;

    const partnerPubKey = fromBase64(convData.participant.publicKey);
    const contentStr = JSON.stringify(content);
    const { ciphertext, nonce } = encryptMessage(contentStr, partnerPubKey, keyPair.privateKey);

    // Optimistically add with temp ID (no tick yet — pending)
    const tempId = `temp-${Date.now()}`;
    const tempMsg: DecryptedMessage = {
      id: tempId,
      conversationId,
      senderId: identity!.id,
      type: content.type,
      content: contentStr,
      createdAt: new Date(),
      isOwn: true,
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      // Send via HTTP (reliable, persisted to DB) — this gives us single tick ✓
      const result = await sendMessageMutation.mutateAsync({
        conversationId,
        ciphertext,
        nonce,
        messageType: content.type,
        mediaUrl: content.type === 'photo' ? (content as any).url : undefined,
      });

      // Replace temp message with confirmed message (single tick ✓)
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, id: result.id, createdAt: new Date(result.createdAt) }
          : m
      ));

      // Relay via WS for real-time delivery to recipient (no DB write — already saved via HTTP)
      sendWsMessage({
        type: 'relay',
        conversationId,
        messageId: result.id,
        messageType: content.type,
        ciphertext,
        nonce,
        mediaUrl: content.type === 'photo' ? (content as any).url : undefined,
        createdAt: result.createdAt,
      } as any);
    } catch (err) {
      console.error('Failed to send message:', err);
      // Mark the temp message as failed
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, id: 'failed-' + tempId } : m
      ));
    }
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
