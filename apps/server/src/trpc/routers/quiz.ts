import { router, procedure } from "../trpc";
import { requireUser } from "../middleware/auth";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const quizConfigSchema = z.object({
  examType: z.enum(["mains", "advanced"]),
  questionCount: z.number().min(1).max(50),
  answerType: z.enum(["single", "multiple"]),
  includeTimer: z.boolean(),
  timeMinutes: z.number().optional(),
  scope: z.enum(["current", "all", "cross-chapter"]),
  context: z.any(), // Formula collection context
});

export const quizRouter = router({
  generateQuiz: procedure
    .use(requireUser)
    .input(quizConfigSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        console.log('Quiz generation started:', {
          user: ctx.user.email,
          config: input.examType,
          questionCount: input.questionCount,
          hasContext: !!input.context,
        });

        // Check API key
        if (!process.env.GEMINI_API_KEY) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Gemini API key not configured",
          });
        }

        // Use Gemini 2.5 Pro for high-quality question generation
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        // Build prompt based on context and configuration
        const prompt = buildQuizPrompt(input);
        console.log('Generated prompt length:', prompt.length);

        const result = await model.generateContent(prompt);
        const response = result.response.text();
        console.log('Gemini response received, length:', response.length);

        // Parse the generated questions
        const questions = parseQuizQuestions(response, input);

        // Create quiz in database
        const quiz = await ctx.prisma.practiceQuiz.create({
          data: {
            title: `${input.examType === "mains" ? "JEE Mains" : "JEE Advanced"} Practice - ${
              input.questionCount
            } Questions`,
            examType: input.examType,
            questionCount: input.questionCount,
            answerType: input.answerType,
            includeTimer: input.includeTimer,
            timeMinutes: input.timeMinutes,
            scope: input.scope,
            ownerId: ctx.user.id,
            questions: {
              create: questions.map((q, index) => ({
                questionNumber: index + 1,
                questionText: q.questionText,
                options: q.options,
                correctAnswers: q.correctAnswers,
                explanation: q.explanation,
                difficulty: q.difficulty,
                topic: q.topic,
              })),
            },
          },
          include: {
            questions: true,
          },
        });

        return {
          quizId: quiz.id,
          questionCount: quiz.questions.length,
        };
      } catch (error) {
        console.error("Quiz generation error:", error);
        
        // Provide more specific error messages
        if (error instanceof TRPCError) {
          throw error;
        }
        
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to generate quiz: ${errorMessage}`,
        });
      }
    }),

  getQuiz: procedure
    .use(requireUser)
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const quiz = await ctx.prisma.practiceQuiz.findUnique({
        where: { id: input.id },
        include: {
          questions: {
            orderBy: { questionNumber: "asc" },
          },
        },
      });

      if (!quiz || quiz.ownerId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quiz not found",
        });
      }

      return quiz;
    }),

  submitQuiz: procedure
    .use(requireUser)
    .input(
      z.object({
        quizId: z.string(),
        answers: z.record(z.string(), z.array(z.number())), // questionId -> selected options
        timeSpent: z.number(), // in seconds
      })
    )
    .mutation(async ({ ctx, input }) => {
      const quiz = await ctx.prisma.quiz.findUnique({
        where: { id: input.quizId },
        include: {
          questions: true,
        },
      });

      if (!quiz || quiz.ownerId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quiz not found",
        });
      }

      // Calculate score and analyze answers
      let correctCount = 0;
      let partialCount = 0;
      const detailedResults = quiz.questions.map((question) => {
        const userAnswers = input.answers[question.id] || [];
        const correctAnswers = question.correctAnswers as number[];

        const isCorrect =
          userAnswers.length === correctAnswers.length &&
          userAnswers.every((ans) => correctAnswers.includes(ans));

        const hasPartial =
          userAnswers.some((ans) => correctAnswers.includes(ans)) && !isCorrect;

        if (isCorrect) correctCount++;
        if (hasPartial) partialCount++;

        return {
          questionId: question.id,
          isCorrect,
          hasPartial,
          userAnswers,
          correctAnswers,
        };
      });

      const score = (correctCount / quiz.questions.length) * 100;
      const accuracy = correctCount;
      const attempted = Object.keys(input.answers).length;

      // Save quiz attempt
      const attempt = await ctx.prisma.practiceAttempt.create({
        data: {
          quizId: input.quizId,
          userId: ctx.user.id,
          score,
          accuracy,
          timeSpent: input.timeSpent,
          answers: input.answers,
          detailedResults,
          correctCount,
          partialCount,
          attemptedCount: attempted,
        },
      });

      // Update quiz with completion
      await ctx.prisma.practiceQuiz.update({
        where: { id: input.quizId },
        data: {
          completedAt: new Date(),
          score,
          accuracy,
          timeSpent: input.timeSpent,
        },
      });

      return {
        attemptId: attempt.id,
        score,
        correctCount,
        partialCount,
        totalQuestions: quiz.questions.length,
        detailedResults,
      };
    }),

  listQuizzes: procedure.use(requireUser).query(async ({ ctx }) => {
    const quizzes = await ctx.prisma.practiceQuiz.findMany({
      where: {
        ownerId: ctx.user.id,
      },
      include: {
        _count: {
          select: { questions: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return quizzes;
  }),
});

// Helper function to build prompt based on context
function buildQuizPrompt(input: z.infer<typeof quizConfigSchema>): string {
  const context = input.context;
  
  // Extract formula information from context
  let formulaInfo = "";
  if (context?.formulas && Array.isArray(context.formulas)) {
    formulaInfo = context.formulas
      .map((f: any) => `${f.title || 'Formula'}: ${f.expression || ''}`)
      .filter((line: string) => line.length > 10)
      .join("\n");
  }
  
  // If no formulas, use subject/chapter info for general questions
  if (!formulaInfo && context?.subject) {
    formulaInfo = `Subject: ${context.subject}\nChapter: ${context.chapter || 'General'}`;
  }
  
  // Fallback to generic prompt
  if (!formulaInfo) {
    formulaInfo = "General JEE Physics topics (Kinematics, Dynamics, Work-Energy, etc.)";
  }

  return `You are an expert JEE ${
    input.examType === "mains" ? "Mains" : "Advanced"
  } question generator.

Generate ${input.questionCount} high-quality multiple-choice questions based on these formulas:

${formulaInfo}

Requirements:
- Exam Type: JEE ${input.examType === "mains" ? "Mains" : "Advanced"}
- Answer Type: ${input.answerType === "single" ? "Single Correct" : "Multiple Correct"}
- Difficulty: ${
    input.examType === "advanced" ? "Advanced (multi-step, conceptual)" : "Moderate (clear, direct)"
  }
- Questions should be JEE-style with proper mathematical notation using LaTeX
- Each question must have 4 options
- ${input.answerType === "single" ? "Only ONE correct answer" : "Can have MULTIPLE correct answers"}
- Include detailed explanations
- Use proper LaTeX notation: inline $...$ and display $$...$$

Format your response as a JSON array:
[
  {
    "questionText": "Question with LaTeX: $x^2 + y^2 = r^2$",
    "options": [
      "Option A with LaTeX if needed",
      "Option B",
      "Option C",
      "Option D"
    ],
    "correctAnswers": [0], // 0-indexed, can be multiple for multiple correct
    "explanation": "Detailed explanation with LaTeX: $$F = ma$$",
    "difficulty": "medium",
    "topic": "Kinematics"
  }
]

Generate EXACTLY ${input.questionCount} questions in valid JSON format.`;
}

// Helper function to parse quiz questions from AI response
function parseQuizQuestions(response: string, input: z.infer<typeof quizConfigSchema>) {
  try {
    // Extract JSON from response (AI might add extra text)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in response");
    }

    const questions = JSON.parse(jsonMatch[0]);

    // Validate and format questions
    return questions.map((q: any) => ({
      questionText: q.questionText || q.question || "",
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswers: Array.isArray(q.correctAnswers)
        ? q.correctAnswers
        : [q.correctAnswer || 0],
      explanation: q.explanation || "",
      difficulty: q.difficulty || "medium",
      topic: q.topic || "General",
    }));
  } catch (error) {
    console.error("Failed to parse quiz questions:", error);
    throw new Error("Failed to parse generated questions");
  }
}
