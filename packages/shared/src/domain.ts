import { z } from "zod";

export const subjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const chapterSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const formulaSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().min(1),
  chapterId: z.string().min(1),
  title: z.string().min(1),
  expression: z.string().min(1),
  explanation: z.string().optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  derivationSteps: z.array(z.string()),
  tags: z.array(z.string()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const mistakeSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().min(1),
  chapterId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(["new", "reviewing", "resolved"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  errorType: z.enum(["conceptual", "calculation", "careless", "unknown"]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Subject = z.infer<typeof subjectSchema>;
export type Chapter = z.infer<typeof chapterSchema>;
export type Formula = z.infer<typeof formulaSchema>;
export type Mistake = z.infer<typeof mistakeSchema>;