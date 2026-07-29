import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { requireUser } from "../middleware/auth";
import { procedure, router } from "../trpc";

export const chatRouter = router({
  /** Register or update chat identity with public key */
  registerIdentity: procedure
    .use(requireUser)
    .input(
      z.object({
        publicKey: z.string().min(1),
        inviteCode: z.string().length(6),
        displayName: z.string().max(30).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.chatIdentity.findUnique({
        where: { userId: ctx.user.id },
      });

      if (existing) {
        // Update existing identity
        const updated = await ctx.prisma.chatIdentity.update({
          where: { id: existing.id },
          data: {
            publicKey: input.publicKey,
            inviteCode: input.inviteCode,
            displayName: input.displayName ?? existing.displayName,
          },
        });
        return updated;
      }

      // Create new identity
      const identity = await ctx.prisma.chatIdentity.create({
        data: {
          userId: ctx.user.id,
          publicKey: input.publicKey,
          inviteCode: input.inviteCode,
          displayName: input.displayName ?? null,
        },
      });
      return identity;
    }),

  /** Get current user's chat identity */
  getMyIdentity: procedure
    .use(requireUser)
    .query(async ({ ctx }) => {
      const identity = await ctx.prisma.chatIdentity.findUnique({
        where: { userId: ctx.user.id },
      });
      return identity;
    }),

  /** Look up a user by invite code */
  lookupInviteCode: procedure
    .use(requireUser)
    .input(z.object({ code: z.string().length(6) }))
    .query(async ({ ctx, input }) => {
      const identity = await ctx.prisma.chatIdentity.findUnique({
        where: { inviteCode: input.code.toUpperCase() },
        select: {
          id: true,
          publicKey: true,
          displayName: true,
          inviteCode: true,
          userId: true,
        },
      });

      if (!identity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No user found with that invite code",
        });
      }

      // Don't let users add themselves
      if (identity.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can't start a conversation with yourself",
        });
      }

      return identity;
    }),

  /** Start a new conversation with another user */
  startConversation: procedure
    .use(requireUser)
    .input(z.object({ participantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const myIdentity = await ctx.prisma.chatIdentity.findUnique({
        where: { userId: ctx.user.id },
      });
      if (!myIdentity) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "You need to set up your chat identity first",
        });
      }

      const otherIdentity = await ctx.prisma.chatIdentity.findUnique({
        where: { id: input.participantId },
      });
      if (!otherIdentity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Participant not found",
        });
      }

      // Ensure consistent ordering (smaller ID is always participantA)
      const [aId, bId] =
        myIdentity.id < otherIdentity.id
          ? [myIdentity.id, otherIdentity.id]
          : [otherIdentity.id, myIdentity.id];

      // Check for existing conversation
      const existing = await ctx.prisma.chatConversation.findUnique({
        where: {
          participantAId_participantBId: { participantAId: aId, participantBId: bId },
        },
        include: {
          participantA: { select: { id: true, publicKey: true, displayName: true, inviteCode: true } },
          participantB: { select: { id: true, publicKey: true, displayName: true, inviteCode: true } },
        },
      });

      if (existing) return existing;

      const conversation = await ctx.prisma.chatConversation.create({
        data: {
          participantAId: aId,
          participantBId: bId,
        },
        include: {
          participantA: { select: { id: true, publicKey: true, displayName: true, inviteCode: true } },
          participantB: { select: { id: true, publicKey: true, displayName: true, inviteCode: true } },
        },
      });

      return conversation;
    }),

  /** List all conversations for current user */
  listConversations: procedure
    .use(requireUser)
    .query(async ({ ctx }) => {
      const myIdentity = await ctx.prisma.chatIdentity.findUnique({
        where: { userId: ctx.user.id },
      });
      if (!myIdentity) return [];

      const conversations = await ctx.prisma.chatConversation.findMany({
        where: {
          OR: [
            { participantAId: myIdentity.id },
            { participantBId: myIdentity.id },
          ],
        },
        include: {
          participantA: {
            select: { id: true, publicKey: true, displayName: true, inviteCode: true },
          },
          participantB: {
            select: { id: true, publicKey: true, displayName: true, inviteCode: true },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { messageType: true, createdAt: true },
          },
        },
        orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
      });

      return conversations.map((c) => {
        const other =
          c.participantA.id === myIdentity.id ? c.participantB : c.participantA;
        const lastMsg = c.messages[0] ?? null;
        return {
          id: c.id,
          participant: other,
          lastMessageAt: c.lastMessageAt,
          lastMessageType: lastMsg?.messageType ?? null,
          createdAt: c.createdAt,
        };
      });
    }),

  /** Get paginated messages for a conversation */
  getMessages: procedure
    .use(requireUser)
    .input(
      z.object({
        conversationId: z.string().uuid(),
        cursor: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const myIdentity = await ctx.prisma.chatIdentity.findUnique({
        where: { userId: ctx.user.id },
      });
      if (!myIdentity) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      // Verify the user is part of this conversation
      const conv = await ctx.prisma.chatConversation.findFirst({
        where: {
          id: input.conversationId,
          OR: [
            { participantAId: myIdentity.id },
            { participantBId: myIdentity.id },
          ],
        },
      });
      if (!conv) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      const messages = await ctx.prisma.chatMessage.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor
          ? { cursor: { id: input.cursor }, skip: 1 }
          : {}),
        select: {
          id: true,
          senderId: true,
          ciphertext: true,
          nonce: true,
          messageType: true,
          mediaUrl: true,
          readAt: true,
          deliveredAt: true,
          createdAt: true,
        },
      });

      let nextCursor: string | undefined;
      if (messages.length > input.limit) {
        const next = messages.pop();
        nextCursor = next?.id;
      }

      return {
        messages: messages.reverse(),
        nextCursor,
      };
    }),

  /** Send a message via HTTP (reliable fallback) */
  sendMessage: procedure
    .use(requireUser)
    .input(z.object({
      conversationId: z.string().uuid(),
      ciphertext: z.string(),
      nonce: z.string(),
      messageType: z.string().default("text"),
      mediaUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const myIdentity = await ctx.prisma.chatIdentity.findUnique({
        where: { userId: ctx.user.id },
      });
      if (!myIdentity) throw new TRPCError({ code: "UNAUTHORIZED" });

      const conv = await ctx.prisma.chatConversation.findFirst({
        where: {
          id: input.conversationId,
          OR: [
            { participantAId: myIdentity.id },
            { participantBId: myIdentity.id },
          ],
        },
      });
      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });

      const message = await ctx.prisma.chatMessage.create({
        data: {
          conversationId: input.conversationId,
          senderId: myIdentity.id,
          ciphertext: input.ciphertext,
          nonce: input.nonce,
          messageType: input.messageType,
          mediaUrl: input.mediaUrl || null,
        },
      });

      await ctx.prisma.chatConversation.update({
        where: { id: input.conversationId },
        data: { lastMessageAt: new Date() },
      });

      return {
        id: message.id,
        conversationId: message.conversationId,
        senderId: myIdentity.id,
        createdAt: message.createdAt.toISOString(),
      };
    }),

  /** Mark all messages in a conversation as read */
  markAsRead: procedure
    .use(requireUser)
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const myIdentity = await ctx.prisma.chatIdentity.findUnique({
        where: { userId: ctx.user.id },
      });
      if (!myIdentity) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      // Verify user is part of this conversation
      const conv = await ctx.prisma.chatConversation.findFirst({
        where: {
          id: input.conversationId,
          OR: [
            { participantAId: myIdentity.id },
            { participantBId: myIdentity.id },
          ],
        },
      });
      if (!conv) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      }

      // Mark all messages from the OTHER person as read
      const result = await ctx.prisma.chatMessage.updateMany({
        where: {
          conversationId: input.conversationId,
          senderId: { not: myIdentity.id },
          readAt: null,
        },
        data: { readAt: new Date() },
      });

      return { markedCount: result.count };
    }),

  /** Delete a conversation and all its messages */
  deleteConversation: procedure
    .use(requireUser)
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const myIdentity = await ctx.prisma.chatIdentity.findUnique({
        where: { userId: ctx.user.id },
      });
      if (!myIdentity) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const conv = await ctx.prisma.chatConversation.findFirst({
        where: {
          id: input.conversationId,
          OR: [
            { participantAId: myIdentity.id },
            { participantBId: myIdentity.id },
          ],
        },
      });
      if (!conv) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      // Delete all messages first (cascade should handle this but explicit is safer)
      await ctx.prisma.chatMessage.deleteMany({
        where: { conversationId: input.conversationId },
      });

      await ctx.prisma.chatConversation.delete({
        where: { id: input.conversationId },
      });

      return { success: true };
    }),

  /** Update display name */
  updateDisplayName: procedure
    .use(requireUser)
    .input(z.object({ displayName: z.string().min(1).max(30) }))
    .mutation(async ({ ctx, input }) => {
      const identity = await ctx.prisma.chatIdentity.findUnique({
        where: { userId: ctx.user.id },
      });
      if (!identity) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const updated = await ctx.prisma.chatIdentity.update({
        where: { id: identity.id },
        data: { displayName: input.displayName },
      });
      return updated;
    }),
});
