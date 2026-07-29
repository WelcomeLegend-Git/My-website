import type http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { verifyAccessToken } from "../auth/tokens";
import { prisma } from "../prisma";
import { logger } from "../logger";

// Connected Chat Clients
interface ChatClient {
  ws: WebSocket;
  userId: string;
  chatIdentityId: string;
  lastPing: number;
}

const chatClients = new Map<string, ChatClient>();

export function setupChatWebSocket(server: http.Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    if (url.pathname !== "/ws/chat") return;
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws) => {
    let authenticated = false;
    let clientInfo: ChatClient | null = null;

    const authTimeout = setTimeout(() => {
      if (!authenticated) ws.close(4001, "Authentication timeout");
    }, 10_000);

    ws.on("message", async (rawData) => {
      try {
        const data = JSON.parse(rawData.toString());

        // === AUTH ===
        if (data.type === "auth") {
          try {
            const payload = verifyAccessToken(data.token);
            const identity = await prisma.chatIdentity.findUnique({
              where: { userId: payload.sub },
            });
            if (!identity) {
              ws.send(JSON.stringify({ type: "auth_error", message: "No chat identity found" }));
              ws.close(4003, "No chat identity");
              return;
            }

            const existing = chatClients.get(identity.id);
            if (existing && existing.ws.readyState === WebSocket.OPEN) {
              existing.ws.close(4000, "Replaced by new connection");
            }

            authenticated = true;
            clearTimeout(authTimeout);
            clientInfo = { ws, userId: payload.sub, chatIdentityId: identity.id, lastPing: Date.now() };
            chatClients.set(identity.id, clientInfo);
            ws.send(JSON.stringify({ type: "auth_ok", userId: payload.sub }));

            // Broadcast this user is online to their contacts
            broadcastOnlineStatus(identity.id, true);

            // Send current online statuses of all conversation partners TO this client
            await sendPartnerStatuses(identity.id, ws);

            logger.info({ userId: payload.sub, chatIdentityId: identity.id }, "Chat client connected");
          } catch (err) {
            ws.send(JSON.stringify({ type: "auth_error", message: "Invalid token" }));
            ws.close(4002, "Invalid token");
          }
          return;
        }

        if (!authenticated || !clientInfo) {
          ws.send(JSON.stringify({ type: "error", message: "Not authenticated" }));
          return;
        }

        // === SEND MESSAGE ===
        if (data.type === "message") {
          const { conversationId, ciphertext, nonce, messageType, mediaUrl } = data;
          if (!conversationId || !ciphertext || !nonce) {
            ws.send(JSON.stringify({ type: "error", message: "Missing required fields" }));
            return;
          }

          const conv = await prisma.chatConversation.findFirst({
            where: {
              id: conversationId,
              OR: [{ participantAId: clientInfo.chatIdentityId }, { participantBId: clientInfo.chatIdentityId }],
            },
          });
          if (!conv) {
            ws.send(JSON.stringify({ type: "error", message: "Conversation not found" }));
            return;
          }

          const message = await prisma.chatMessage.create({
            data: {
              conversationId,
              senderId: clientInfo.chatIdentityId,
              ciphertext,
              nonce,
              messageType: messageType || "text",
              mediaUrl: mediaUrl || null,
            },
          });

          await prisma.chatConversation.update({
            where: { id: conversationId },
            data: { lastMessageAt: new Date() },
          });

          const recipientId = conv.participantAId === clientInfo.chatIdentityId ? conv.participantBId : conv.participantAId;

          // Relay full message to recipient
          const recipientClient = chatClients.get(recipientId);
          if (recipientClient && recipientClient.ws.readyState === WebSocket.OPEN) {
            recipientClient.ws.send(JSON.stringify({
              type: "message",
              id: message.id,
              conversationId,
              senderId: clientInfo.chatIdentityId,
              ciphertext,
              nonce,
              messageType: message.messageType,
              mediaUrl: message.mediaUrl,
              createdAt: message.createdAt.toISOString(),
            }));
          }

          // Send ACK to sender (NOT the full message — prevents duplicates)
          ws.send(JSON.stringify({
            type: "message_ack",
            id: message.id,
            conversationId,
            createdAt: message.createdAt.toISOString(),
          }));
          return;
        }

        // === RELAY (forward already-saved message to recipient, no DB write) ===
        if (data.type === "relay") {
          const { conversationId, messageId, ciphertext, nonce, messageType, mediaUrl, createdAt } = data;
          if (!conversationId || !ciphertext || !nonce || !messageId) return;

          const conv = await prisma.chatConversation.findFirst({
            where: {
              id: conversationId,
              OR: [{ participantAId: clientInfo.chatIdentityId }, { participantBId: clientInfo.chatIdentityId }],
            },
          });
          if (!conv) return;

          const recipientId = conv.participantAId === clientInfo.chatIdentityId ? conv.participantBId : conv.participantAId;
          const recipientClient = chatClients.get(recipientId);
          if (recipientClient && recipientClient.ws.readyState === WebSocket.OPEN) {
            recipientClient.ws.send(JSON.stringify({
              type: "message",
              id: messageId,
              conversationId,
              senderId: clientInfo.chatIdentityId,
              ciphertext,
              nonce,
              messageType: messageType || "text",
              mediaUrl: mediaUrl || null,
              createdAt: createdAt || new Date().toISOString(),
            }));
          }
          return;
        }

        // === TYPING ===
        if (data.type === "typing") {
          const { conversationId, isTyping } = data;
          const conv = await prisma.chatConversation.findFirst({
            where: {
              id: conversationId,
              OR: [{ participantAId: clientInfo.chatIdentityId }, { participantBId: clientInfo.chatIdentityId }],
            },
          });
          if (!conv) return;

          const recipientId = conv.participantAId === clientInfo.chatIdentityId ? conv.participantBId : conv.participantAId;
          const recipientClient = chatClients.get(recipientId);
          if (recipientClient && recipientClient.ws.readyState === WebSocket.OPEN) {
            recipientClient.ws.send(JSON.stringify({
              type: "typing",
              conversationId,
              userId: clientInfo.chatIdentityId,
              isTyping: !!isTyping,
            }));
          }
          return;
        }

        // === DELIVERED (recipient confirms they received messages) ===
        if (data.type === "delivered") {
          const { conversationId, messageIds } = data;
          if (!conversationId || !Array.isArray(messageIds) || messageIds.length === 0) return;

          const now = new Date();
          await prisma.chatMessage.updateMany({
            where: {
              id: { in: messageIds },
              conversationId,
              deliveredAt: null,
            },
            data: { deliveredAt: now },
          });

          // Find sender of these messages and relay delivery receipt
          const conv = await prisma.chatConversation.findFirst({
            where: {
              id: conversationId,
              OR: [{ participantAId: clientInfo.chatIdentityId }, { participantBId: clientInfo.chatIdentityId }],
            },
          });
          if (!conv) return;

          const senderId = conv.participantAId === clientInfo.chatIdentityId ? conv.participantBId : conv.participantAId;
          const senderClient = chatClients.get(senderId);
          if (senderClient && senderClient.ws.readyState === WebSocket.OPEN) {
            senderClient.ws.send(JSON.stringify({
              type: "delivery_receipt",
              conversationId,
              messageIds,
              deliveredAt: now.toISOString(),
            }));
          }
          return;
        }

        // === READ ===
        if (data.type === "read") {
          const { conversationId } = data;
          const conv = await prisma.chatConversation.findFirst({
            where: {
              id: conversationId,
              OR: [{ participantAId: clientInfo.chatIdentityId }, { participantBId: clientInfo.chatIdentityId }],
            },
          });
          if (!conv) return;

          const otherId = conv.participantAId === clientInfo.chatIdentityId ? conv.participantBId : conv.participantAId;
          const now = new Date();

          // Mark as both delivered AND read
          await prisma.chatMessage.updateMany({
            where: { conversationId, senderId: otherId, readAt: null },
            data: { readAt: now, deliveredAt: now },
          });

          const senderClient = chatClients.get(otherId);
          if (senderClient && senderClient.ws.readyState === WebSocket.OPEN) {
            senderClient.ws.send(JSON.stringify({
              type: "read_receipt",
              conversationId,
              readBy: clientInfo.chatIdentityId,
              readAt: now.toISOString(),
            }));
          }
          return;
        }

        // === PING ===
        if (data.type === "ping") {
          if (clientInfo) clientInfo.lastPing = Date.now();
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }
      } catch (err) {
        logger.error({ err }, "Chat WebSocket message error");
        ws.send(JSON.stringify({ type: "error", message: "Internal error" }));
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimeout);
      if (clientInfo) {
        chatClients.delete(clientInfo.chatIdentityId);
        broadcastOnlineStatus(clientInfo.chatIdentityId, false);
        logger.info({ chatIdentityId: clientInfo.chatIdentityId }, "Chat client disconnected");
      }
    });

    ws.on("error", (err) => {
      logger.error({ err }, "Chat WebSocket error");
    });
  });

  // Heartbeat cleanup every 30s
  setInterval(() => {
    const now = Date.now();
    for (const [id, client] of chatClients) {
      if (now - client.lastPing > 60_000) {
        client.ws.close(4004, "Heartbeat timeout");
        chatClients.delete(id);
      }
    }
  }, 30_000);

  logger.info("Chat WebSocket server initialized on /ws/chat");
}

// Broadcast online/offline status to all conversation partners
async function broadcastOnlineStatus(chatIdentityId: string, online: boolean): Promise<void> {
  try {
    const conversations = await prisma.chatConversation.findMany({
      where: {
        OR: [{ participantAId: chatIdentityId }, { participantBId: chatIdentityId }],
      },
    });

    for (const conv of conversations) {
      const partnerId = conv.participantAId === chatIdentityId ? conv.participantBId : conv.participantAId;
      const partnerClient = chatClients.get(partnerId);
      if (partnerClient && partnerClient.ws.readyState === WebSocket.OPEN) {
        partnerClient.ws.send(JSON.stringify({ type: "online", userId: chatIdentityId, online }));
      }
    }
  } catch (err) {
    logger.error({ err }, "broadcastOnlineStatus error");
  }
}

// Send online statuses of all conversation partners to a newly connected client
async function sendPartnerStatuses(chatIdentityId: string, ws: WebSocket): Promise<void> {
  try {
    const conversations = await prisma.chatConversation.findMany({
      where: {
        OR: [{ participantAId: chatIdentityId }, { participantBId: chatIdentityId }],
      },
    });

    for (const conv of conversations) {
      const partnerId = conv.participantAId === chatIdentityId ? conv.participantBId : conv.participantAId;
      const isOnline = chatClients.has(partnerId) && chatClients.get(partnerId)!.ws.readyState === WebSocket.OPEN;
      ws.send(JSON.stringify({ type: "online", userId: partnerId, online: isOnline }));
    }
  } catch (err) {
    logger.error({ err }, "sendPartnerStatuses error");
  }
}

export function isChatUserOnline(chatIdentityId: string): boolean {
  const client = chatClients.get(chatIdentityId);
  return !!client && client.ws.readyState === WebSocket.OPEN;
}
