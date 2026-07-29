import { useEffect, useRef, useState, useCallback } from 'react';
import { getApiBaseUrl } from '../../../lib/env';
import { authStorage } from '../../../lib/auth-storage';
import { WsClientMessage, WsServerMessage } from '../types';

type ChatSocketProps = {
  onMessage?: (message: WsServerMessage) => void;
  onTyping?: (conversationId: string, userId: string, isTyping: boolean) => void;
  onOnlineStatus?: (userId: string, isOnline: boolean) => void;
  onReadReceipt?: (conversationId: string, readBy: string, readAt: string) => void;
  onDeliveryReceipt?: (conversationId: string, messageIds: string[], deliveredAt: string) => void;
  onMessageAck?: (id: string, conversationId: string, createdAt: string) => void;
};

export function useChatSocket({
  onMessage,
  onTyping,
  onOnlineStatus,
  onReadReceipt,
  onDeliveryReceipt,
  onMessageAck,
}: ChatSocketProps = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const maxReconnectDelay = 30000;
  const pingIntervalRef = useRef<number | null>(null);

  // Use refs so WS callbacks always see latest handlers
  const onMessageRef = useRef(onMessage);
  const onTypingRef = useRef(onTyping);
  const onOnlineStatusRef = useRef(onOnlineStatus);
  const onReadReceiptRef = useRef(onReadReceipt);
  const onDeliveryReceiptRef = useRef(onDeliveryReceipt);
  const onMessageAckRef = useRef(onMessageAck);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onTypingRef.current = onTyping;
    onOnlineStatusRef.current = onOnlineStatus;
    onReadReceiptRef.current = onReadReceipt;
    onDeliveryReceiptRef.current = onDeliveryReceipt;
    onMessageAckRef.current = onMessageAck;
  }, [onMessage, onTyping, onOnlineStatus, onReadReceipt, onDeliveryReceipt, onMessageAck]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const baseUrl = getApiBaseUrl();
    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws/chat';

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttemptRef.current = 0;

      // Authenticate
      const token = authStorage.getAccessToken();
      if (token) {
        ws.send(JSON.stringify({ type: 'auth', token }));
      }

      // Heartbeat ping every 25s
      pingIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsServerMessage;

        if (data.type === 'typing') {
          onTypingRef.current?.(data.conversationId, data.userId, data.isTyping);
        } else if (data.type === 'online') {
          onOnlineStatusRef.current?.(data.userId, data.online);
        } else if (data.type === 'read_receipt') {
          onReadReceiptRef.current?.(data.conversationId, data.readBy, data.readAt);
        } else if (data.type === 'delivery_receipt') {
          onDeliveryReceiptRef.current?.(data.conversationId, data.messageIds, data.deliveredAt);
        } else if (data.type === 'message_ack') {
          onMessageAckRef.current?.(data.id, data.conversationId, data.createdAt);
        }

        // Pass all messages to onMessage (for 'message' type handling in ChatThread)
        onMessageRef.current?.(data);
      } catch (error) {
        console.error('Error parsing WS message:', error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Reconnect with exponential backoff
      const delay = Math.min(
        Math.pow(2, reconnectAttemptRef.current) * 1000,
        maxReconnectDelay
      );
      reconnectAttemptRef.current += 1;
      setTimeout(connect, delay);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [connect]);

  const sendWsMessage = useCallback((message: WsClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message, WS not connected');
    }
  }, []);

  const sendTypingIndicator = useCallback((conversationId: string, isTyping: boolean) => {
    sendWsMessage({ type: 'typing', conversationId, isTyping });
  }, [sendWsMessage]);

  const sendReadReceipt = useCallback((conversationId: string) => {
    sendWsMessage({ type: 'read', conversationId });
  }, [sendWsMessage]);

  const sendDeliveryReceipt = useCallback((conversationId: string, messageIds: string[]) => {
    sendWsMessage({ type: 'delivered', conversationId, messageIds });
  }, [sendWsMessage]);

  return { isConnected, sendWsMessage, sendTypingIndicator, sendReadReceipt, sendDeliveryReceipt };
}
