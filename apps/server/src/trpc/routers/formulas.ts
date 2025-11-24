import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requireUser } from "../middleware/auth";
import { procedure, router } from "../trpc";

export type MindMapNodeInput = {
  id: string;
  label: string;
  detail?: string | null;
  children: MindMapNodeInput[];
};

const mindMapNodeInput: z.ZodType<MindMapNodeInput> = z.lazy(
  (): z.ZodType<MindMapNodeInput> =>
    z
      .object({
        id: z.string().min(1),
        label: z.string().min(1),
        detail: z.string().optional().nullable(),
        children: z.array(mindMapNodeInput).default([]),
      }) as unknown as z.ZodType<MindMapNodeInput>,
);

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
  diagram: z.any().optional().nullable(),
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
  // Enhanced learning fields
  applications: z.string().optional().nullable(),
  examples: z
    .array(
      z.object({
        problem: z.string(),
        solution: z.string(),
        answer: z.string(),
      })
    )
    .optional()
    .nullable(),
  prerequisites: z.array(z.string()).optional().nullable(),
  relatedFormulas: z.array(z.string()).optional().nullable(),
  commonMistakes: z
    .array(
      z.object({
        mistake: z.string(),
        correction: z.string(),
      })
    )
    .optional()
    .nullable(),
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
          diagram: formula.diagram as unknown,
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

    // Create formula and its collection in a transaction
    const result = await ctx.prisma.$transaction(async (tx) => {
      // Create the formula
      const formula = await tx.formula.create({
        data: {
          title: input.title,
          expression: input.expression,
          explanation: input.explanation,
          difficulty: input.difficulty,
          derivationSteps: input.derivationSteps,
          tags: input.tags,
          mindMap: input.mindMap ?? undefined,
          diagram: input.diagram ?? undefined,
          // Enhanced fields
          applications: input.applications ?? undefined,
          examples: input.examples ?? [],
          prerequisites: input.prerequisites ?? [],
          relatedFormulas: input.relatedFormulas ?? [],
          commonMistakes: input.commonMistakes ?? [],

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

      // Auto-create a single-formula collection
      await tx.formulaCollection.create({
        data: {
          title: input.title,
          description: input.explanation ?? null,
          subjectId: input.subjectId,
          chapterId: input.chapterId,
          ownerId: ctx.user.id,
          formulas: {
            connect: { id: formula.id },
          },
        },
      });

      return formula;
    });

    return {
      ...result,
      derivationSteps: result.derivationSteps as string[],
      tags: (result.tags as string[]) ?? [],
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
          diagram: input.diagram ?? undefined,
          // Enhanced fields
          applications: input.applications ?? undefined,
          examples: input.examples ?? [],
          prerequisites: input.prerequisites ?? [],
          relatedFormulas: input.relatedFormulas ?? [],
          commonMistakes: input.commonMistakes ?? [],

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
  extractFormulaDetails: procedure
    .use(requireUser)
    .input(
      z.object({
        description: z.string().min(1),
        imageBase64: z.string().optional(),
        mimeType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prompt = `You are an expert JEE tutor analyzing formulas for comprehensive learning.

Extract and structure the following formula information in JSON format:

User Input: ${input.description}

Provide a rich, structured response with:
1. **title**: Clear, concise title (e.g., "Newton's Second Law of Motion")
2. **expression**: The formula in LaTeX format (use \\( \\) for inline math)
3. **explanation**: Detailed 2-3 sentence explanation covering what it means and when to use it
4. **applications**: A paragraph describing real-world and exam contexts where this formula appears
5. **derivationSteps**: Array of step-by-step derivation (each step should be clear and use LaTeX for math)
6. **examples**: Array of 2-3 worked examples with:
   - problem: Question statement
   - solution: Step-by-step solution with LaTeX
   - answer: Final answer
7. **prerequisites**: Array of concepts/formulas students should know first
8. **relatedFormulas**: Array of related formula titles
9. **commonMistakes**: Array of common errors students make with explanation
10. **tags**: Relevant topic tags
11. **diagram** (optional): A JSXGraph-compatible diagram spec when a graph/geometry/diagram would make this formula easier to understand.

IMPORTANT:
- Use LaTeX notation wrapped in \\( \\) for inline math or \\[ \\] for display math
- Make examples JEE-level appropriate
- Ensure all mathematical expressions are properly formatted

Respond ONLY with valid JSON:
{
  "title": "...",
  "expression": "\\(F = ma\\)",
  "explanation": "...",
  "applications": "...",
  "derivationSteps": ["Step 1: ...", "Step 2: ..."],
  "examples": [{
    "problem": "...",
    "solution": "...",
    "answer": "..."
  }],
  "prerequisites": ["Concept 1", "Concept 2"],
  "relatedFormulas": ["Formula 1", "Formula 2"],
  "commonMistakes": [{
    "mistake": "...",
    "correction": "..."
  }],
  "tags": ["mechanics", "dynamics"],
  "diagram": {
    "type": "jsxgraph",
    "title": "Example diagram",
    "description": "JEE-style diagram (graph, free-body diagram, circuit, field, etc.) illustrating this formula",
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
}
 IMPORTANT:
 - For vectors/forces/rays, use "arrows" instead of segments.
 - Use LaTeX for labels (e.g., "\\( F_{net} \\)").
 - Use light fills for polygons (bodies/blocks).
 - Make diagrams professional and not too simple.`;

      const response = await ctx.gemini.generate({
        prompt,
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
        usePremiumOnly: true, // Only use gemini-2.5-pro for formula extraction
      });

      try {
        // Extract JSON from response (in case AI adds extra text)
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? jsonMatch[0] : response.text;
        const parsed = JSON.parse(jsonText);

        return {
          title: parsed.title || "",
          expression: parsed.expression || "",
          explanation: parsed.explanation || "",
          applications: parsed.applications || "",
          derivationSteps: Array.isArray(parsed.derivationSteps) ? parsed.derivationSteps : [],
          examples: Array.isArray(parsed.examples) ? parsed.examples : [],
          prerequisites: Array.isArray(parsed.prerequisites) ? parsed.prerequisites : [],
          relatedFormulas: Array.isArray(parsed.relatedFormulas) ? parsed.relatedFormulas : [],
          commonMistakes: Array.isArray(parsed.commonMistakes) ? parsed.commonMistakes : [],
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          diagram: parsed.diagram || null,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to extract formula details from AI response"
        });
      }
    }),

  listCollections: procedure
    .use(requireUser)
    .input(z.object({ includeDeleted: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const collections = await ctx.prisma.formulaCollection.findMany({
        where: {
          ownerId: ctx.user.id,
          deletedAt: input?.includeDeleted ? undefined : null,
        },
        include: {
          subject: true,
          chapter: true,
          _count: {
            select: { formulas: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return collections;
    }),

  deleteCollections: procedure
    .use(requireUser)
    .input(z.object({ ids: z.array(z.string().min(1)) }))
    .mutation(async ({ ctx, input }) => {
      // Soft delete - move to trash
      const result = await ctx.prisma.formulaCollection.updateMany({
        where: {
          id: { in: input.ids },
          ownerId: ctx.user.id,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      return { count: result.count };
    }),

  restoreCollections: procedure
    .use(requireUser)
    .input(z.object({ ids: z.array(z.string().min(1)) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.formulaCollection.updateMany({
        where: {
          id: { in: input.ids },
          ownerId: ctx.user.id,
          deletedAt: { not: null },
        },
        data: {
          deletedAt: null,
        },
      });

      return { count: result.count };
    }),

  permanentlyDeleteCollections: procedure
    .use(requireUser)
    .input(z.object({ ids: z.array(z.string().min(1)) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.formulaCollection.deleteMany({
        where: {
          id: { in: input.ids },
          ownerId: ctx.user.id,
        },
      });

      return { count: result.count };
    }),

  getCollection: procedure
    .use(requireUser)
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const collection = await ctx.prisma.formulaCollection.findUnique({
        where: { id: input.id },
        include: {
          formulas: {
            include: { assets: true },
            orderBy: { createdAt: 'asc' },
          },
          subject: true,
          chapter: true,
        },
      });

      if (!collection || collection.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });
      }

      return {
        ...collection,
        formulas: collection.formulas.map((f) => ({
          ...f,
          derivationSteps: f.derivationSteps as string[],
          tags: (f.tags as string[]) ?? [],
          examples: f.examples as unknown[],
          prerequisites: f.prerequisites as string[],
          relatedFormulas: f.relatedFormulas as string[],
          commonMistakes: f.commonMistakes as unknown[],
          diagram: f.diagram as unknown,
        })),
      };
    }),

  extractAndCreateBulk: procedure
    .use(requireUser)
    .input(
      z.object({
        subjectId: z.string().min(1),
        chapterId: z.string().min(1),
        description: z.string().optional(),
        imageBase64: z.string().optional(),
        mimeType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify chapter ownership
      const chapter = await ctx.prisma.chapter.findUnique({
        where: { id: input.chapterId },
        include: { subject: true },
      });
      if (!chapter || chapter.subject.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Chapter not found" });
      }

      const prompt = `You are an expert JEE tutor analyzing formula sheets or descriptions. Extract ALL formulas from the provided content.

User Input: ${input.description || 'Extract all formulas from the image'}

IMPORTANT: Extract EVERY formula you can find. For each formula, provide complete details.

Return a JSON array where each element has:
1. **title**: Clear, concise title (e.g., "Newton's Second Law of Motion")
2. **expression**: The formula in LaTeX format (use \\\\( \\\\) for inline math)
3. **explanation**: Detailed 2-3 sentence explanation
4. **applications**: Where this formula appears in JEE and real-world
5. **derivationSteps**: Array of derivation steps with LaTeX
6. **examples**: Array of 1-2 JEE-level worked examples with problem, solution, answer
7. **prerequisites**: Array of required concepts
8. **relatedFormulas**: Array of related formula titles
9. **commonMistakes**: Array of objects with mistake and correction
10. **difficulty**: "easy", "medium", or "hard"
11. **tags**: Relevant topic tags
12. **diagram** (optional): A JSXGraph-compatible diagram spec when a simple JEE-style graph/diagram (graph, free-body diagram, circuit, fields, etc.) is natural for this formula. Use the richer config schema with points, segments, polylines, polygons, circles, arcs, fieldRegions, springs, and labels.

Respond ONLY with a valid JSON array:
[
  {
    "title": "...",
    "expression": "...",
    "explanation": "...",
    "applications": "...",
    "derivationSteps": ["...", "..."],
    "examples": [{
      "problem": "...",
      "solution": "...",
      "answer": "..."
    }],
    "prerequisites": ["Concept 1"],
    "relatedFormulas": ["Formula 1"],
    "commonMistakes": [{
      "mistake": "...",
      "correction": "..."
    }],
    "difficulty": "medium",
    "tags": ["mechanics", "dynamics"],
    "diagram": {
      "type": "jsxgraph",
      "title": "Example diagram",
      "description": "JEE-style diagram (graph, free-body diagram, circuit, field, etc.) illustrating this formula",
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
  }
]
 IMPORTANT:
 - For vectors/forces/rays, use "arrows" instead of segments.
 - Use LaTeX for labels (e.g., "\\( F_{net} \\)").
 - Use light fills for polygons (bodies/blocks).
 - Make diagrams professional and not too simple.`;

      const response = await ctx.gemini.generate({
        prompt,
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
        usePremiumOnly: true, // Only use gemini-2.5-pro for bulk extraction
      });

      try {
        console.log("AI Response received, length:", response.text.length);
        console.log("AI Response preview:", response.text.substring(0, 500));

        // Extract JSON array from response
        const jsonMatch = response.text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.error("No JSON array found in response:", response.text);
          throw new Error("AI did not return a valid JSON array. Response: " + response.text.substring(0, 200));
        }

        const jsonText = jsonMatch[0];
        console.log("Extracted JSON length:", jsonText.length);

        let parsedArray;
        try {
          parsedArray = JSON.parse(jsonText);
        } catch (parseError) {
          console.error("JSON parse error:", parseError);
          console.error("Failed JSON text:", jsonText.substring(0, 500));
          throw new Error("Failed to parse AI response as JSON");
        }

        if (!Array.isArray(parsedArray)) {
          console.error("Parsed result is not an array:", typeof parsedArray);
          throw new Error("AI response is not an array");
        }

        if (parsedArray.length === 0) {
          throw new Error("No formulas found in the image/description");
        }

        console.log(`Successfully extracted ${parsedArray.length} formulas`);

        // Create a FormulaCollection first
        const collection = await ctx.prisma.formulaCollection.create({
          data: {
            title: `${parsedArray.length} Formulas - ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
            description: input.description || null,
            subjectId: input.subjectId,
            chapterId: input.chapterId,
            ownerId: ctx.user.id,
          },
        });

        console.log(`Created collection: ${collection.title} (ID: ${collection.id})`);

        // Create all formulas in database and link to collection
        const createdFormulas = [];

        for (let index = 0; index < parsedArray.length; index++) {
          const formulaData = parsedArray[index];
          try {
            console.log(`Creating formula ${index + 1}/${parsedArray.length}: ${formulaData.title}`);

            const formula = await ctx.prisma.formula.create({
              data: {
                title: formulaData.title || "Untitled Formula",
                expression: formulaData.expression || "",
                explanation: formulaData.explanation || null,
                difficulty: formulaData.difficulty || "medium",
                derivationSteps: formulaData.derivationSteps || [],
                tags: formulaData.tags || [],
                applications: formulaData.applications || null,
                examples: formulaData.examples || [],
                prerequisites: formulaData.prerequisites || [],
                relatedFormulas: formulaData.relatedFormulas || [],
                commonMistakes: formulaData.commonMistakes || [],
                diagram: formulaData.diagram || null,
                subjectId: input.subjectId,
                chapterId: input.chapterId,
                ownerId: ctx.user.id,
                collectionId: collection.id, // Link to collection
              },
              include: { assets: true, subject: true, chapter: true },
            });

            console.log(`✓ Created formula ${index + 1}: ${formula.title}`);

            createdFormulas.push({
              ...formula,
              derivationSteps: formula.derivationSteps as string[],
              tags: (formula.tags as string[]) ?? [],
              examples: formula.examples as unknown[],
              prerequisites: formula.prerequisites as string[],
              relatedFormulas: formula.relatedFormulas as string[],
              commonMistakes: formula.commonMistakes as unknown[],
            });
          } catch (dbError) {
            console.error(`Failed to create formula ${index + 1}:`, formulaData.title, dbError);
            throw new Error(
              `Failed to create formula "${formulaData.title}": ${
                dbError instanceof Error ? dbError.message : "Unknown error"
              }`,
            );
          }
        }

        return {
          formulas: createdFormulas,
          count: createdFormulas.length,
          collectionId: collection.id,
        };
      } catch (error) {
        console.error("Bulk extraction error:", error);

        // Provide specific error message
        let errorMessage = "Failed to extract and create formulas.";
        if (error instanceof Error) {
          errorMessage = error.message;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: errorMessage
        });
      }
    }),
});