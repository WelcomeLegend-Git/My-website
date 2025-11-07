import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { RouterOutputs } from "../../../types/trpc";

type Subject = RouterOutputs["subjects"]["list"][number];

export type FormulaDraft = {
  subjectId: string;
  chapterId: string;
  title: string;
  expression: string;
  explanation?: string | null;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  derivationSteps: string[];
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  subjects?: Subject[];
  defaultValues?: FormulaDraft;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (draft: FormulaDraft) => Promise<void> | void;
};

const formSchema = z.object({
  subjectId: z.string().min(1, "Select a subject"),
  chapterId: z.string().min(1, "Select a chapter"),
  title: z.string().min(2, "Title is required"),
  expression: z.string().min(1, "Expression is required"),
  explanation: z.string().max(2000).optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  tagsText: z.string().optional().nullable(),
  stepsText: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

const toFormValues = (draft?: FormulaDraft, subjects?: Subject[]): FormValues => {
  const fallbackSubject = subjects?.[0]?.id ?? "";
  const fallbackChapter = subjects?.[0]?.chapters[0]?.id ?? "";

  return {
    subjectId: draft?.subjectId ?? fallbackSubject,
    chapterId: draft?.chapterId ?? fallbackChapter,
    title: draft?.title ?? "",
    expression: draft?.expression ?? "",
    explanation: draft?.explanation ?? "",
    difficulty: draft?.difficulty ?? "medium",
    tagsText: draft?.tags?.join(", ") ?? "",
    stepsText: draft?.derivationSteps?.join("\n") ?? "",
  };
};

const normalizeDraft = (values: FormValues): FormulaDraft => {
  const sanitizeList = (input?: string | null) =>
    input
      ?.split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean) ?? [];

  const sanitizeSteps = (input?: string | null) =>
    input
      ?.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean) ?? [];

  return {
    subjectId: values.subjectId,
    chapterId: values.chapterId,
    title: values.title.trim(),
    expression: values.expression.trim(),
    explanation: values.explanation?.trim() ? values.explanation.trim() : undefined,
    difficulty: values.difficulty,
    tags: sanitizeList(values.tagsText),
    derivationSteps: sanitizeSteps(values.stepsText),
  };
};

export const FormulaFormDialog = ({
  open,
  mode,
  subjects,
  defaultValues,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}: Props) => {
  const initialValues = useMemo(() => toFormValues(defaultValues, subjects), [defaultValues, subjects]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
  });

  const selectedSubjectId = watch("subjectId");
  const selectedChapterId = watch("chapterId");
  const difficultyValue = watch("difficulty");

  const chapters = useMemo(() => {
    return subjects?.find((subject) => subject.id === selectedSubjectId)?.chapters ?? [];
  }, [subjects, selectedSubjectId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    reset(initialValues);
  }, [initialValues, open, reset]);

  useEffect(() => {
    if (!chapters.length) {
      setValue("chapterId", "");
      return;
    }
    if (!selectedChapterId) {
      setValue("chapterId", chapters[0].id);
      return;
    }
    if (!chapters.some((chapter) => chapter.id === selectedChapterId)) {
      setValue("chapterId", chapters[0].id);
    }
  }, [chapters, selectedChapterId, setValue]);

  const closeAndReset = () => {
    reset(initialValues);
    onClose();
  };

  const submit = async (values: FormValues) => {
    await onSubmit(normalizeDraft(values));
  };

  if (!open) {
    return null;
  }

  const hasSubjects = Boolean(subjects?.length);
  const hasChapters = Boolean(chapters.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur shadow-2xl">
        <div className="border-b border-slate-800 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{mode === "create" ? "New" : "Edit"} formula</p>
              <h2 className="text-2xl font-semibold text-slate-100">
                {mode === "create" ? "Capture a concept" : "Update formula"}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeAndReset}
              className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-100"
            >
              Close
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Fill the essentials, add derivation breadcrumbs, and tag usage contexts. You can enrich this later with mind maps
            and assets.
          </p>
        </div>
        <form onSubmit={handleSubmit(submit)} className="max-h-[70vh] overflow-y-auto px-6 py-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="subjectId" className="text-sm font-medium text-slate-200">
                Subject
              </label>
              <select
                id="subjectId"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none disabled:opacity-60"
                disabled={!hasSubjects}
                {...register("subjectId")}
              >
                {!hasSubjects && <option value="">Add a subject first</option>}
                {subjects?.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              {errors.subjectId && <p className="text-xs text-red-400">{errors.subjectId.message}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="chapterId" className="text-sm font-medium text-slate-200">
                Chapter
              </label>
              <select
                id="chapterId"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none disabled:opacity-60"
                disabled={!hasChapters}
                {...register("chapterId")}
              >
                {!hasChapters && <option value="">Add a chapter first</option>}
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.title}
                  </option>
                ))}
              </select>
              {errors.chapterId && <p className="text-xs text-red-400">{errors.chapterId.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium text-slate-200">
              Title
            </label>
            <input
              id="title"
              type="text"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none"
              placeholder="Acceleration due to gravity near Earth"
              {...register("title")}
            />
            {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="expression" className="text-sm font-medium text-slate-200">
              Key expression
            </label>
            <textarea
              id="expression"
              rows={3}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none"
              placeholder="g = \frac{GM}{(R+h)^2}"
              {...register("expression")}
            />
            {errors.expression && <p className="text-xs text-red-400">{errors.expression.message}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="explanation" className="text-sm font-medium text-slate-200">
              Explanation / intuition
            </label>
            <textarea
              id="explanation"
              rows={3}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none"
              placeholder="Relate to inverse square law and gravitational field variations"
              {...register("explanation")}
            />
            {errors.explanation && <p className="text-xs text-red-400">{errors.explanation.message}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-200">Difficulty</span>
              <div className="flex gap-2">
                {["easy", "medium", "hard"].map((level) => {
                  const isActive = difficultyValue === level;
                  return (
                    <label
                      key={level}
                      className={`flex flex-1 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm capitalize transition-colors ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-primary/60"
                      }`}
                    >
                      <input
                        type="radio"
                        value={level}
                        className="hidden"
                        {...register("difficulty")}
                      />
                      {level}
                    </label>
                  );
                })}
              </div>
              {errors.difficulty && <p className="text-xs text-red-400">{errors.difficulty.message}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="tagsText" className="text-sm font-medium text-slate-200">
                Tags (comma separated)
              </label>
              <input
                id="tagsText"
                type="text"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none"
                placeholder="gravitation, orbital, inverse square"
                {...register("tagsText")}
              />
              {errors.tagsText && <p className="text-xs text-red-400">{errors.tagsText.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="stepsText" className="text-sm font-medium text-slate-200">
              Derivation breadcrumbs (one per line)
            </label>
            <textarea
              id="stepsText"
              rows={4}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none"
              placeholder={`1. Start with gravitational force F = GMm/r^2\n2. Relate weight mg to gravitational force\n3. Substitute radius r = R + h`}
              {...register("stepsText")}
            />
            {errors.stepsText && <p className="text-xs text-red-400">{errors.stepsText.message}</p>}
          </div>

          {errorMessage && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{errorMessage}</p>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={closeAndReset}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSubmitting || !hasSubjects || !hasChapters}
            >
              {isSubmitting ? "Saving..." : mode === "create" ? "Save formula" : "Update formula"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};