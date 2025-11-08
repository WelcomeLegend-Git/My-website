import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requireUser } from "../middleware/auth";
import { procedure, router } from "../trpc";

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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prompt = `You are an expert mentor helping a JEE aspirant. Current section: ${input.section}.
Context: ${JSON.stringify(input.context ?? {})}
Student message: ${input.message}
Provide a concise, structured response with actionable guidance.`;

      const response = await ctx.gemini.generate({ prompt });
      return { reply: response.text };
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

Respond STRICTLY in this JSON format:
{
  "questions": [
    {
      "questionText": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "..."
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
      const updated = await ctx.prisma.quizQuestion.update({
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
});