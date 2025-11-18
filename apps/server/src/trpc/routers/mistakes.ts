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
  aiDiagram: z.any().optional().nullable(),
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
        aiDiagram: mistake.aiDiagram as unknown,
      }));
    }),
  
  getMistake: procedure
    .use(requireUser)
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const mistake = await ctx.prisma.mistake.findUnique({
        where: { id: input.id },
        include: {
          assets: true,
          subject: true,
          chapter: true,
        },
      });

      if (!mistake || mistake.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mistake not found" });
      }

      return {
        ...mistake,
        aiMindMap: mistake.aiMindMap as unknown,
        aiDiagram: mistake.aiDiagram as unknown,
      };
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
        aiDiagram: input.aiDiagram ?? undefined,
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
          aiDiagram: input.aiDiagram ?? undefined,
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
  analyzeWithImages: procedure
    .use(requireUser)
    .input(
      z.object({
        images: z.array(
          z.object({
            data: z.string(),
            mimeType: z.string(),
          })
        ),
        userContext: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prompt = `You are an expert JEE (Joint Entrance Examination) tutor analyzing a student's mistake from their work.

Carefully examine the uploaded images and provide a comprehensive analysis.

${input.userContext ? `Additional Context: ${input.userContext}\n` : ""}

Analyze and return ONLY valid JSON with this exact structure:
{
  "title": "Brief, descriptive title of the mistake (max 100 chars)",
  "errorType": "conceptual" | "calculation" | "careless" | "unknown",
  "difficulty": "easy" | "medium" | "hard",
  "subject": "Physics" | "Chemistry" | "Mathematics",
  "suggestedChapter": "Appropriate chapter name for this topic",
  "analysis": {
    "whatWentWrong": "Clear explanation of what the student did wrong",
    "whyWrong": "Why this approach/answer is incorrect",
    "correctApproach": "Step-by-step correct method to solve this",
    "keyConcepts": ["concept1", "concept2", "concept3"]
  },
  "similarTopics": ["topic1", "topic2", "topic3"],
  "bestImageIndex": 0,
  "aiSummary": "Comprehensive summary of the mistake and learning points",
  "aiMindMap": {
    "root": "Main Concept",
    "branches": [
      {"label": "Branch 1", "children": []},
      {"label": "Branch 2", "children": []}
    ]
  },
  "aiDiagram": {
    "type": "jsxgraph",
    "title": "Optional JEE-style diagram illustrating the mistake or correct concept",
    "description": "Short description of what the diagram shows (free-body diagram, circuit, field, graph, etc.)",
    "config": {
      "boundingBox": [-6, 4, 6, -4],
      "axes": false,
      "points": [...],
      "segments": [...],
      "polylines": [...],
      "polygons": [...],
      "circles": [...],
      "arcs": [...],
      "fieldRegions": [...],
      "springs": [...],
      "labels": [...]
    }
  }
}

Important:
- "bestImageIndex" should be the index (0-${input.images.length - 1}) of the image that best shows the error
- Provide actionable, encouraging feedback
- Focus on learning, not just correction
- Return ONLY the JSON object, no markdown formatting`;

      // Use upgraded geminiClient with multi-image support and 4-API fallback
      const result = await ctx.gemini.generate({
        prompt,
        images: input.images, // Pass multiple images directly
        usePremiumOnly: true, // Use Gemini 2.5 Pro with all 4 API keys
      });

      // Extract JSON from markdown if present
      const jsonMatch = result.text.match(/```json\n([\s\S]*?)\n```/) || result.text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : result.text;
      
      try {
        const analysis = JSON.parse(jsonText);
        return analysis;
      } catch (parseError) {
        throw new TRPCError({ 
          code: "INTERNAL_SERVER_ERROR", 
          message: "Failed to parse AI analysis. Please try again.",
          cause: parseError 
        });
      }
    }),
});