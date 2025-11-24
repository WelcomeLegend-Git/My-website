import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { env } from "../../env";
import { uploadBackupToDrive, buildGoogleAuthUrl, restoreLatestBackupForUser, restoreBackupFromPayloadForUser, type BackupPayloadV1 } from "../../services/google-drive";
import { requireUser } from "../middleware/auth";
import { procedure, router } from "../trpc";

const buildBackupPayload = async (prisma: PrismaClient, userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }

  const [subjects, chapters, formulas, formulaAssets, mistakes, mistakeAssets, quizSessions, quizQuestions, practiceQuizzes, practiceQuestions, practiceAttempts, formulaCollections, studyGuruConversations, bookmarks] =
    await Promise.all([
      prisma.subject.findMany({ where: { ownerId: userId } }),
      prisma.chapter.findMany({
        where: {
          subject: {
            ownerId: userId,
          },
        },
      }),
      prisma.formula.findMany({ where: { ownerId: userId } }),
      prisma.formulaAsset.findMany({
        where: {
          formula: {
            ownerId: userId,
          },
        },
      }),
      prisma.mistake.findMany({ where: { ownerId: userId } }),
      prisma.mistakeAsset.findMany({
        where: {
          mistake: {
            ownerId: userId,
          },
        },
      }),
      prisma.quizSession.findMany({ where: { ownerId: userId } }),
      prisma.quizQuestion.findMany({
        where: {
          session: {
            ownerId: userId,
          },
        },
      }),
      prisma.practiceQuiz.findMany({ where: { ownerId: userId } }),
      prisma.practiceQuestion.findMany({
        where: {
          quiz: {
            ownerId: userId,
          },
        },
      }),
      prisma.practiceAttempt.findMany({ where: { userId } }),
      prisma.formulaCollection.findMany({ where: { ownerId: userId } }),
      prisma.studyGuruConversation.findMany({ where: { ownerId: userId } }),
      prisma.bookmark.findMany({ where: { ownerId: userId } }),
    ]);

  return {
    version: 1,
    exportedAt: new Date(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    data: {
      subjects,
      chapters,
      formulas,
      formulaAssets,
      mistakes,
      mistakeAssets,
      quizSessions,
      quizQuestions,
      practiceQuizzes,
      practiceQuestions,
      practiceAttempts,
      formulaCollections,
      studyGuruConversations,
      bookmarks,
    },
  } as const;
};

const isGoogleConfigured = () =>
  Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_OAUTH_REDIRECT_URL);

export const backupRouter = router({
  exportMyData: procedure
    .use(requireUser)
    .mutation(async ({ ctx }) => {
      const userId = ctx.user.id;
      return buildBackupPayload(ctx.prisma, userId);
    }),

  getStatus: procedure
    .use(requireUser)
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;
      const configured = isGoogleConfigured();

      if (!configured) {
        return {
          isConfigured: false,
          isConnected: false,
          hasCloudBackup: false,
          autoBackupEnabled: false,
          lastBackupAt: null as Date | null,
        };
      }

      const connection = await ctx.prisma.googleDriveConnection.findUnique({ where: { userId } });

      return {
        isConfigured: true,
        isConnected: !!connection,
        hasCloudBackup: !!connection?.lastBackupAt,
        autoBackupEnabled: connection?.autoBackupEnabled ?? false,
        lastBackupAt: connection?.lastBackupAt ?? null,
      };
    }),

  getGoogleAuthUrl: procedure
    .use(requireUser)
    .query(async ({ ctx }) => {
      if (!isGoogleConfigured()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Google Drive is not configured on the server" });
      }

      const { id, email } = ctx.user;
      const url = buildGoogleAuthUrl({ userId: id, email });
      return { url };
    }),

  backupToDrive: procedure
    .use(requireUser)
    .mutation(async ({ ctx }) => {
      if (!isGoogleConfigured()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Google Drive is not configured on the server" });
      }

      const userId = ctx.user.id;
      const payload = await buildBackupPayload(ctx.prisma, userId);

      const hasAnyData = Object.values(payload.data).some((collection) =>
        Array.isArray(collection) ? collection.length > 0 : false,
      );

      if (!hasAnyData) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No data found to back up yet.",
        });
      }

      try {
        const result = await uploadBackupToDrive(userId, payload);
        return {
          ...result,
          lastBackupAt: result.backedUpAt,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upload backup to Google Drive",
          cause: error,
        });
      }
    }),

  restoreFromLocal: procedure
    .use(requireUser)
    .input(z.any())
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      try {
        const result = await restoreBackupFromPayloadForUser(userId, input as BackupPayloadV1);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Failed to restore backup from local file",
          cause: error,
        });
      }
    }),

  restoreFromDrive: procedure
    .use(requireUser)
    .mutation(async ({ ctx }) => {
      if (!isGoogleConfigured()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Google Drive is not configured on the server" });
      }

      const userId = ctx.user.id;

      try {
        const result = await restoreLatestBackupForUser(userId);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to restore backup from Google Drive",
          cause: error,
        });
      }
    }),

  setAutoBackupEnabled: procedure
    .use(requireUser)
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!isGoogleConfigured()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Google Drive is not configured on the server" });
      }

      const userId = ctx.user.id;
      const connection = await ctx.prisma.googleDriveConnection.findUnique({ where: { userId } });

      if (!connection) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Google Drive is not connected for this account" });
      }

      await ctx.prisma.googleDriveConnection.update({
        where: { userId },
        data: { autoBackupEnabled: input.enabled },
      });

      return { autoBackupEnabled: input.enabled } as const;
    }),
});
