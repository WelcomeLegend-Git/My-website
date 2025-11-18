import { router, procedure } from "../trpc";
import { requireUser } from "../middleware/auth";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { geminiClient } from "../../services/ai/gemini-client";

const quizConfigSchema = z.object({
  examType: z.enum(["mains", "advanced"]),
  questionCount: z.number().min(1).max(50),
  answerType: z.enum(["single", "multiple"]),
  includeTimer: z.boolean(),
  timeMinutes: z.number().optional(),
  scope: z.enum(["current", "all", "cross-chapter"]),
  context: z.any(),
  pictureQuestionRatio: z.number().min(0).max(1).optional(),
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

        // Build prompt based on context and configuration
        const prompt = buildQuizPrompt(input);
        console.log('Generated prompt length:', prompt.length);

        // Use geminiClient with premium-only mode (gemini-2.5-pro only)
        const result = await geminiClient.generate({ 
          prompt,
          usePremiumOnly: true // Only use gemini-2.5-pro with all API keys
        });
        console.log('Gemini response received, length:', result.text.length, 'model:', result.model);

        // Parse the generated questions
        const questions = parseQuizQuestions(result.text, input);

        // Determine source type from context
        const sourceType = input.context?.entity === 'mistake' ? 'mistake' : 'formula';
        const mistakeIds = input.context?.entity === 'mistake' && input.context?.id ? [input.context.id] : [];
        const formulaIds = input.context?.entity === 'formula' && input.context?.id ? [input.context.id] : 
                          input.context?.formulas ? input.context.formulas.map((f: any) => f.id) : [];

        // Ensure there is a backing User row for this ownerId (important for guest sessions)
        await ctx.prisma.user.upsert({
          where: { id: ctx.user.id },
          create: {
            id: ctx.user.id,
            email: ctx.user.email,
            name: ctx.user.email,
            passwordHash: "guest",
          },
          update: {},
        });

        // Create quiz in database
        const quiz = await ctx.prisma.practiceQuiz.create({
          data: {
            title: `${input.examType === "mains" ? "JEE Mains" : "JEE Advanced"} ${sourceType === 'mistake' ? 'Mistake' : ''} Practice - ${
              input.questionCount
            } Questions`,
            examType: input.examType,
            questionCount: input.questionCount,
            answerType: input.answerType,
            includeTimer: input.includeTimer,
            timeMinutes: input.timeMinutes,
            scope: input.scope,
            sourceType,
            mistakeIds,
            formulaIds,
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
                diagram: q.diagram ?? undefined,
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
          attempts: {
            where: { userId: ctx.user.id },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!quiz || quiz.ownerId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quiz not found",
        });
      }

      // Include user answers and stats from latest attempt if exists
      const latestAttempt = quiz.attempts[0];
      return {
        ...quiz,
        userAnswers: latestAttempt?.answers || {},
        actualTimeSpent: latestAttempt?.timeSpent || 0,
        score: latestAttempt?.score || 0,
        accuracy: latestAttempt?.accuracy || 0,
        correctCount: latestAttempt?.correctCount || 0,
        partialCount: latestAttempt?.partialCount || 0,
        attemptedCount: latestAttempt?.attemptedCount || 0,
        detailedResults: latestAttempt?.detailedResults || [],
      };
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
      const quiz = await ctx.prisma.practiceQuiz.findUnique({
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
  const pictureRatio =
    typeof input.pictureQuestionRatio === "number"
      ? input.pictureQuestionRatio
      : input.examType === "advanced"
      ? 0.3
      : 0.2;
  
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
- When a visual diagram or graph is natural (geometry, graphs, circuits, ray diagrams, vectors), include a JSXGraph-style diagram specification. Aim for roughly ${Math.round(
    pictureRatio * 100
  )}% of questions to include a diagram when it genuinely helps understanding.

CRITICAL JSON FORMATTING RULES:
1. Respond with ONLY a JSON array. No markdown, no code blocks, no explanation text
2. ALL backslashes in LaTeX MUST be double-escaped for JSON: use \\\\ in the JSON string
3. Example valid JSON: "questionText": "Calculate $$\\\\frac{1}{2}mv^2$$"
4. Escape all quotes and special characters properly

Example format:
[
  {
    "questionText": "Question with LaTeX: $x^2 + y^2 = r^2$",
    "options": [
      "Option A with LaTeX if needed",
      "Option B",
      "Option C",
      "Option D"
    ],
    "correctAnswers": [0],
    "explanation": "Detailed explanation with LaTeX: $$F = ma$$",
    "difficulty": "medium",
    "topic": "Kinematics",
    "diagram": {
      "type": "jsxgraph",
      "title": "Sample graph",
      "description": "Graph of $y = x^2$",
      "config": {
        "boundingBox": [-5, 5, 5, -5],
        "axes": true,
        "points": [
          { "x": 0, "y": 0, "name": "O" },
          { "x": 2, "y": 4, "name": "A" }
        ],
        "segments": [
          { "from": 0, "to": 1 }
        ]
      }
    }
  }
]

Generate EXACTLY ${input.questionCount} questions. Output ONLY the JSON array, nothing else.`;
}

// Helper function to parse quiz questions from AI response
function parseQuizQuestions(response: string, input: z.infer<typeof quizConfigSchema>) {
  try {
    // Log the response for debugging
    console.log('=== PARSING AI RESPONSE ===');
    console.log('Full response length:', response.length);
    console.log('First 1000 chars:', response.substring(0, 1000));
    console.log('Last 500 chars:', response.substring(Math.max(0, response.length - 500)));
    
    // Clean response - remove markdown code blocks if present
    let cleanedResponse = response.trim();
    
    // Remove various markdown code block formats
    cleanedResponse = cleanedResponse
      .replace(/^```json\s*/g, '')
      .replace(/^```\s*/g, '')
      .replace(/```\s*$/g, '')
      .trim();
    
    console.log('Cleaned response (first 500 chars):', cleanedResponse.substring(0, 500));
    
    // Try to find JSON array with more flexible regex
    let jsonMatch = cleanedResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
    
    if (!jsonMatch) {
      // Try alternative: Maybe it starts with array directly
      if (cleanedResponse.startsWith('[')) {
        jsonMatch = [cleanedResponse];
      } else {
        console.error('=== NO JSON ARRAY FOUND ===');
        console.error('Cleaned response:', cleanedResponse);
        throw new Error("No valid JSON array found in response. AI may have returned text instead of JSON.");
      }
    }

    console.log('Attempting to parse JSON...');
    
    // Additional cleaning: Fix common LaTeX-related JSON issues
    let jsonString = jsonMatch[0];
    
    // Try parsing with multiple strategies
    let questions;
    try {
      questions = JSON.parse(jsonString);
    } catch (firstError) {
      console.log('First parse failed, trying to fix LaTeX escaping...');
      
      // Strategy: Use a more lenient JSON parser or fix common issues
      // Fix: Replace problematic escape sequences (but preserve valid ones)
      try {
        // Alternative: Try parsing with relaxed JSON (JSON5-like approach)
        // For now, try to fix common LaTeX issues
        const fixed = jsonString
          // Fix incomplete escape sequences at the end of strings
          .replace(/\\(?=\s*["'])/g, '\\\\')
          // Fix single backslashes followed by non-escape chars
          .replace(/\\([^"\\\/bfnrtu])/g, '\\\\$1');
        
        questions = JSON.parse(fixed);
        console.log('✅ Fixed JSON parsing with LaTeX cleanup');
      } catch (secondError) {
        console.error('Second parse also failed:', secondError);
        throw new Error(
          `Failed to parse JSON even after cleanup. Original error: ${
            firstError instanceof Error ? firstError.message : 'Unknown'
          }. This usually means the AI generated malformed JSON with LaTeX notation. Try generating again.`
        );
      }
    }
    console.log(`✅ Successfully parsed ${questions.length} questions`);

    // Validate that we have enough questions
    if (questions.length === 0) {
      throw new Error("No questions generated");
    }

    // Validate and format questions
    return questions.map((q: any, index: number) => {
      if (!q.questionText && !q.question) {
        console.warn(`Question ${index + 1} missing text`);
      }
      if (!Array.isArray(q.options) || q.options.length === 0) {
        console.warn(`Question ${index + 1} missing options`);
      }
      
      return {
        questionText: q.questionText || q.question || "",
        options: Array.isArray(q.options) ? q.options : [],
        correctAnswers: Array.isArray(q.correctAnswers)
          ? q.correctAnswers
          : [q.correctAnswer || 0],
        explanation: q.explanation || "",
        difficulty: q.difficulty || "medium",
        topic: q.topic || "General",
        diagram: q.diagram || undefined,
      };
    });
  } catch (error) {
    console.error("=== PARSING ERROR ===");
    console.error("Error details:", error);
    console.error("Full response:", response);
    
    const errorMsg = error instanceof Error ? error.message : "Unknown parsing error";
    throw new Error(`Failed to parse generated questions: ${errorMsg}. Check server logs for full response.`);
  }
}
