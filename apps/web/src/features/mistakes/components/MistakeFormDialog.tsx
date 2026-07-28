import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { GlowSelect } from "../../../components/ui/GlowSelect";
import { getApiBaseUrl } from "../../../lib/env";
import type { RouterOutputs } from "../../../types/trpc";

type Subject = RouterOutputs["subjects"]["list"][number];

export type MistakeDraft = {
  subjectId: string;
  chapterId: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  status: "new" | "reviewing" | "resolved";
  errorType: "conceptual" | "calculation" | "careless" | "unknown";
  aiSummary?: string | null;
  aiMindMap?: unknown | null;
  aiDiagram?: unknown | null;
  attachments: Array<{
    id: string;
    url: string;
    kind: "image" | "pdf" | "question" | "solution" | "working" | "note" | "link";
    caption?: string | null;
  }>;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  subjects?: Subject[];
  defaultValues?: MistakeDraft;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (draft: MistakeDraft) => Promise<void> | void;
  onCreateChapter?: (subjectId: string) => Promise<string | undefined>;
};

const formSchema = z.object({
  subjectId: z.string().min(1, "Select a subject"),
  chapterId: z.string().min(1, "Select a chapter"),
  title: z.string().min(2, "Title is required").max(180),
  description: z.string().min(10, "Description is required"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  status: z.enum(["new", "reviewing", "resolved"]),
  errorType: z.enum(["conceptual", "calculation", "careless", "unknown"]),
});

type FormValues = z.infer<typeof formSchema>;

const toFormValues = (draft?: MistakeDraft, subjects?: Subject[]): FormValues => {
  const fallbackSubject = subjects?.[0]?.id ?? "";
  const fallbackChapter = subjects?.[0]?.chapters[0]?.id ?? "";

  return {
    subjectId: draft?.subjectId ?? fallbackSubject,
    chapterId: draft?.chapterId ?? fallbackChapter,
    title: draft?.title ?? "",
    description: draft?.description ?? "",
    difficulty: draft?.difficulty ?? "medium",
    status: draft?.status ?? "new",
    errorType: draft?.errorType ?? "unknown",
  };
};

export const MistakeFormDialog = ({
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
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [attachments, setAttachments] = useState<MistakeDraft["attachments"]>(defaultValues?.attachments ?? []);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(defaultValues, subjects),
  });

  const selectedSubjectId = watch("subjectId");
  const chapterOptions = useMemo(() => {
    const list = subjects?.find((s) => s.id === selectedSubjectId)?.chapters ?? [];
    return list as Subject["chapters"];
  }, [selectedSubjectId, subjects]);
  const subjectSelectOptions = useMemo(
    () => subjects?.map((subject) => ({ value: subject.id, label: subject.name })) ?? [],
    [subjects],
  );
  const chapterSelectOptions = useMemo(
    () =>
      [
        ...chapterOptions.map((chapter: Subject["chapters"][number]) => ({
          value: chapter.id,
          label: chapter.title,
        })),
        ...(selectedSubjectId ? [{ value: "__add_chapter__", label: "+ Add a chapter" }] : []),
      ],
    [chapterOptions, selectedSubjectId],
  );

  useEffect(() => {
    if (open) {
      reset(toFormValues(defaultValues, subjects));
      setAttachments(defaultValues?.attachments ?? []);
      setUploadError(null);
    }
  }, [open, defaultValues, subjects, reset]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setUploadingFiles(files);
    setUploadError(null);

    try {
      const uploadedAttachments = await Promise.all(
        files.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);

          const response = await axios.post(`${getApiBaseUrl()}/api/uploads`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });

          return {
            id: response.data.id,
            url: response.data.url,
            kind: file.type.startsWith("image/") ? "image" : "pdf",
            caption: null,
          } as MistakeDraft["attachments"][number];
        })
      );

      setAttachments((prev) => [...prev, ...uploadedAttachments]);
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadError("Failed to upload files. Please try again.");
    } finally {
      setUploadingFiles([]);
      event.target.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const onFormSubmit = (values: FormValues) => {
    const draft: MistakeDraft = {
      ...values,
      aiSummary: defaultValues?.aiSummary,
      aiMindMap: defaultValues?.aiMindMap,
      aiDiagram: defaultValues?.aiDiagram,
      attachments,
    };
    void onSubmit(draft);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-line bg-paper p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-display font-semibold text-ink">
            {mode === "create" ? "Log New Mistake" : "Edit Mistake"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-muted">Subject</label>
              <input type="hidden" {...register("subjectId")} />
              <GlowSelect
                id="mistake-form-subject"
                value={selectedSubjectId}
                onChange={(nextValue) => setValue("subjectId", nextValue, { shouldDirty: true, shouldTouch: true })}
                options={subjectSelectOptions}
                placeholder={subjects?.length ? "Select subject" : "Add subjects"}
                disabled={!subjects?.length}
              />
              {errors.subjectId && <p className="text-xs text-red-500">{errors.subjectId.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-muted">Chapter</label>
              <input type="hidden" {...register("chapterId")} />
              <GlowSelect
                id="mistake-form-chapter"
                value={watch("chapterId")}
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
                placeholder={selectedSubjectId ? (chapterOptions.length ? "Select chapter" : "Add chapters") : "Select subject first"}
                disabled={!selectedSubjectId}
              />
              {errors.chapterId && <p className="text-xs text-red-500">{errors.chapterId.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-ink-muted">Title</label>
            <input
              {...register("title")}
              type="text"
              placeholder="Brief summary of the mistake"
              className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink placeholder-ink-muted focus:border-brass/50 focus:outline-none"
            />
            {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-ink-muted">Description</label>
            <textarea
              {...register("description")}
              rows={5}
              placeholder="Describe what went wrong and what you learned..."
              className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink placeholder-ink-muted focus:border-brass/50 focus:outline-none"
            />
            {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-muted">Difficulty</label>
              <select
                {...register("difficulty")}
                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-brass/50 focus:outline-none"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-muted">Status</label>
              <select
                {...register("status")}
                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-brass/50 focus:outline-none"
              >
                <option value="new">New</option>
                <option value="reviewing">Reviewing</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-ink-muted">Error Type</label>
              <select
                {...register("errorType")}
                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-brass/50 focus:outline-none"
              >
                <option value="conceptual">Conceptual</option>
                <option value="calculation">Calculation</option>
                <option value="careless">Careless</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-ink-muted">Attachments</label>
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              disabled={uploadingFiles.length > 0}
              className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink file:mr-4 file:rounded-lg file:border-0 file:bg-brass file:px-3 file:py-1 file:text-sm file:font-semibold file:text-ink hover:file:bg-brass-strong"
            />
            {uploadingFiles.length > 0 && (
              <p className="text-xs text-brass">Uploading {uploadingFiles.length} file(s)...</p>
            )}
            {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
            
            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between rounded-lg border border-line bg-surface-2 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-muted">{attachment.kind}</span>
                      <span className="text-xs text-ink">{attachment.url.split("/").pop()}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || uploadingFiles.length > 0}
              className="rounded-xl bg-brass px-4 py-2 text-sm font-semibold text-ink hover:bg-brass-strong disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : mode === "create" ? "Create" : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
