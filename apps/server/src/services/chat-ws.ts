import type http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { verifyAccessToken } from "../auth/tokens";
import { prisma } from "../prisma";
import { logger } from "../logger";

// ─── Connected Chat Clients ───

interface ChatClient {
  ws: WebSocket;
  userId: string;
  chatIdentityId: string;
  lastPing: number;
}

// Map of chatIdentityId -> ChatClient
const chatClients = new Map<string, ChatClient>();

// ─── Setup ───

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

    // Auth timeout — must authenticate within 10 seconds
    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        ws.close(4001, "Authentication timeout");
      }
    }, 10_000);

    ws.on("message", async (rawData) => {
      try {
        const data = JSON.parse(rawData.toString());

        // ─── Authentication ───
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

            // Remove any existing connection for this identity
            const existing = chatClients.get(identity.id);
            if (existing && existing.ws.readyState === WebSocket.OPEN) {
              existing.ws.close(4000, "Replaced by new connection");
            }

            authenticated = true;
            clearTimeout(authTimeout);

            clientInfo = {
              ws,
              userId: payload.sub,
              chatIdentityId: identity.id,
              lastPing: Date.now(),
            };
            chatClients.set(identity.id, clientInfo);

            ws.send(JSON.stringify({ type: "auth_ok", userId: payload.sub }));

            // Notify contacts that this user is online
            broadcastOnlineStatus(identity.id, true);

            // Deliver any pending messages (messages sent while offline)
            // These are already stored in DB, client will fetch via tRPC

            logger.info({ userId: payload.sub, chatIdentityId: identity.id }, "Chat client connected");
          } catch (err) {
            ws.send(JSON.stringify({ type: "auth_error", message: "Invalid token" }));
            ws.close(4002, "Invalid token");
          }
          return;
        }

        // All other messages require authentication
        if (!authenticated || !clientInfo) {
          ws.send(JSON.stringify({ type: "error", message: "Not authenticated" }));
          return;
        }

        // ─── Send Message ───
        if (data.type === "message") {
          const { conversationId, ciphertext, nonce, messageType, mediaUrl } = data;

          if (!conversationId || !ciphertext || !nonce) {
            ws.send(JSON.stringify({ type: "error", message: "Missing required fields" }));
            return;
          }

          // Verify sender is part of conversation
          const conv = await prisma.chatConversation.findFirst({
            where: {
              id: conversationId,
              OR: [
                { participantAId: clientInfo.chatIdentityId },
                { participantBId: clientInfo.chatIdentityId },
              ],
            },
          });

          if (!conv) {
            ws.send(JSON.stringify({ type: "error", message: "Conversation not found" }));
            return;
          }

          // Store message in DB
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

          // Update lastMessageAt
          await prisma.chatConversation.update({
            where: { id: conversationId },
            data: { lastMessageAt: new Date() },
          });

          // Determine recipient
          const recipientId =
            conv.participantAId === clientInfo.chatIdentityId
              ? conv.participantBId
              : conv.participantAId;

          // Relay to recipient if online
          const recipientClient = chatClients.get(recipientId);
          if (recipientClient && recipientClient.ws.readyState === WebSocket.OPEN) {
            recipientClient.ws.send(
              JSON.stringify({
                type: "message",
                id: message.id,
                conversationId,
                senderId: clientInfo.chatIdentityId,
                ciphertext,
                nonce,
                messageType: message.messageType,
                mediaUrl: message.mediaUrl,
                createdAt: message.createdAt.toISOString(),
              })
            );
          }

          // Confirm to sender
          ws.send(
            JSON.stringify({
              type: "message",
              id: message.id,
              conversationId,
              senderId: clientInfo.chatIdentityId,
              ciphertext,
              nonce,
              messageType: message.messageType,
              mediaUrl: message.mediaUrl,
              createdAt: message.createdAt.toISOString(),
            })
          );

          return;
        }

        // ─── Typing Indicator ───
        if (data.type === "typing") {
          const { conversationId, isTyping } = data;

          const conv = await prisma.chatConversation.findFirst({
            where: {
              id: conversationId,
              OR: [
                { participantAId: clientInfo.chatIdentityId },
                { participantBId: clientInfo.chatIdentityId },
              ],
            },
          });

          if (!conv) return;

          const recipientId =
            conv.participantAId === clientInfo.chatIdentityId
              ? conv.participantBId
              : conv.participantAId;

          const recipientClient = chatClients.get(recipientId);
          if (recipientClient && recipientClient.ws.readyState === WebSocket.OPEN) {
            recipientClient.ws.send(
              JSON.stringify({
                type: "typing",
                conversationId,
                userId: clientInfo.chatIdentityId,
                isTyping: !!isTyping,
              })
            );
          }
          return;
        }

        // ─── Read Receipts ───
        if (data.type === "read") {
          const { conversationId } = data;

          const conv = await prisma.chatConversation.findFirst({
            where: {
              id: conversationId,
              OR: [
                { participantAId: clientInfo.chatIdentityId },
                { participantBId: clientInfo.chatIdentityId },
              ],
            },
          });

          if (!conv) return;

          const otherId = conv.participantAId === clientInfo.chatIdentityId
            ? conv.participantBId
            : conv.participantAId;

          const now = new Date();
          await prisma.chatMessage.updateMany({
            where: {
              conversationId,
              senderId: otherId,
              readAt: null,
            },
            data: {
              readAt: now,
            },
          });

          const recipientClient = chatClients.get(otherId);
          if (recipientClient && recipientClient.ws.readyState === WebSocket.OPEN) {
            recipientClient.ws.send(
              JSON.stringify({
                type: "read_receipt",
                conversationId,
                readBy: clientInfo.chatIdentityId,
                readAt: now.toISOString(),
              })
            );
          }
          return;
        }

        // ─── Read Receipts ───
        if (data.type === "read") {
          const { conversationId } = data;

          const conv = await prisma.chatConversation.findFirst({
            where: {
              id: conversationId,
              OR: [
                { participantAId: clientInfo.chatIdentityId },
                { participantBId: clientInfo.chatIdentityId },
              ],
            },
          });

          if (!conv) return;

          const senderId =
            conv.participantAId === clientInfo.chatIdentityId
              ? conv.participantBId
              : conv.participantAId;

          // Mark all unread messages from the other person as read
          const readAt = new Date();
          await prisma.chatMessage.updateMany({
            where: {
              conversationId,
              senderId,
              readAt: null,
            },
            data: { readAt },
          });

          // Notify the original sender that their messages have been read
          const senderClient = chatClients.get(senderId);
          if (senderClient && senderClient.ws.readyState === WebSocket.OPEN) {
            senderClient.ws.send(
              JSON.stringify({
                type: "read_receipt",
                conversationId,
                readBy: clientInfo.chatIdentityId,
                readAt: readAt.toISOString(),
              })
            );
          }
          return;
        }

        // ─── Ping/Pong ───
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

  // Heartbeat — clean up dead connections every 30 seconds
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

// ─── Helpers ───

async function broadcastOnlineStatus(chatIdentityId: string, online: boolean): Promise<void> {
  try {
    // Find all conversations this user is part of
    const conversations = await prisma.chatConversation.findMany({
      where: {
        OR: [
          { participantAId: chatIdentityId },
          { participantBId: chatIdentityId },
        ],
      },
    });

    for (const conv of conversations) {
      const partnerId =
        conv.participantAId === chatIdentityId
          ? conv.participantBId
          : conv.participantAId;

      const partnerClient = chatClients.get(partnerId);
      if (partnerClient && partnerClient.ws.readyState === WebSocket.OPEN) {
        partnerClient.ws.send(
          JSON.stringify({
            type: "online",
            userId: chatIdentityId,
            online,
          })
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "broadcastOnlineStatus error");
  }
}

/** Get the current online status of a chat identity */
export function isChatUserOnline(chatIdentityId: string): boolean {
  const client = chatClients.get(chatIdentityId);
  return !!client && client.ws.readyState === WebSocket.OPEN;
}
