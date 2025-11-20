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
              const chunkQuestions = parseQuizQuestions((res as any).value.text, { ...input, questionCount: (res as any).count });
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
                const retryQuestions = parseQuizQuestions(retryResult.text, retryInput);
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

          questions = parseQuizQuestions(result.text, input);
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

  const pictureRatioPercent = Math.round(pictureRatio * 100);

  return `You are an expert JEE ${input.examType === "mains" ? "Mains" : "Advanced"
    } question generator.

Generate ${input.questionCount} high-quality multiple-choice questions based on the following material and context:

${formulaInfo}

Requirements:
- Exam Type: JEE ${input.examType === "mains" ? "Mains" : "Advanced"}
- Answer Type: ${input.answerType === "single" ? "Single Correct" : "Multiple Correct"}
- Difficulty: ${input.examType === "advanced" ? "Advanced (multi-step, conceptual)" : "Moderate (clear, direct)"
    }
- Aim for roughly ${pictureRatioPercent}% of the questions to include a clear, well-framed diagram when diagrams are naturally useful for this chapter (projectile motion, Newton's laws, WPE, SHM, graphs, vectors, geometry, fields, etc.).
- Questions must be JEE-style, concise, and physically accurate.
- Each question must have 4 options.
- ${input.answerType === "single" ? "Only ONE correct answer" : "Can have MULTIPLE correct answers"}.
- Include detailed explanations with LaTeX.

CRITICAL LATEX & JSON RULES:
1. **MATH DELIMITERS**: You MUST wrap ALL math expressions in '$' (inline) or '$$' (block).
   - Correct: "The force is $F = ma$."
   - Incorrect: "The force is F = ma."
2. **JSON ESCAPING**: You MUST double-escape ALL backslashes in the JSON string.
   - Correct: "Calculate $\\frac{1}{2}mv^2$" (becomes "\\frac" in string)
   - Incorrect: "Calculate \frac{1}{2}mv^2" (broken JSON)
   - Correct: "$\\lambda$" (becomes "\\lambda")
3. **Output Format**: Return ONLY a raw JSON array. No markdown code blocks.

Diagram specification (when needed):
- Use this JSON shape inside each question:
  "diagram": {
    "type": "jsxgraph",
    "title": "Short diagram title",
    "description": "1-2 line description",
    "config": {
      "boundingBox": [-5, 5, 5, -5], // Adjust to fit the scene tightly
      "axes": false, // Usually false for physics problems
      "points": [{ "x": 0, "y": 0, "visible": false }], // Use invisible points for anchors
      "segments": [...],
      "polygons": [...],       // Use for blocks, wedges. Fill with light colors.
      "circles": [...],        // Pulleys, loops
      "arcs": [...],           // Angles
      "arrows": [...],         // Vectors (forces, velocity). MUST touch their targets.
      "springs": [...],        // Zig-zag lines
      "labels": [{ "x": 0, "y": 1, "text": "$F$" }] // Math in labels MUST have $
    }
  }

  DIAGRAM QUALITY TIPS:
  - **Connectedness**: Ensure arrows and vectors actually start/end on the object or point they describe.
  - **Ground / supports**: Draw a clear horizontal ground line with the "hatch" pattern. Draw cliffs, tables, and walls as filled polygons with light neutral colors.
  - **Framing & scale**: Use the bounding box so the main objects and trajectory fill most of the card, with only small margins. Avoid huge empty empty regions at the top or sides.
  - **Projectile motion (if relevant)**: For a projectile from a cliff, draw a tall vertical cliff at the left, launch point at the top, a dashed red trajectory, a launch-velocity arrow with labelled speed and angle near the start, ground with hatching, and a horizontal range arrow at the bottom labeled "R = ?".
  - **Other chapters**: For mechanics use blocks/wedges/pulleys with vectors, for graphs draw clean axes and curves, and for math/chemistry use clear axes or energy diagrams with well-separated, labeled levels.
  - **Labels**: Use short LaTeX labels like "$v_0$", "${"$"}\\theta${"$"}", and "$R$" placed near objects without overlapping lines.

Example JSON Object:
{
  "questionText": "A block of mass $m$ slides on a frictionless surface...",
  "options": ["$5 \\text{ m/s}$", "$10 \\text{ m/s}$", "$15 \\text{ m/s}$", "$20 \\text{ m/s}$"],
  "correctAnswers": [1],
  "explanation": "Using conservation of energy: $$\\frac{1}{2}mv^2 = mgh$$...",
  "diagram": { ... }
}

Generate EXACTLY ${input.questionCount} questions. Output ONLY the JSON array.`;
}

// Helper function to parse quiz questions from AI response
function parseQuizQuestions(response: string, input: z.infer<typeof quizConfigSchema>) {
  try {
    // Clean response - remove markdown code blocks if present
    let cleanedResponse = response.trim();
    cleanedResponse = cleanedResponse
      .replace(/^```json\s*/g, '')
      .replace(/^```\s*/g, '')
      .replace(/```\s*$/g, '')
      .trim();

    // Find JSON array
    const jsonMatch = cleanedResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      // Fallback: try to find just the array brackets if match failed
      const start = cleanedResponse.indexOf('[');
      const end = cleanedResponse.lastIndexOf(']');
      if (start !== -1 && end !== -1) {
        cleanedResponse = cleanedResponse.substring(start, end + 1);
      } else {
        throw new Error("No JSON array found in response");
      }
    } else {
      cleanedResponse = jsonMatch[0];
    }

    // PRE-PROCESSING: Fix common LaTeX JSON escape errors
    // The AI often outputs "\frac" which JSON.parse sees as "\f" (form feed) + "rac".
    // We need to replace single backslashes with double backslashes, BUT ignore already escaped ones.

    // 1. Fix specific known LaTeX commands that start with formatting chars
    // \f -> \\f, \n -> \\n (if it looks like math), \r -> \\r, \t -> \\t, \b -> \\b
    // This is tricky because \n is also a newline. 
    // Safer approach: Look for LaTeX patterns and ensure they are escaped.

    // Regex to find backslashes that are NOT followed by another backslash or a quote
    // and are likely part of a LaTeX command (followed by letters)
    // We'll do a few targeted replacements for common issues

    let fixed = cleanedResponse;

    // Fix \frac, \phi, \pi, \theta, \lambda, \mu, \rho, \sigma, \tau, \omega, \Delta, \alpha, \beta, \gamma
    // We replace a single backslash followed by these words with a double backslash
    // We check if it's NOT already double escaped.
    const latexCommands = [
      'frac', 'sqrt', 'text', 'cdot', 'times', 'approx',
      'pi', 'theta', 'lambda', 'mu', 'rho', 'sigma', 'tau', 'omega',
      'alpha', 'beta', 'gamma', 'delta', 'Delta', 'sin', 'cos', 'tan',
      'hat', 'vec', 'int', 'sum', 'infty', 'partial'
    ];

    latexCommands.forEach(cmd => {
      // Regex: (?<!\\)\\(cmd) -> match \cmd not preceded by \
      // JS doesn't support lookbehind in all envs, so we use a capture group approach
      // Replace (anything but \)(\cmd) with $1\\cmd
      const regex = new RegExp(`([^\\\\])\\\\${cmd}`, 'g');
      fixed = fixed.replace(regex, `$1\\\\${cmd}`);
    });

    // Also fix the specific case of start of string
    latexCommands.forEach(cmd => {
      if (fixed.startsWith(`\\${cmd}`)) {
        fixed = `\\${fixed}`;
      }
    });

    let questions;
    try {
      questions = JSON.parse(fixed);
    } catch (e) {
      console.warn("First parse failed, trying aggressive backslash fix...");
      // If targeted fix failed, try global fix: 
      // Replace single backslashes with double, except for JSON control chars like \", \\, \/
      // This is risky but often necessary for bad AI output
      const aggressive = cleanedResponse
        .replace(/\\(?![/u"bfnrt\\])/g, "\\\\"); // Escape backslashes that aren't valid JSON escapes

      try {
        questions = JSON.parse(aggressive);
      } catch (e2) {
        console.error("Aggressive parse failed:", e2);
        throw new Error("Failed to parse JSON from AI response. The AI generated invalid JSON syntax.");
      }
    }

    if (!Array.isArray(questions)) {
      throw new Error("Parsed result is not an array");
    }

    // Post-processing: Ensure math has $ delimiters
    return questions.map((q: any) => {
      const ensureMath = (text: string) => {
        if (!text) return "";
        // If text has LaTeX commands like \\frac but no $, wrap it
        if (text.includes('\\') && !text.includes('$')) {
          // Heuristic: if it looks like a sentence with some math, don't wrap whole thing.
          // But for options, usually it's just math.
          // Let's just wrap if it has typical math symbols
          if (text.match(/\\[a-zA-Z]+|[\+\-\=\^]/)) {
            return `$${text}$`;
          }
        }
        return text;
      };

      return {
        questionText: ensureMath(q.questionText || q.question || ""),
        options: (Array.isArray(q.options) ? q.options : []).map((opt: string) => ensureMath(opt)),
        correctAnswers: Array.isArray(q.correctAnswers) ? q.correctAnswers : [q.correctAnswer || 0],
        explanation: ensureMath(q.explanation || ""),
        difficulty: q.difficulty || "medium",
        topic: q.topic || "General",
        diagram: q.diagram || undefined,
      };
    });
  } catch (error) {
    console.error("Parsing error:", error);
    throw new Error(`Failed to parse generated questions: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
