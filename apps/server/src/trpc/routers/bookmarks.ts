import { z } from "zod";

import { requireUser } from "../middleware/auth";
import { procedure, router } from "../trpc";

const bookmarkEntityTypeSchema = z.enum([
  "formula_collection",
  "formula",
  "mistake",
  "practice_quiz",
  "practice_question",
  "study_guru_message",
]);

const toggleInput = z.discriminatedUnion("entityType", [
  z.object({
    entityType: z.literal("formula_collection"),
    entityId: z.string().min(1),
    metadata: z.any().optional(),
  }),
  z.object({
    entityType: z.literal("formula"),
    entityId: z.string().min(1),
    metadata: z.any().optional(),
  }),
  z.object({
    entityType: z.literal("mistake"),
    entityId: z.string().min(1),
    metadata: z.any().optional(),
  }),
  z.object({
    entityType: z.literal("practice_quiz"),
    entityId: z.string().min(1),
    metadata: z.any().optional(),
  }),
  z.object({
    entityType: z.literal("practice_question"),
    entityId: z.string().min(1),
    metadata: z.any().optional(),
  }),
  z.object({
    entityType: z.literal("study_guru_message"),
    entityId: z.string().min(1), // Study Guru conversation ID
    messageIndex: z.number().int().min(0),
    metadata: z.any().optional(),
  }),
]);

const statusInput = z.object({
  entityType: bookmarkEntityTypeSchema,
  targets: z
    .array(
      z.object({
        entityId: z.string().min(1),
        messageIndex: z.number().int().optional(),
      }),
    )
    .min(1),
});

const listInput = z
  .object({
    category: z.enum(["formulas", "mistakes", "quizzes", "ai"]),
    type: z.string().optional(),
    search: z.string().optional(),
    limit: z.number().min(1).max(100).optional(),
  })
  .optional();

export const bookmarksRouter = router({
  toggle: procedure
    .use(requireUser)
    .input(toggleInput)
    .mutation(async ({ ctx, input }) => {
      const whereBase: any = {
        ownerId: ctx.user.id,
        entityType: input.entityType,
      };

      switch (input.entityType) {
        case "formula_collection":
          whereBase.formulaCollectionId = input.entityId;
          break;
        case "formula":
          whereBase.formulaId = input.entityId;
          break;
        case "mistake":
          whereBase.mistakeId = input.entityId;
          break;
        case "practice_quiz":
          whereBase.practiceQuizId = input.entityId;
          break;
        case "practice_question":
          whereBase.practiceQuestionId = input.entityId;
          break;
        case "study_guru_message":
          whereBase.studyGuruConversationId = input.entityId;
          whereBase.studyGuruMessageIndex = input.messageIndex;
          break;
      }

      const existing = await ctx.prisma.bookmark.findFirst({
        where: whereBase,
      });

      if (existing) {
        await ctx.prisma.bookmark.delete({
          where: { id: existing.id },
        });
        return { isBookmarked: false };
      }

      const data: any = {
        ownerId: ctx.user.id,
        entityType: input.entityType,
        metadata: "metadata" in input ? input.metadata ?? null : null,
      };

      switch (input.entityType) {
        case "formula_collection":
          data.formulaCollectionId = input.entityId;
          break;
        case "formula":
          data.formulaId = input.entityId;
          break;
        case "mistake":
          data.mistakeId = input.entityId;
          break;
        case "practice_quiz":
          data.practiceQuizId = input.entityId;
          break;
        case "practice_question":
          data.practiceQuestionId = input.entityId;
          break;
        case "study_guru_message":
          data.studyGuruConversationId = input.entityId;
          data.studyGuruMessageIndex = input.messageIndex;
          break;
      }

      const created = await ctx.prisma.bookmark.create({ data });

      return { isBookmarked: true, bookmarkId: created.id };
    }),

  getStatusForEntities: procedure
    .use(requireUser)
    .input(statusInput)
    .query(async ({ ctx, input }) => {
      const ids = input.targets.map((t) => t.entityId);
      if (!ids.length) {
        return { items: [] };
      }

      const where: any = {
        ownerId: ctx.user.id,
        entityType: input.entityType,
      };

      switch (input.entityType) {
        case "formula_collection":
          where.formulaCollectionId = { in: ids };
          break;
        case "formula":
          where.formulaId = { in: ids };
          break;
        case "mistake":
          where.mistakeId = { in: ids };
          break;
        case "practice_quiz":
          where.practiceQuizId = { in: ids };
          break;
        case "practice_question":
          where.practiceQuestionId = { in: ids };
          break;
        case "study_guru_message":
          where.studyGuruConversationId = { in: ids };
          break;
      }

      const bookmarks = await ctx.prisma.bookmark.findMany({
        where,
        select: {
          id: true,
          entityType: true,
          formulaCollectionId: true,
          formulaId: true,
          mistakeId: true,
          practiceQuizId: true,
          practiceQuestionId: true,
          studyGuruConversationId: true,
          studyGuruMessageIndex: true,
        },
      });

      const items = bookmarks
        .map((b: any) => {
          let entityId: string | null = null;

          switch (b.entityType) {
            case "formula_collection":
              entityId = b.formulaCollectionId;
              break;
            case "formula":
              entityId = b.formulaId;
              break;
            case "mistake":
              entityId = b.mistakeId;
              break;
            case "practice_quiz":
              entityId = b.practiceQuizId;
              break;
            case "practice_question":
              entityId = b.practiceQuestionId;
              break;
            case "study_guru_message":
              entityId = b.studyGuruConversationId;
              break;
          }

          if (!entityId) return null;

          return {
            bookmarkId: b.id,
            entityType: b.entityType,
            entityId,
            messageIndex: b.studyGuruMessageIndex ?? undefined,
          };
        })
        .filter((item: any): item is { bookmarkId: string; entityType: string; entityId: string; messageIndex?: number } =>
          Boolean(item),
        );

      return { items };
    }),

  listByCategory: procedure
    .use(requireUser)
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const category = input?.category ?? "formulas";
      const type = input?.type ?? "all";
      const limit = input?.limit ?? 50;
      const search = (input?.search ?? "").trim().toLowerCase();

      if (category === "formulas") {
        const take = limit;
        const items: any[] = [];

        if (type === "all" || type === "collections") {
          const collectionBookmarks = await ctx.prisma.bookmark.findMany({
            where: {
              ownerId: ctx.user.id,
              entityType: "formula_collection",
            },
            orderBy: { createdAt: "desc" },
            take,
            include: {
              formulaCollection: {
                include: {
                  subject: true,
                  chapter: true,
                  _count: { select: { formulas: true } },
                },
              },
            },
          });

          for (const b of collectionBookmarks) {
            if (!b.formulaCollection) continue;
            const title = b.formulaCollection.title;
            if (search && !title.toLowerCase().includes(search)) continue;

            items.push({
              bookmarkId: b.id,
              kind: "collection",
              entityType: b.entityType,
              collectionId: b.formulaCollectionId,
              title,
              subjectName: b.formulaCollection.subject.name,
              chapterTitle: b.formulaCollection.chapter.title,
              formulaCount: b.formulaCollection._count.formulas,
              createdAt: b.createdAt,
            });
          }
        }

        if (type === "all" || type === "formulas") {
          const formulaBookmarks = await ctx.prisma.bookmark.findMany({
            where: {
              ownerId: ctx.user.id,
              entityType: "formula",
            },
            orderBy: { createdAt: "desc" },
            take,
            include: {
              formula: {
                include: {
                  subject: true,
                  chapter: true,
                  collection: true,
                },
              },
            },
          });

          for (const b of formulaBookmarks) {
            if (!b.formula) continue;
            const title = b.formula.title;
            if (search && !title.toLowerCase().includes(search)) continue;

            items.push({
              bookmarkId: b.id,
              kind: "formula",
              entityType: b.entityType,
              formulaId: b.formulaId,
              collectionId: b.formula.collectionId,
              title,
              subjectName: b.formula.subject.name,
              chapterTitle: b.formula.chapter.title,
              createdAt: b.createdAt,
            });
          }
        }

        items.sort(
          (a, b) =>
            new Date(b.createdAt as any).getTime() -
            new Date(a.createdAt as any).getTime(),
        );

        return { items: items.slice(0, limit) };
      }

      if (category === "mistakes") {
        const bookmarks = await ctx.prisma.bookmark.findMany({
          where: {
            ownerId: ctx.user.id,
            entityType: "mistake",
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            mistake: {
              include: { subject: true, chapter: true },
            },
          },
        });

        const items = bookmarks
          .filter((b: any) => b.mistake)
          .map((b: any) => {
            const title = b.mistake!.title;
            if (search && !title.toLowerCase().includes(search)) {
              return null;
            }
            return {
              bookmarkId: b.id,
              kind: "mistake",
              entityType: b.entityType,
              mistakeId: b.mistakeId,
              title,
              subjectName: b.mistake!.subject.name,
              chapterTitle: b.mistake!.chapter.title,
              status: b.mistake!.status,
              difficulty: b.mistake!.difficulty,
              createdAt: b.createdAt,
            };
          })
          .filter(Boolean);

        return { items };
      }

      if (category === "quizzes") {
        const items: any[] = [];

        if (type === "all" || type === "quizzes") {
          const quizBookmarks = await ctx.prisma.bookmark.findMany({
            where: {
              ownerId: ctx.user.id,
              entityType: "practice_quiz",
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
              practiceQuiz: true,
            },
          });

          for (const b of quizBookmarks) {
            if (!b.practiceQuiz) continue;
            const title = b.practiceQuiz.title;
            if (search && !title.toLowerCase().includes(search)) continue;

            items.push({
              bookmarkId: b.id,
              kind: "quiz",
              entityType: b.entityType,
              quizId: b.practiceQuizId,
              title,
              examType: b.practiceQuiz.examType,
              questionCount: b.practiceQuiz.questionCount,
              score: b.practiceQuiz.score,
              accuracy: b.practiceQuiz.accuracy,
              createdAt: b.createdAt,
            });
          }
        }

        if (type === "all" || type === "questions") {
          const questionBookmarks = await ctx.prisma.bookmark.findMany({
            where: {
              ownerId: ctx.user.id,
              entityType: "practice_question",
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
              practiceQuestion: {
                include: {
                  quiz: true,
                },
              },
            },
          });

          for (const b of questionBookmarks) {
            if (!b.practiceQuestion || !b.practiceQuestion.quiz) continue;
            const title = b.practiceQuestion.quiz.title;
            if (search && !title.toLowerCase().includes(search)) continue;

            items.push({
              bookmarkId: b.id,
              kind: "question",
              entityType: b.entityType,
              questionId: b.practiceQuestionId,
              quizId: b.practiceQuestion.quizId,
              quizTitle: b.practiceQuestion.quiz.title,
              difficulty: b.practiceQuestion.difficulty,
              topic: b.practiceQuestion.topic,
              createdAt: b.createdAt,
            });
          }
        }

        items.sort(
          (a, b) =>
            new Date(b.createdAt as any).getTime() -
            new Date(a.createdAt as any).getTime(),
        );

        return { items: items.slice(0, limit) };
      }

      // AI / Study Guru bookmarks
      const aiBookmarks = await ctx.prisma.bookmark.findMany({
        where: {
          ownerId: ctx.user.id,
          entityType: "study_guru_message",
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      const items = aiBookmarks
        .map((b: any) => {
          const meta = (b.metadata as any) || {};
          const title: string =
            typeof meta.title === "string"
              ? meta.title
              : meta.messagePreview || "Saved Study Guru reply";

          if (search && !title.toLowerCase().includes(search)) {
            return null;
          }

          return {
            bookmarkId: b.id,
            kind: "ai",
            entityType: b.entityType,
            conversationId: b.studyGuruConversationId,
            messageIndex: b.studyGuruMessageIndex ?? undefined,
            title,
            createdAt: b.createdAt,
            metadata: meta,
          };
        })
        .filter(Boolean);

      return { items };
    }),
});
