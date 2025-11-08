import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requireUser } from "../middleware/auth";
import { procedure, router } from "../trpc";

type MindMapNodeInput = {
  id: string;
  label: string;
  detail?: string | null;
  children: MindMapNodeInput[];
};

const mindMapNodeInput: z.ZodType<MindMapNodeInput, z.ZodTypeDef, any> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    detail: z.string().optional().nullable(),
    children: z.array(mindMapNodeInput).default([]),
  })
) as any;

const mindMapInput = z.object({
  root: mindMapNodeInput,
  createdBy: z.enum(["user", "ai"]),
  generatedAt: z.coerce.date(),
});

const baseFormulaInput = z.object({
  subjectId: z.string().min(1),
  chapterId: z.string().min(1),
  title: z.string().min(1).max(180),
  expression: z.string().min(1),
  explanation: z.string().optional().nullable(),
  derivationSteps: z.array(z.string().min(1)).default([]),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  tags: z.array(z.string().min(1)).default([]),
  mindMap: mindMapInput.optional().nullable(),
  attachments: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(["image", "pdf", "link"]),
        url: z.string().url(),
        title: z.string().optional().nullable(),
      })
    )
    .default([]),
});

export const formulasRouter = router({
  list: procedure
    .use(requireUser)
    .input(
      z
        .object({
          subjectId: z.string().optional(),
          chapterId: z.string().optional(),
          search: z.string().optional(),
          tags: z.array(z.string()).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where = {
        ownerId: ctx.user.id,
        ...(input?.subjectId ? { subjectId: input.subjectId } : {}),
        ...(input?.chapterId ? { chapterId: input.chapterId } : {}),
      };

      const formulas = await ctx.prisma.formula.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: {
          assets: true,
          subject: true,
          chapter: true,
        },
      });

      return formulas
        .filter((formula) => {
          if (input?.search) {
            const haystack = `${formula.title} ${formula.expression} ${formula.explanation ?? ""}`.toLowerCase();
            if (!haystack.includes(input.search.toLowerCase())) {
              return false;
            }
          }
          if (input?.tags?.length) {
            const tags = (formula.tags as string[]) ?? [];
            return input.tags.every((tag) => tags.includes(tag));
          }
          return true;
        })
        .map((formula) => ({
          ...formula,
          derivationSteps: formula.derivationSteps as string[],
          tags: (formula.tags as string[]) ?? [],
          mindMap: formula.mindMap as unknown,
        }));
    }),
  create: procedure.use(requireUser).input(baseFormulaInput).mutation(async ({ ctx, input }) => {
    const chapter = await ctx.prisma.chapter.findUnique({
      where: { id: input.chapterId },
      include: { subject: true },
    });
    if (!chapter || chapter.subject.ownerId !== ctx.user.id) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Chapter not found" });
    }

    const formula = await ctx.prisma.formula.create({
      data: {
        title: input.title,
        expression: input.expression,
        explanation: input.explanation,
        difficulty: input.difficulty,
        derivationSteps: input.derivationSteps,
        tags: input.tags,
        mindMap: input.mindMap ?? undefined,
        subjectId: input.subjectId,
        chapterId: input.chapterId,
        ownerId: ctx.user.id,
        assets: {
          create: input.attachments.map((attachment) => ({
            kind: attachment.kind,
            url: attachment.url,
            title: attachment.title,
          })),
        },
      },
      include: { assets: true },
    });

    return {
      ...formula,
      derivationSteps: formula.derivationSteps as string[],
      tags: (formula.tags as string[]) ?? [],
    };
  }),
  update: procedure
    .use(requireUser)
    .input(baseFormulaInput.merge(z.object({ id: z.string().min(1) })))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.formula.findUnique({
        where: { id: input.id },
        include: { chapter: { include: { subject: true } } },
      });
      if (!existing || existing.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.prisma.formulaAsset.deleteMany({ where: { formulaId: input.id } });

      const formula = await ctx.prisma.formula.update({
        where: { id: input.id },
        data: {
          title: input.title,
          expression: input.expression,
          explanation: input.explanation,
          difficulty: input.difficulty,
          derivationSteps: input.derivationSteps,
          tags: input.tags,
          mindMap: input.mindMap ?? undefined,
          subjectId: input.subjectId,
          chapterId: input.chapterId,
          assets: {
            create: input.attachments.map((attachment) => ({
              kind: attachment.kind,
              url: attachment.url,
              title: attachment.title,
            })),
          },
        },
        include: { assets: true },
      });

      return {
        ...formula,
        derivationSteps: formula.derivationSteps as string[],
        tags: (formula.tags as string[]) ?? [],
      };
    }),
  remove: procedure
    .use(requireUser)
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.formula.findUnique({ where: { id: input.id } });
      if (!existing || existing.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.prisma.formula.delete({ where: { id: input.id } });
      return { success: true };
    }),
  generateMindMap: procedure
    .use(requireUser)
    .input(
      z.object({
        prompt: z.string().min(10),
        imageBase64: z.string().optional(),
        mimeType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.gemini.generate({
        prompt: `Create a JSON mind map for the following formula or concept with concise nodes. Each node should have id, label, detail, and children. Respond ONLY with JSON.
Context: ${input.prompt}`,
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
      });

      const parsed = mindMapInput.safeParse(JSON.parse(response.text));
      if (!parsed.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse mind map" });
      }

      return parsed.data;
    }),
});