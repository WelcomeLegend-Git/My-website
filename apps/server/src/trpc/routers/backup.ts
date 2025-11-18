import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";

import { env } from "../../env";
import { uploadBackupToDrive, buildGoogleAuthUrl } from "../../services/google-drive";
import { requireUser } from "../middleware/auth";
import { procedure, router } from "../trpc";

const buildBackupPayload = async (prisma: PrismaClient, userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }

  const [subjects, chapters, formulas, formulaAssets, mistakes, mistakeAssets, quizSessions, quizQuestions, practiceQuizzes, practiceQuestions, practiceAttempts, formulaCollections] =
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
    },
  } as const;
};

const isGoogleConfigured = () =>
  Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_OAUTH_REDIRECT_URL);

export const backupRouter = router({
  exportMyData: procedure
    .use(requireUser)
    .query(async ({ ctx }) => {
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
        autoBackupEnabled: false,
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
});
