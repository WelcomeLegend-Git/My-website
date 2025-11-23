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
        // Determine if we should parallelize
        const keyCount = geminiClient.keyCount;
        const shouldParallelize = input.questionCount > 5 && keyCount > 1;

        let questions: any[] = [];

        if (shouldParallelize) {
          // Calculate chunks
          // User requested to use 4 keys if available. 
          // We will use up to keyCount keys.
          const numChunks = Math.min(keyCount, 4); // Cap at 4 or keyCount
          const questionsPerChunk = Math.ceil(input.questionCount / numChunks);

          console.log(`Parallelizing quiz generation: ${input.questionCount} questions across ${numChunks} chunks using ${keyCount} available keys.`);

          const chunkPromises = [];
          for (let i = 0; i < numChunks; i++) {
            // Calculate exact number of questions for this chunk to handle remainders
            const startIdx = i * questionsPerChunk;
            if (startIdx >= input.questionCount) break;

            const endIdx = Math.min((i + 1) * questionsPerChunk, input.questionCount);
            const chunkCount = endIdx - startIdx;

            if (chunkCount <= 0) continue;

            // Create a modified input for this chunk
            const chunkInput = { ...input, questionCount: chunkCount };
            const prompt = buildQuizPrompt(chunkInput);

            // Launch parallel request with forced key index
            // We use 'i' as the forceKeyIndex to ensure distribution
            chunkPromises.push(
              geminiClient.generate({
                prompt,
                usePremiumOnly: true,
                forceKeyIndex: i
              }).then(result => ({ status: 'fulfilled', value: result, count: chunkCount }))
                .catch(error => ({ status: 'rejected', reason: error, count: chunkCount }))
            );
          }

          const results = await Promise.all(chunkPromises);

          // Process results
          for (const res of results) {
            if (res.status === 'fulfilled') {
              const chunkQuestions = parseQuizQuestions((res as any).value.text);
              questions = [...questions, ...chunkQuestions];
            } else {
              console.error('Chunk generation failed:', (res as any).reason);
              // If a chunk failed, we could retry or just accept partial results?
              // User said: "if 2 failed then 2 work...". 
              // Ideally we should retry failed chunks with remaining keys, but for now let's throw if total failure,
              // or maybe try to generate missing questions with a single call?
              // Let's try a simple fallback: if chunk failed, try one more time with NO forced key (let rotation handle it)
              try {
                console.log('Retrying failed chunk...');
                const retryCount = (res as any).count;
                const retryInput = { ...input, questionCount: retryCount };
                const retryPrompt = buildQuizPrompt(retryInput);
                const retryResult = await geminiClient.generate({
                  prompt: retryPrompt,
                  usePremiumOnly: true
                  // No forceKeyIndex, let it find a working key
                });
                const retryQuestions = parseQuizQuestions(retryResult.text);
                questions = [...questions, ...retryQuestions];
              } catch (retryError) {
                console.error('Retry also failed:', retryError);
                // We will proceed with whatever questions we have, or throw if 0?
              }
            }
          }
        } else {
          // Standard single-request generation
          const prompt = buildQuizPrompt(input);
          console.log('Generated prompt length:', prompt.length);

          const result = await geminiClient.generate({
            prompt,
            usePremiumOnly: true
          });
          console.log('Gemini response received, length:', result.text.length, 'model:', result.model);

          questions = parseQuizQuestions(result.text);
        }
        if (questions.length === 0) {
          throw new Error("Failed to generate any questions.");
        }

        // Trim to exact requested count if we got extra (due to chunk rounding)
        if (questions.length > input.questionCount) {
          questions = questions.slice(0, input.questionCount);
        }

        // Determine source type from context
        let sourceType: string = 'formula';
        if (input.context?.entity === 'mistake') {
          sourceType = 'mistake';
        } else if (input.context?.entity === 'study_guru') {
          sourceType = 'study_guru';
        }

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
            title: `${input.examType === "mains" ? "JEE Mains" : "JEE Advanced"} ${sourceType === 'mistake' ? 'Mistake' : ''} Practice - ${input.questionCount
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

  let formulaInfo = "";
  if (context?.entity === "study_guru") {
    const chapterLabel =
      typeof context.chapter === "string" && context.chapter.trim().length > 0
        ? context.chapter.trim()
        : context.subject || "General JEE preparation";
    const descriptionText =
      typeof context.description === "string" && context.description.trim().length > 0
        ? context.description.trim()
        : "No additional description provided.";
    const rawHistory = Array.isArray((context as any).chatHistoryForQuiz)
      ? ((context as any).chatHistoryForQuiz as Array<{ role?: string; content?: unknown }>)
      : [];
    const lastMessages = rawHistory.slice(-20);
    const historyText = lastMessages
      .map((m, index) => {
        const role = m?.role === "assistant" ? "Study Guru" : "Student";
        const content =
          typeof m?.content === "string" ? m.content : JSON.stringify(m?.content ?? "");
        return `${index + 1}. ${role}: ${content}`;
      })
      .join("\n");
    formulaInfo = `Study context for quiz:
Chapter: ${chapterLabel}
Description: ${descriptionText}

Recent conversation (most recent messages last):
${historyText || "No recent messages were provided. Focus on the chapter and description only."}`;
  } else {
    if (context?.formulas && Array.isArray(context.formulas)) {
      formulaInfo = context.formulas
        .map((f: any) => `${f.title || 'Formula'}: ${f.expression || ''}`)
        .filter((line: string) => line.length > 10)
        .join("\n");
    }
    if (!formulaInfo && context?.subject) {
      formulaInfo = `Subject: ${context.subject}\nChapter: ${context.chapter || 'General'}`;
    }
    if (!formulaInfo) {
      formulaInfo = "General JEE Physics topics (Kinematics, Dynamics, Work-Energy, etc.)";
    }
  }

  return `You are an expert JEE ${input.examType === "mains" ? "Mains" : "Advanced"
    } question generator.

Generate ${input.questionCount} high-quality multiple-choice questions based on the following material and context:

${formulaInfo}

Requirements:
- Exam Type: JEE ${input.examType === "mains" ? "Mains" : "Advanced"}
- Answer Type: ${input.answerType === "single" ? "Single Correct" : "Multiple Correct"}
- Difficulty: ${input.examType === "advanced" ? "Advanced (multi-step, conceptual)" : "Moderate (clear, direct)"
    }
- Questions must be JEE-style, concise, and physically accurate.
- Each question must have 4 options.
- ${input.answerType === "single" ? "Only ONE correct answer" : "Can have MULTIPLE correct answers"}.
- Include detailed explanations with LaTeX.
- Use proper LaTeX notation: inline $...$ and display $$...$$.
- Do NOT use sizing commands like \\left or \\right; just use normal parentheses ( ) and brackets [ ].
- When a visual diagram is natural (mechanics setups, circuits, fields, ray diagrams, graphs), include a JSXGraph-style diagram specification using the schema below. Aim for roughly ${Math.round(
      pictureRatio * 100
    )}% of questions to include a diagram when it genuinely helps understanding.

Diagram specification (when needed):
- Use this JSON shape inside each question (this block is an explanation; your ANSWER must be pure JSON with no comments):
  "diagram": {
    "type": "jsxgraph",
    "title": "Short diagram title",
    "description": "1-2 line description of what the figure shows",
    "config": {
      "boundingBox": [-6, 4, 6, -4],
      "axes": false,
      "points": [
        { "x": -4, "y": -2, "name": "A" },
        { "x": 4, "y": -2, "name": "B" }
      ],
      "segments": [
        { "from": 0, "to": 1 }
      ],
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

POINT AND COORDINATE RULES:
- All coordinates must be plain numbers (no expressions like 270-22, 3/5*pi, sin(30), etc.).
- Prefer to refer to points by their INDEX in the "points" array (0-based).
- You may also:
  - use a coordinate array [x, y], or
  - use a point name string that matches a "name" in the "points" list, or
  - use an inline object { "x": ..., "y": ... }.
- Keep all coordinates roughly in [-5, 5] in both x and y so the whole figure is visible.

SHAPE USAGE GUIDELINES:
- "polylines": rails, tracks, or light constructions.
- "polygons": solid blocks, tables, plates, U-shaped wires (usually filled).
- "circles": circular loops or pulleys ("center" is a point reference, "radius" is a NUMBER).
- "arcs": small angle markings or circular sectors (use point references for center and endpoints).
- "arrows": all forces, velocity vectors, fields, rays.
- "angles": angle markers with an optional LaTeX label.
- "fieldRegions": rectangles filled with "cross" or "dot" pattern to show uniform B/E fields.
- "springs": zig-zag springs connecting two points.

LABEL RULES:
- "labels" and "arrows.label" should be short LaTeX-style strings like "mg", "N", "\\theta".
- For labels inside the diagram config, DO NOT include $ or "\\(" "\\)" delimiters; just write the LaTeX body (we will format it on the frontend).
- For questionText/options/explanation OUTSIDE the diagram, continue to use normal LaTeX with $...$ or $$...$$ as specified above.

CRITICAL JSON FORMATTING RULES:
1. Respond with ONLY a JSON array. No markdown, no code blocks, no explanation text.
2. ALL backslashes in LaTeX MUST be double-escaped for JSON: use \\\\ in the JSON string.
3. Do NOT include any comments (no // or /* */) in your JSON.
4. Example valid JSON: "questionText": "Calculate \\\\frac{1}{2}mv^2".
5. Escape all quotes and special characters properly.

Example format (mechanics with diagram):
[
  {
    "questionText": "A light strip of length 10 cm slides on a U-shaped conducting rail in a uniform magnetic field B (into the page), connected to a spring. The strip is pulled slightly and released. Find the approximate number of oscillations before the amplitude decreases by a factor e.",
    "options": [
      "5000",
      "500",
      "10000",
      "1000"
    ],
    "correctAnswers": [0],
    "explanation": "Detailed explanation with LaTeX ...",
    "difficulty": "medium",
    "topic": "Electromagnetic damping",
    "diagram": {
      "type": "jsxgraph",
      "title": "Strip on U-shaped rail in magnetic field",
      "description": "A conducting strip attached to a spring sliding on a U-shaped wire in a uniform magnetic field (crosses into the page).",
      "config": {
        "boundingBox": [-6, 4, 6, -4],
        "axes": false,
        "points": [
          { "x": -4, "y": -2, "name": "P1" },
          { "x": 4, "y": -2, "name": "P2" },
          { "x": -4, "y": 2, "name": "P3" },
          { "x": 4, "y": 2, "name": "P4" },
          { "x": 0, "y": -2, "name": "strip" }
        ],
        "polygons": [
          { "vertices": [0, 1, 3, 2] }
        ],
        "fieldRegions": [
          { "x1": -4, "y1": 2, "x2": 4, "y2": -2, "pattern": "cross" }
        ],
        "springs": [
          { "from": 0, "to": 4, "coils": 6 }
        ],
        "labels": [
          { "x": 4.2, "y": 2, "text": "10 cm" },
          { "x": -3.8, "y": 3.2, "text": "B (into page)" }
        ],
        "segments": [],
        "polylines": [],
        "circles": [],
        "arcs": [],
        "arrows": [],
        "angles": []
      }
    }
  }
]
Generate EXACTLY ${input.questionCount} questions. Output ONLY the JSON array, nothing else.`;
}

// Helper function to parse quiz questions from AI response
function parseQuizQuestions(response: string) {
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

    // Fix simple numeric expressions like 270-22 or 270+22 in property values
    // This is common in diagram configs for startAngle/endAngle, which is invalid JSON.
    jsonString = jsonString.replace(/:\s*(-?\d+)\s*([+\-])\s*(-?\d+)\s*(?=,|\})/g, (_match, a, op, b) => {
      const left = Number(a);
      const right = Number(b);
      if (Number.isNaN(left) || Number.isNaN(right)) return _match;
      const result = op === '+' ? left + right : left - right;
      return `: ${result}`;
    });

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
          `Failed to parse JSON even after cleanup. Original error: ${firstError instanceof Error ? firstError.message : 'Unknown'
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
