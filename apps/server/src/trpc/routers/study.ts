import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requireUser } from "../middleware/auth";
import { procedure, router } from "../trpc";

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
});