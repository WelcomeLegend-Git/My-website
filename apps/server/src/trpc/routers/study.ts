import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requireUser } from "../middleware/auth";
import { procedure, router } from "../trpc";
import { openRouterClient } from "../../services/ai/openrouter-client";
import { logger } from "../../logger";

// Quiz session management types
type QuizQuestionInput = {
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  formulaId?: string;
};

export const studyRouter = router({
  explainFormula: procedure
    .use(requireUser)
    .input(z.object({ formulaId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const formula = await ctx.prisma.formula.findUnique({
        where: { id: input.formulaId },
        include: { subject: true, chapter: true },
      });
      if (!formula || formula.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const response = await ctx.gemini.generate({
        prompt: `Explain the following JEE preparation formula in a structured manner. Include intuitive understanding, important relationships, common mistakes, and quick tips.
Subject: ${formula.subject.name}
Chapter: ${formula.chapter.title}
Formula Title: ${formula.title}
Expression: ${formula.expression}
Explanation: ${formula.explanation ?? "N/A"}
Derivation Steps: ${(formula.derivationSteps as string[]).join("\n")}`,
      });

      return { explanation: response.text };
    }),
  generateQuiz: procedure
    .use(requireUser)
    .input(
      z.object({
        formulaIds: z.array(z.string().min(1)).min(1),
        questionCount: z.number().min(1).max(10).default(5),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const formulas = await ctx.prisma.formula.findMany({
        where: { id: { in: input.formulaIds }, ownerId: ctx.user.id },
        include: { subject: true, chapter: true },
      });
      if (!formulas.length) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const context = formulas
        .map(
          (formula) => `Title: ${formula.title}
Expression: ${formula.expression}
Explanation: ${formula.explanation ?? "N/A"}`
        )
        .join("\n---\n");

      const response = await ctx.gemini.generate({
        prompt: `Create ${input.questionCount} practice questions for the following formulas. For each question, provide:
1. question (string)
2. options (array of 4 options)
3. correctAnswer (string)
4. explanation (string)
Respond STRICTLY in JSON with a top-level array of question objects.

${context}`,
      });

      try {
        return JSON.parse(response.text);
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse quiz", cause: error });
      }
    }),
  contextualAssistant: procedure
    .use(requireUser)
    .input(
      z.object({
        section: z.enum(["formulas", "mistakes", "study"]),
        context: z.record(z.any()).optional(),
        message: z.string().min(1),
        images: z.array(z.object({
          data: z.string(),
          mimeType: z.string()
        })).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const baseContext = input.context ?? {};
      const isStudyGuru = (baseContext as any).mode === "study_guru";
      const studyGuruGeminiModels = ["gemini-2.5-flash", "gemini-2.5-pro"] as const;
      const studyGuruOpenRouterModels = [
        "openrouter/sherlock-think-alpha",
        "tngtech/deepseek-r1t2-chimera:free",
        "deepseek/deepseek-r1-0528:free",
        "qwen/qwen3-coder:free",
        "z-ai/glm-4.5-air:free",
      ] as const;
      const rawRequestedModel =
        isStudyGuru && typeof (baseContext as any).model === "string"
          ? ((baseContext as any).model as string)
          : undefined;

      const isStudyGuruGeminiModel =
        rawRequestedModel && studyGuruGeminiModels.includes(rawRequestedModel as any);
      const isStudyGuruOpenRouterModel =
        rawRequestedModel && studyGuruOpenRouterModels.includes(rawRequestedModel as any);

      const requestedModel =
        isStudyGuruGeminiModel && rawRequestedModel
          ? rawRequestedModel
          : undefined;

      let prompt: string;

      if (isStudyGuru) {
        const rawHistoryFull = Array.isArray((baseContext as any).chatHistory)
          ? ((baseContext as any).chatHistory as Array<{ role?: string; content?: unknown }>)
          : [];

        const maxMessages = 40;
        const rawHistory =
          rawHistoryFull.length > maxMessages
            ? rawHistoryFull.slice(rawHistoryFull.length - maxMessages)
            : rawHistoryFull;

        let historyText = rawHistory
          .map((m, index) => {
            const role = m?.role === "assistant" ? "Study Guru" : "Student";
            const content =
              typeof m?.content === "string" ? m.content : JSON.stringify(m?.content ?? "");
            return `${index + 1}. ${role}: ${content}`;
          })
          .join("\n");

        const maxChars = 24000;
        if (historyText.length > maxChars) {
          historyText = historyText.slice(historyText.length - maxChars);
        }

        prompt = `You are **Study Guru**, a highly tuned AI mentor for JEE aspirants.

Your goals:
- Teach concepts with strong intuition and exam focus.
- Adapt depth: be brief for simple factual queries, detailed for "why/how/explain" questions.
- Use clear headings, bullet points, and step-by-step reasoning.
- When relevant, include LaTeX math using \\( ... \\) or \\[ ... \\].

Full conversation so far (most recent messages last):
${historyText || "No prior messages; this is the first question."}

Current student message:
${input.message}

Now reply as Study Guru with a structured, student-friendly answer.
If the student seems confused, anticipate mistakes and give quick exam tips at the end.`;

        // If user selected an OpenRouter model for Study Guru, route the request there
        if (isStudyGuruOpenRouterModel && rawRequestedModel) {
          try {
            // Note: OpenRouter client currently doesn't support images in this simple wrapper
            // If images are present, we might want to fallback to Gemini or warn
            // For now, we'll just send text to OpenRouter
            const result = await openRouterClient.generateChat({
              model: rawRequestedModel,
              messages: [
                {
                  role: "user",
                  content: prompt,
                  // TODO: Add image support to OpenRouter client if needed
                },
              ],
            });
            return { reply: result.text };
          } catch (error) {
            logger.warn({ error, model: rawRequestedModel }, "Study Guru OpenRouter call failed, falling back to Gemini");
            // Fall through to Gemini below if OpenRouter fails
          }
        }
      } else {
        prompt = `You are an expert mentor helping a JEE aspirant. Current section: ${input.section}.
Context: ${JSON.stringify(input.context ?? {})}
Student message: ${input.message}
Provide a concise, structured response with actionable guidance.`;
      }

      // Use premium model for quiz analysis (quiz_history or quiz_results)
      const usePremium = input.context?.type === "quiz_history" || input.context?.type === "quiz_results";

      // Premium paths (quiz analysis) always use Gemini 2.5 Pro only
      if (usePremium) {
        const response = await ctx.gemini.generate({
          prompt,
          usePremiumOnly: true,
          images: input.images,
        });
        return { reply: response.text };
      }

      // Non-premium Study Guru with Gemini model selection
      if (isStudyGuru) {
        const response = await ctx.gemini.generate({
          prompt,
          model: requestedModel,
          images: input.images,
        });
        return { reply: response.text };
      }

      // Non-premium AI Mentor fallback chain (non-StudyGuru):
      // 1) OpenRouter TNG DeepSeek R1T2 Chimera
      try {
        const first = await openRouterClient.generateChat({
          model: "tngtech/deepseek-r1t2-chimera:free",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        });
        return { reply: first.text };
      } catch (error) {
        logger.warn({ error }, "AI Mentor OpenRouter TNG DeepSeek failed, falling back to Gemini 2.5 Flash");
      }

      // 2) Gemini 2.5 Flash (all Gemini API keys, this model only)
      try {
        const second = await ctx.gemini.generate({
          prompt,
          model: "gemini-2.5-flash",
        });
        return { reply: second.text };
      } catch (error) {
        logger.warn({ error }, "AI Mentor Gemini 2.5 Flash failed, falling back to OpenRouter GLM-4.5 Air");
      }

      // 3) OpenRouter GLM-4.5 Air
      try {
        const third = await openRouterClient.generateChat({
          model: "z-ai/glm-4.5-air:free",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        });
        return { reply: third.text };
      } catch (error) {
        logger.warn({ error }, "AI Mentor OpenRouter GLM-4.5 Air failed; all providers exhausted");
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "All AI providers failed for this request. Please try again later.",
      });
    }),

  // Create a new quiz session
  createSession: procedure
    .use(requireUser)
    .input(
      z.object({
        title: z.string().min(1),
        type: z.enum(["formula_based", "mistake_review", "mixed"]),
        subjectId: z.string().optional(),
        chapterId: z.string().optional(),
        formulaIds: z.array(z.string()).min(1),
        questionCount: z.number().min(1).max(20).default(5),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch formulas for quiz generation
      const formulas = await ctx.prisma.formula.findMany({
        where: {
          id: { in: input.formulaIds },
          ownerId: ctx.user.id,
        },
        include: { subject: true, chapter: true },
      });

      if (!formulas.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No formulas found" });
      }

      // Generate questions using AI
      const context = formulas
        .map(
          (f) => `Formula: ${f.title}
Expression: ${f.expression}
Explanation: ${f.explanation ?? ""}
Difficulty: ${f.difficulty}`
        )
        .join("\n\n");

      const prompt = `Generate ${input.questionCount} multiple-choice questions for JEE preparation based on these formulas.

${context}

For each question, provide:
1. questionText (clear, JEE-level difficulty)
2. options (array of 4 options)
3. correctAnswer (index 0-3)
4. explanation (why the answer is correct)
5. diagram (optional): A JSXGraph-compatible diagram spec when a visual aid would help

When a diagram is natural (mechanics setups, circuits, fields, ray diagrams, graphs), include it using this JSON shape:
{
  "type": "jsxgraph",
  "title": "Short diagram title",
  "description": "1-2 line description of what the figure shows",
  "config": {
    "boundingBox": [-6, 4, 6, -4],
    "axes": false,
    "points": [],
    "segments": [],
    "polylines": [],
    "polygons": [],
    "circles": [],
    "arcs": [],
    "arrows": [],
    "angles": [],
    "fieldRegions": [],
    "springs": [],
    "labels": []
  }
}

IMPORTANT DIAGRAM RULES:
- Use "arrows" for all vectors, forces, and rays.
- Use LaTeX for labels (e.g., "\\( F_{net} \\)").
- Use light fills for polygons (bodies/blocks).
- Make diagrams professional and not too simple.

Respond STRICTLY in this JSON format:
{
  "questions": [
    {
      "questionText": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "...",
      "diagram": { ... } // optional
    }
  ]
}`;

      const response = await ctx.gemini.generate({ prompt });

      let questions: QuizQuestionInput[] = [];
      try {
        const parsed = JSON.parse(response.text);
        questions = parsed.questions || [];
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate quiz",
          cause: error,
        });
      }

      if (!questions.length) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No questions generated" });
      }

      // Create session with questions
      const session = await ctx.prisma.quizSession.create({
        data: {
          title: input.title,
          type: input.type,
          subjectId: input.subjectId,
          chapterId: input.chapterId,
          totalQuestions: questions.length,
          ownerId: ctx.user.id,
          questions: {
            create: questions.map((q, index) => ({
              questionText: q.questionText,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              formulaId: input.formulaIds[index % input.formulaIds.length],
              diagram: (q as any).diagram || undefined,
            })),
          },
        },
        include: {
          questions: true,
        },
      });

      return session;
    }),

  // Get quiz session by ID
  getSession: procedure
    .use(requireUser)
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.prisma.quizSession.findUnique({
        where: { id: input.sessionId },
        include: { questions: true },
      });

      if (!session || session.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return session;
    }),

  // Submit answer for a question
  submitAnswer: procedure
    .use(requireUser)
    .input(
      z.object({
        questionId: z.string(),
        answerIndex: z.number().min(0).max(3),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const question = await ctx.prisma.quizQuestion.findUnique({
        where: { id: input.questionId },
        include: { session: true },
      });

      if (!question || question.session.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (question.userAnswer !== null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Already answered" });
      }

      const isCorrect = input.answerIndex === question.correctAnswer;

      // Update question
      await ctx.prisma.quizQuestion.update({
        where: { id: input.questionId },
        data: {
          userAnswer: input.answerIndex,
          isCorrect,
        },
      });

      // Update session correct count if correct
      if (isCorrect) {
        await ctx.prisma.quizSession.update({
          where: { id: question.sessionId },
          data: {
            correctAnswers: { increment: 1 },
          },
        });
      }

      return {
        isCorrect,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      };
    }),

  // Complete quiz session
  completeSession: procedure
    .use(requireUser)
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.prisma.quizSession.findUnique({
        where: { id: input.sessionId },
        include: { questions: true },
      });

      if (!session || session.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (session.completedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Already completed" });
      }

      const updatedSession = await ctx.prisma.quizSession.update({
        where: { id: input.sessionId },
        data: { completedAt: new Date() },
        include: { questions: true },
      });

      return updatedSession;
    }),

  // Get quiz history
  getHistory: procedure
    .use(requireUser)
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
        type: z.enum(["formula_based", "mistake_review", "mixed"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const sessions = await ctx.prisma.quizSession.findMany({
        where: {
          ownerId: ctx.user.id,
          type: input.type,
        },
        include: {
          questions: {
            select: {
              id: true,
              isCorrect: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });

      return sessions;
    }),

  // Delete quiz session
  deleteSession: procedure
    .use(requireUser)
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.prisma.quizSession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session || session.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.prisma.quizSession.delete({
        where: { id: input.sessionId },
      });

      return { success: true };
    }),

  listStudyGuruConversations: procedure
    .use(requireUser)
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).default(20),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const take = input?.limit ?? 20;
      const conversations = await ctx.prisma.studyGuruConversation.findMany({
        where: { ownerId: ctx.user.id },
        orderBy: { updatedAt: "desc" },
        take,
      });

      return conversations;
    }),

  saveStudyGuruConversation: procedure
    .use(requireUser)
    .input(
      z.object({
        id: z.string().optional(),
        title: z.string().min(1),
        messages: z.any(),
        model: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        const existing = await ctx.prisma.studyGuruConversation.findFirst({
          where: { id: input.id, ownerId: ctx.user.id },
        });

        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        const updated = await ctx.prisma.studyGuruConversation.update({
          where: { id: existing.id },
          data: {
            title: input.title,
            messages: input.messages,
            model: input.model,
          },
        });

        return updated;
      }

      const created = await ctx.prisma.studyGuruConversation.create({
        data: {
          title: input.title,
          messages: input.messages,
          model: input.model,
          ownerId: ctx.user.id,
        },
      });

      return created;
    }),

  deleteStudyGuruConversation: procedure
    .use(requireUser)
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.studyGuruConversation.findFirst({
        where: { id: input.id, ownerId: ctx.user.id },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.prisma.studyGuruConversation.delete({
        where: { id: existing.id },
      });

      return { success: true };
    }),

  // Verify AI access code
  verifyAiAccess: procedure
    .use(requireUser)
    .input(z.object({ code: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { env } = await import("../../env");

      if (input.code.trim() !== env.AI_ACCESS_CODE) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid access code. Please contact the owner for the correct code."
        });
      }

      return {
        success: true,
        message: "AI Mentor access granted! You can now use all AI features."
      };
    }),
});