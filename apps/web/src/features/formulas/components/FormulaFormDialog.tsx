import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { GlowSelect } from "../../../components/ui/GlowSelect";
import { getApiBaseUrl } from "../../../lib/env";
import { trpc } from "../../../lib/trpc";
import type { RouterOutputs } from "../../../types/trpc";

type Subject = RouterOutputs["subjects"]["list"][number];

type FormulaAttachment = {
  id: string;
  url: string;
  kind: "image" | "pdf" | "link";
  title?: string | null;
};

export type FormulaDraft = {
  subjectId: string;
  chapterId: string;
  title: string;
  expression: string;
  explanation?: string | null;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  derivationSteps: string[];
  attachments: FormulaAttachment[];
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
  onCreateChapter?: (subjectId: string) => Promise<string | undefined>;
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

const normalizeDraft = (values: FormValues, attachments: FormulaAttachment[]): FormulaDraft => {
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
    attachments,
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
  onCreateChapter,
}: Props) => {
  const initialValues = useMemo(() => toFormValues(defaultValues, subjects), [defaultValues, subjects]);

  // Entry mode state: null = selection, 'manual' = manual form, 'ai' = AI-assisted
  const [entryMode, setEntryMode] = useState<'manual' | 'ai' | null>(mode === 'edit' ? 'manual' : null);
  const [aiDescription, setAiDescription] = useState('');
  const [attachments, setAttachments] = useState<FormulaAttachment[]>(defaultValues?.attachments ?? []);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const extractMutation = trpc.formulas.extractFormulaDetails.useMutation();

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
    const list = subjects?.find((subject) => subject.id === selectedSubjectId)?.chapters ?? [];
    return list as Subject["chapters"];
  }, [subjects, selectedSubjectId]);
  const subjectSelectOptions = useMemo(
    () => subjects?.map((subject) => ({ value: subject.id, label: subject.name })) ?? [],
    [subjects],
  );
  const chapterSelectOptions = useMemo(
    () =>
      [
        ...chapters.map((chapter: Subject["chapters"][number]) => ({
          value: chapter.id,
          label: chapter.title,
        })),
        ...(selectedSubjectId ? [{ value: "__add_chapter__", label: "+ Add a chapter" }] : []),
      ],
    [chapters, selectedSubjectId],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    reset(initialValues);
    setEntryMode(mode === 'edit' ? 'manual' : null);
    setAttachments(defaultValues?.attachments ?? []);
    setAiDescription('');
    setUploadError(null);
  }, [initialValues, open, reset, mode, defaultValues]);

  useEffect(() => {
    if (!chapters.length) {
      setValue("chapterId", "");
      return;
    }
    if (!selectedChapterId) {
      setValue("chapterId", chapters[0].id);
      return;
    }
    if (!chapters.some((chapter: Subject["chapters"][number]) => chapter.id === selectedChapterId)) {
      setValue("chapterId", chapters[0].id);
    }
  }, [chapters, selectedChapterId, setValue]);

  const closeAndReset = () => {
    reset(initialValues);
    setEntryMode(mode === 'edit' ? 'manual' : null);
    setAttachments([]);
    setAiDescription('');
    setUploadError(null);
    onClose();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setUploadingFiles(files);
    setUploadError(null);

    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);

          const response = await axios.post(`${getApiBaseUrl()}/api/uploads`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          return {
            id: response.data.id,
            url: response.data.url,
            kind: (file.type.startsWith('image/') ? 'image' : 'pdf') as 'image' | 'pdf',
            title: file.name,
          };
        })
      );

      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadError('Failed to upload files. Please try again.');
    } finally {
      setUploadingFiles([]);
      event.target.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAiExtract = async () => {
    if (!aiDescription.trim() && attachments.length === 0) {
      setUploadError('Please provide a description or upload an image');
      return;
    }

    setIsExtracting(true);
    setUploadError(null);

    try {
      // Get first image attachment if any
      const imageAttachment = attachments.find((a) => a.kind === 'image');
      let imageBase64: string | undefined;
      let mimeType: string | undefined;

      if (imageAttachment) {
        // Fetch the image and convert to base64
        const response = await fetch(imageAttachment.url);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(blob);
        });
        imageBase64 = base64;
        mimeType = blob.type;
      }

      const result = await extractMutation.mutateAsync({
        description: aiDescription.trim() || 'Extract formula details from this image',
        imageBase64,
        mimeType,
      });

      // Auto-fill the form fields (except difficulty)
      setValue('title', result.title, { shouldDirty: true });
      setValue('expression', result.expression, { shouldDirty: true });
      setValue('explanation', result.explanation || '', { shouldDirty: true });
      setValue('tagsText', result.tags.join(', '), { shouldDirty: true });
      setValue('stepsText', result.derivationSteps.join('\n'), { shouldDirty: true });

      // Switch to manual mode so user can review and set difficulty
      setEntryMode('manual');
    } catch (error) {
      console.error('AI extraction failed:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to extract formula details. Please try again.');
    } finally {
      setIsExtracting(false);
    }
  };

  const submit = async (values: FormValues) => {
    await onSubmit(normalizeDraft(values, attachments));
  };

  if (!open) {
    return null;
  }

  const hasSubjects = Boolean(subjects?.length);
  const hasChapters = Boolean(chapters.length);
  const canSelectChapter = Boolean(selectedSubjectId);

  // Render entry mode selection screen
  const renderModeSelection = () => (
    <div className="px-6 py-8 space-y-6">
      <div className="text-center mb-6">
        <p className="text-sm text-slate-400 mb-2">Choose how you&apos;d like to add this formula:</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setEntryMode('manual')}
          className="group relative rounded-2xl border-2 border-slate-700 bg-slate-900/60 p-6 text-center transition-all hover:border-primary hover:bg-slate-800/80 hover:shadow-lg hover:shadow-primary/20"
        >
          <div className="mb-3 flex justify-center">
            <div className="rounded-xl bg-primary/10 p-3">
              <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mb-2">Add Manually</h3>
          <p className="text-sm text-slate-400">Fill in all the formula details yourself with optional photo upload</p>
        </button>

        <button
          type="button"
          onClick={() => setEntryMode('ai')}
          className="group relative rounded-2xl border-2 border-slate-700 bg-slate-900/60 p-6 text-center transition-all hover:border-emerald-500 hover:bg-slate-800/80 hover:shadow-lg hover:shadow-emerald-500/20"
        >
          <div className="mb-3 flex justify-center">
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <svg className="h-8 w-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mb-2">Fill with AI</h3>
          <p className="text-sm text-slate-400">Describe the formula or upload an image and let AI auto-fill the fields</p>
        </button>
      </div>
    </div>
  );

  // Render AI-assisted entry screen
  const renderAiMode = () => (
    <div className="px-6 py-6 space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setEntryMode(null)}
          className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <span className="text-sm text-slate-500">→</span>
        <span className="text-sm font-medium text-emerald-400">AI-Assisted Entry</span>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-200">Describe the formula or upload an image</label>
          <textarea
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            placeholder="E.g., &apos;Newton&apos;s second law of motion&apos; or &apos;The formula for kinetic energy&apos;..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-200">Upload Photo (Optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploadingFiles.length > 0 || isExtracting}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-600"
          />
          {uploadingFiles.length > 0 && (
            <p className="text-xs text-blue-400">Uploading {uploadingFiles.length} file(s)...</p>
          )}

          {attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{attachment.kind}</span>
                    <span className="text-xs text-slate-300">{attachment.title || attachment.url.split('/').pop()}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-900/20"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {uploadError && (
          <p className="text-xs text-red-400">{uploadError}</p>
        )}

        <button
          type="button"
          onClick={handleAiExtract}
          disabled={isExtracting || (!aiDescription.trim() && attachments.length === 0)}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2"
        >
          {isExtracting ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Extract with AI
            </>
          )}
        </button>

        <p className="text-xs text-slate-500 text-center">
          AI will auto-fill the form fields. You&apos;ll need to review and set the difficulty level.
        </p>
      </div>
    </div>
  );

  // Render manual entry form
  const renderManualForm = () => (
    <form onSubmit={handleSubmit(submit)} className="max-h-[70vh] overflow-y-auto px-6 py-6 space-y-6">
      {mode === 'create' && (
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setEntryMode(null)}
            className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <span className="text-sm text-slate-500">→</span>
          <span className="text-sm font-medium text-primary">Manual Entry</span>
        </div>
      )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Subject</label>
              <input type="hidden" {...register("subjectId")} />
              <GlowSelect
                id="formula-form-subject"
                value={selectedSubjectId}
                onChange={(nextValue) => setValue("subjectId", nextValue, { shouldDirty: true, shouldTouch: true })}
                options={subjectSelectOptions}
                placeholder={hasSubjects ? "Select subject" : "Add subjects"}
                disabled={!hasSubjects}
              />
              {errors.subjectId && <p className="text-xs text-red-400">{errors.subjectId.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Chapter</label>
              <input type="hidden" {...register("chapterId")} />
              <GlowSelect
                id="formula-form-chapter"
                value={selectedChapterId}
                onChange={(nextValue) => {
                  if (nextValue === "__add_chapter__") {
                    if (!selectedSubjectId || !onCreateChapter) {
                      return;
                    }
                    void (async () => {
                      const createdChapterId = await onCreateChapter(selectedSubjectId);
                      if (createdChapterId) {
                        setValue("chapterId", createdChapterId, { shouldDirty: true, shouldTouch: true });
                      }
                    })();
                    return;
                  }
                  setValue("chapterId", nextValue, { shouldDirty: true, shouldTouch: true });
                }}
                options={chapterSelectOptions}
                placeholder={canSelectChapter ? (hasChapters ? "Select chapter" : "Add chapters") : "Select subject first"}
                disabled={!canSelectChapter}
              />
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

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Attachments / Photos</label>
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              disabled={uploadingFiles.length > 0}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/80"
            />
            {uploadingFiles.length > 0 && (
              <p className="text-xs text-blue-400">Uploading {uploadingFiles.length} file(s)...</p>
            )}
            {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
            
            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{attachment.kind}</span>
                      <span className="text-xs text-slate-300">{attachment.title || attachment.url.split('/').pop()}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-900/20"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
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
  );

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
          {entryMode === null && (
            <p className="mt-2 text-sm text-slate-400">
              Choose your preferred method to add formula details.
            </p>
          )}
          {entryMode === 'manual' && (
            <p className="mt-2 text-sm text-slate-400">
              Fill the essentials, add derivation breadcrumbs, and tag usage contexts. You can enrich this later with mind maps
              and assets.
            </p>
          )}
          {entryMode === 'ai' && (
            <p className="mt-2 text-sm text-slate-400">
              Describe the formula or upload an image, and AI will help extract the details for you.
            </p>
          )}
        </div>

        {entryMode === null && renderModeSelection()}
        {entryMode === 'ai' && renderAiMode()}
        {entryMode === 'manual' && renderManualForm()}
      </div>
    </div>
  );
};