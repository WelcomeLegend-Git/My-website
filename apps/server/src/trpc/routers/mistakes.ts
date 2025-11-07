import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requireUser } from "../middleware/auth";
import { procedure, router } from "../trpc";

const baseMistakeInput = z.object({
  subjectId: z.string().min(1),
  chapterId: z.string().min(1),
  title: z.string().min(1).max(180),
  description: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  status: z.enum(["new", "reviewing", "resolved"]).default("new"),
  errorType: z.enum(["conceptual", "calculation", "careless", "unknown"]).default("unknown"),
  aiSummary: z.string().optional().nullable(),
  aiMindMap: z.any().optional().nullable(),
  attachments: z
    .array(
      z.object({
        id: z.string().min(1),
        url: z.string().url(),
        kind: z.enum(["image", "pdf", "question", "solution", "working", "note", "link"]),
        caption: z.string().optional().nullable(),
      })
    )
    .default([]),
});

export const mistakesRouter = router({
  list: procedure
    .use(requireUser)
    .input(
      z
        .object({
          subjectId: z.string().optional(),
          chapterId: z.string().optional(),
          status: z.enum(["new", "reviewing", "resolved"]).optional(),
          difficulty: z.enum(["easy", "medium", "hard"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where = {
        ownerId: ctx.user.id,
        ...(input?.subjectId ? { subjectId: input.subjectId } : {}),
        ...(input?.chapterId ? { chapterId: input.chapterId } : {}),
        ...(input?.status ? { status: input.status } : {}),
        ...(input?.difficulty ? { difficulty: input.difficulty } : {}),
      };

      const mistakes = await ctx.prisma.mistake.findMany({
        where,
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        include: {
          assets: true,
          subject: true,
          chapter: true,
        },
      });

      return mistakes.map((mistake) => ({
        ...mistake,
        aiMindMap: mistake.aiMindMap as unknown,
      }));
    }),
  create: procedure.use(requireUser).input(baseMistakeInput).mutation(async ({ ctx, input }) => {
    const chapter = await ctx.prisma.chapter.findUnique({
      where: { id: input.chapterId },
      include: { subject: true },
    });
    if (!chapter || chapter.subject.ownerId !== ctx.user.id) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    const mistake = await ctx.prisma.mistake.create({
      data: {
        subjectId: input.subjectId,
        chapterId: input.chapterId,
        ownerId: ctx.user.id,
        title: input.title,
        description: input.description,
        difficulty: input.difficulty,
        status: input.status,
        errorType: input.errorType,
        aiSummary: input.aiSummary,
        aiMindMap: input.aiMindMap ?? undefined,
        assets: {
          create: input.attachments.map((attachment) => ({
            url: attachment.url,
            kind: attachment.kind,
            caption: attachment.caption,
          })),
        },
      },
      include: { assets: true },
    });

    return {
      ...mistake,
      aiMindMap: mistake.aiMindMap as unknown,
    };
  }),
  update: procedure
    .use(requireUser)
    .input(baseMistakeInput.merge(z.object({ id: z.string().min(1) })))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.mistake.findUnique({
        where: { id: input.id },
        include: { chapter: { include: { subject: true } } },
      });
      if (!existing || existing.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.prisma.mistakeAsset.deleteMany({ where: { mistakeId: input.id } });

      const mistake = await ctx.prisma.mistake.update({
        where: { id: input.id },
        data: {
          subjectId: input.subjectId,
          chapterId: input.chapterId,
          title: input.title,
          description: input.description,
          difficulty: input.difficulty,
          status: input.status,
          errorType: input.errorType,
          aiSummary: input.aiSummary,
          aiMindMap: input.aiMindMap ?? undefined,
          assets: {
            create: input.attachments.map((attachment) => ({
              url: attachment.url,
              kind: attachment.kind,
              caption: attachment.caption,
            })),
          },
        },
        include: { assets: true },
      });

      return {
        ...mistake,
        aiMindMap: mistake.aiMindMap as unknown,
      };
    }),
  transition: procedure
    .use(requireUser)
    .input(
      z.object({
        id: z.string().min(1),
        status: z.enum(["new", "reviewing", "resolved"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.mistake.findUnique({ where: { id: input.id } });
      if (!existing || existing.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.prisma.mistake.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),
  remove: procedure
    .use(requireUser)
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.mistake.findUnique({ where: { id: input.id } });
      if (!existing || existing.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.prisma.mistake.delete({ where: { id: input.id } });
      return { success: true };
    }),
  analyze: procedure
    .use(requireUser)
    .input(
      z.object({
        description: z.string().min(20),
        steps: z.string().optional(),
        imageBase64: z.string().optional(),
        mimeType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.gemini.generate({
        prompt: `You are an expert JEE tutor. Analyze the student's mistake described below. Provide a JSON payload with keys summary (string) and mindMap (object with root nodes similar to a concept map). Respond ONLY with JSON.
${input.description}
${input.steps ? `Workings: ${input.steps}` : ""}`,
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
      });

      try {
        const parsed = JSON.parse(response.text);
        return parsed;
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse AI response", cause: error });
      }
    }),
});