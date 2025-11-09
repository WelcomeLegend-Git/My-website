import { useEffect, useMemo, useState } from "react";
import { useShellContext } from "../../app/layouts/useShellContext";
import { GlowSelect } from "../../components/ui/GlowSelect";
import { MistakeCard } from "../../features/mistakes/components/MistakeCard";
import {
  MistakeFormDialog,
  type MistakeDraft,
} from "../../features/mistakes/components/MistakeFormDialog";
import { trpc } from "../../lib/trpc";
import type { RouterInputs, RouterOutputs } from "../../types/trpc";

type Mistake = RouterOutputs["mistakes"]["list"][number];
type Subject = RouterOutputs["subjects"]["list"][number];
type MistakeCreateInput = RouterInputs["mistakes"]["create"];
type MistakeUpdateInput = RouterInputs["mistakes"]["update"];

type FormState =
  | { mode: "create" }
  | {
      mode: "edit";
      mistake: Mistake;
    };

type MistakeFilters = {
  subjectId?: string;
  chapterId?: string;
  status?: "new" | "reviewing" | "resolved";
  difficulty?: "easy" | "medium" | "hard";
};

const toAiContext = (mistake: Mistake) => ({
  entity: "mistake",
  id: mistake.id,
  title: mistake.title,
  description: mistake.description,
  difficulty: mistake.difficulty,
  status: mistake.status,
  errorType: mistake.errorType,
  subject: mistake.subject.name,
  chapter: mistake.chapter.title,
  aiSummary: mistake.aiSummary,
});

const ensureChapterOptions = (subjectId: string | undefined, subjects?: Subject[]) => {
  if (!subjectId) {
    return [];
  }
  return subjects?.find((subject) => subject.id === subjectId)?.chapters ?? [];
};

const buildDraftFromMistake = (mistake: Mistake): MistakeDraft => ({
  subjectId: mistake.subjectId,
  chapterId: mistake.chapterId,
  title: mistake.title,
  description: mistake.description,
  difficulty: mistake.difficulty,
  status: mistake.status,
  errorType: mistake.errorType,
  aiSummary: mistake.aiSummary,
  aiMindMap: mistake.aiMindMap,
  attachments: mistake.assets.map((asset) => ({
    id: asset.id,
    url: asset.url,
    kind: asset.kind,
    caption: asset.caption,
  })),
});

export const MistakeLogPage = () => {
  const { setAiSection, setAiContext } = useShellContext();
  const utils = trpc.useUtils();

  const { data: subjects } = trpc.subjects.list.useQuery();

  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [chapterId, setChapterId] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<"new" | "reviewing" | "resolved" | undefined>();
  const [difficultyFilter, setDifficultyFilter] = useState<"easy" | "medium" | "hard" | undefined>();
  const [selectedMistake, setSelectedMistake] = useState<Mistake | null>(null);
  const [formState, setFormState] = useState<FormState | null>(null);
  const [pendingMistakeId, setPendingMistakeId] = useState<string | null>(null);
  const [analyzingMistake, setAnalyzingMistake] = useState<string | null>(null);

  const filters = useMemo<MistakeFilters | undefined>(() => {
    const active: MistakeFilters = {
      subjectId,
      chapterId,
      status: statusFilter,
      difficulty: difficultyFilter,
    };
    if (!active.subjectId && !active.chapterId && !active.status && !active.difficulty) {
      return undefined;
    }
    return active;
  }, [chapterId, difficultyFilter, statusFilter, subjectId]);

  const {
    data: mistakes,
    isLoading: mistakesLoading,
  } = trpc.mistakes.list.useQuery(filters, {
    placeholderData: (previousData) => previousData,
  });

  const createMutation = trpc.mistakes.create.useMutation();
  const updateMutation = trpc.mistakes.update.useMutation();
  const deleteMutation = trpc.mistakes.remove.useMutation();
  const transitionMutation = trpc.mistakes.transition.useMutation();
  const analyzeMutation = trpc.mistakes.analyze.useMutation();
  const createChapterMutation = trpc.subjects.createChapter.useMutation();

  const handleCreateChapter = async (targetSubjectId: string) => {
    if (createChapterMutation.isPending) {
      return undefined;
    }

    const subject = subjects?.find((candidate: Subject) => candidate.id === targetSubjectId);
    if (!subject) {
      return undefined;
    }

    const proposedTitle = window.prompt("New chapter title", "New Chapter");
    if (!proposedTitle) {
      return undefined;
    }

    const trimmedTitle = proposedTitle.trim();
    if (!trimmedTitle) {
      return undefined;
    }

    try {
      const chapter = await createChapterMutation.mutateAsync({
        subjectId: targetSubjectId,
        title: trimmedTitle,
        description: null,
      });
      await utils.subjects.list.invalidate();
      return chapter.id;
    } catch (error) {
      console.error("Failed to create chapter", error);
      alert("Could not create chapter. Please try again.");
      return undefined;
    }
  };

  useEffect(() => {
    setAiSection("mistakes");
    return () => {
      setAiContext(undefined);
    };
  }, [setAiContext, setAiSection]);

  useEffect(() => {
    if (selectedMistake) {
      setAiContext(toAiContext(selectedMistake));
    } else {
      setAiContext(undefined);
    }
  }, [selectedMistake, setAiContext]);

  useEffect(() => {
    if (!mistakes || mistakes.length === 0) {
      if (selectedMistake !== null) {
        setSelectedMistake(null);
      }
      return;
    }

    const desired =
      (pendingMistakeId ? mistakes.find((mistake) => mistake.id === pendingMistakeId) : undefined) ??
      (selectedMistake ? mistakes.find((mistake) => mistake.id === selectedMistake.id) : undefined) ??
      mistakes[0];

    if (!desired) {
      if (selectedMistake !== null) {
        setSelectedMistake(null);
      }
      return;
    }

    if (
      !selectedMistake ||
      selectedMistake.id !== desired.id ||
      selectedMistake.updatedAt !== desired.updatedAt
    ) {
      setSelectedMistake(desired);
    }

    if (pendingMistakeId && mistakes.some((mistake) => mistake.id === pendingMistakeId)) {
      setPendingMistakeId(null);
    }
  }, [mistakes, pendingMistakeId, selectedMistake]);

  useEffect(() => {
    if (!subjectId) {
      setChapterId(undefined);
      return;
    }
    const chapters = ensureChapterOptions(subjectId, subjects);
    if (!chapters.length) {
      setChapterId(undefined);
      return;
    }
    if (chapterId && !chapters.some((chapter) => chapter.id === chapterId)) {
      setChapterId(undefined);
    }
  }, [chapterId, subjectId, subjects]);

  const handleDelete = async (mistake: Mistake) => {
    if (deleteMutation.isPending) {
      return;
    }
    const confirmed = typeof window !== "undefined" ? window.confirm("Delete this mistake? This cannot be undone.") : true;
    if (!confirmed) {
      return;
    }

    try {
      await deleteMutation.mutateAsync({ id: mistake.id });
      await utils.mistakes.list.invalidate();
      setSelectedMistake((current) => (current?.id === mistake.id ? null : current));
    } catch {
      // Error surfaces via mutation state.
    }
  };

  const handleTransition = async (mistake: Mistake, status: Mistake["status"]) => {
    if (transitionMutation.isPending) {
      return;
    }

    try {
      await transitionMutation.mutateAsync({ id: mistake.id, status });
      await utils.mistakes.list.invalidate();
    } catch {
      // Error surfaces via mutation state.
    }
  };

  const handleFormSubmit = async (draft: MistakeDraft) => {
    const payload: MistakeCreateInput = {
      subjectId: draft.subjectId,
      chapterId: draft.chapterId,
      title: draft.title,
      description: draft.description,
      difficulty: draft.difficulty,
      status: draft.status,
      errorType: draft.errorType,
      aiSummary: draft.aiSummary,
      aiMindMap: draft.aiMindMap,
      attachments: draft.attachments,
    };

    try {
      if (formState?.mode === "edit") {
        const updatePayload: MistakeUpdateInput = { id: formState.mistake.id, ...payload };
        await updateMutation.mutateAsync(updatePayload);
      } else {
        setSubjectId(draft.subjectId);
        setChapterId(draft.chapterId);
        const created = await createMutation.mutateAsync(payload);
        setPendingMistakeId(created.id);
      }
      await utils.mistakes.list.invalidate();
      setFormState(null);
    } catch {
      // handled by mutation errors
    }
  };

  const handleAnalyze = async (mistake: Mistake) => {
    if (analyzeMutation.isPending || analyzingMistake) {
      return;
    }

    setAnalyzingMistake(mistake.id);

    try {
      const result = await analyzeMutation.mutateAsync({
        description: mistake.description,
      });

      // Update the mistake with AI analysis
      const updatePayload: MistakeUpdateInput = {
        id: mistake.id,
        subjectId: mistake.subjectId,
        chapterId: mistake.chapterId,
        title: mistake.title,
        description: mistake.description,
        difficulty: mistake.difficulty,
        status: mistake.status,
        errorType: mistake.errorType,
        aiSummary: result.summary ?? null,
        aiMindMap: result.mindMap ?? null,
        attachments: mistake.assets.map((asset) => ({
          id: asset.id,
          url: asset.url,
          kind: asset.kind,
          caption: asset.caption,
        })),
      };

      await updateMutation.mutateAsync(updatePayload);
      await utils.mistakes.list.invalidate();
    } catch (error) {
      console.error("AI analysis failed:", error);
    } finally {
      setAnalyzingMistake(null);
    }
  };

  const closeForm = () => {
    setFormState(null);
    createMutation.reset();
    updateMutation.reset();
  };

  const openCreateForm = () => {
    setFormState({ mode: "create" });
    createMutation.reset();
  };

  const openEditForm = (mistake: Mistake) => {
    setFormState({ mode: "edit", mistake });
    updateMutation.reset();
  };

  const chapterOptions = ensureChapterOptions(subjectId, subjects);
  const isEmpty = !mistakesLoading && (!mistakes || mistakes.length === 0);

  const subjectSelectOptions = useMemo(
    () => [
      { value: "", label: "All subjects" },
      ...(subjects?.map((subject) => ({ value: subject.id, label: subject.name })) ?? []),
    ],
    [subjects],
  );

  const chapterSelectOptions = useMemo(() => {
    if (!subjectId) {
      return [{ value: "", label: "Select a subject", disabled: true }];
    }
    return [
      { value: "", label: "All chapters" },
      ...chapterOptions.map((chapter) => ({ value: chapter.id, label: chapter.title })),
    ];
  }, [chapterOptions, subjectId]);

  const statusSelectOptions = useMemo(
    () => [
      { value: "", label: "All statuses" },
      { value: "new", label: "New" },
      { value: "reviewing", label: "Reviewing" },
      { value: "resolved", label: "Resolved" },
    ],
    [],
  );

  const difficultySelectOptions = useMemo(
    () => [
      { value: "", label: "All difficulty" },
      { value: "easy", label: "Easy" },
      { value: "medium", label: "Medium" },
      { value: "hard", label: "Hard" },
    ],
    [],
  );

  const currentFormDefaults: MistakeDraft | undefined = formState
    ? formState.mode === "edit"
      ? buildDraftFromMistake(formState.mistake)
      : {
          subjectId:
            subjectId ?? subjects?.[0]?.id ?? "",
          chapterId:
            chapterId ?? ensureChapterOptions(subjectId ?? subjects?.[0]?.id, subjects)[0]?.id ?? "",
          title: "",
          description: "",
          difficulty: "medium",
          status: "new",
          errorType: "unknown",
          aiSummary: null,
          aiMindMap: null,
          attachments: [],
        }
    : undefined;

  const formError = formState?.mode === "edit" ? updateMutation.error?.message : createMutation.error?.message;
  const isSaving = formState?.mode === "edit" ? updateMutation.isPending : createMutation.isPending;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Mistake archive</p>
          <h2 className="text-3xl font-semibold text-slate-100">Learn from every slip</h2>
          <p className="text-sm text-slate-400">Capture slips quickly, attach working photos, and let AI distill lessons.</p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20"
          onClick={openCreateForm}
        >
          Log mistake
        </button>
      </header>

      <div className="rounded-3xl border border-slate-800/60 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-slate-950/80 glass-card p-6 shadow-[0_24px_60px_-40px_rgba(15,118,230,0.45)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1 space-y-2 md:flex-none md:w-56">
            <label className="text-xs uppercase tracking-wide text-slate-400">Subject</label>
            <GlowSelect
              id="mistake-subject"
              value={subjectId ?? ""}
              onChange={(nextValue) => setSubjectId(nextValue || undefined)}
              options={subjectSelectOptions}
              placeholder="All subjects"
            />
          </div>

          <div className="flex-1 space-y-2 md:flex-none md:w-56">
            <label className="text-xs uppercase tracking-wide text-slate-400">Chapter</label>
            <GlowSelect
              id="mistake-chapter"
              value={chapterId ?? ""}
              onChange={(nextValue) => setChapterId(nextValue || undefined)}
              options={chapterSelectOptions}
              placeholder={subjectId ? "All chapters" : "Select a subject"}
              disabled={!subjectId || !chapterOptions.length}
            />
          </div>

          <div className="flex-1 space-y-2 md:flex-none md:w-40">
            <label className="text-xs uppercase tracking-wide text-slate-400">Status</label>
            <GlowSelect
              id="mistake-status"
              value={statusFilter ?? ""}
              onChange={(nextValue) =>
                setStatusFilter((nextValue as "new" | "reviewing" | "resolved") || undefined)
              }
              options={statusSelectOptions}
              placeholder="All status"
            />
          </div>

          <div className="flex-1 space-y-2 md:flex-none md:w-40">
            <label className="text-xs uppercase tracking-wide text-slate-400">Difficulty</label>
            <GlowSelect
              id="mistake-difficulty"
              value={difficultyFilter ?? ""}
              onChange={(nextValue) => setDifficultyFilter((nextValue as "easy" | "medium" | "hard") || undefined)}
              options={difficultySelectOptions}
              placeholder="All difficulty"
            />
          </div>
        </div>
      </div>

      {mistakesLoading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
          Loading mistakes...
        </div>
      )}

      {isEmpty && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center">
          <p className="text-sm text-slate-400">
            {filters ? "No mistakes match your filters." : "No mistakes logged yet. Click 'Log mistake' to add your first one."}
          </p>
        </div>
      )}

      {!mistakesLoading && mistakes && mistakes.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {mistakes.map((mistake) => (
              <MistakeCard
                key={mistake.id}
                mistake={mistake}
                isActive={selectedMistake?.id === mistake.id}
                onSelect={setSelectedMistake}
                onEdit={openEditForm}
                onDelete={handleDelete}
                onTransition={handleTransition}
              />
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            {selectedMistake ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-100">{selectedMistake.title}</h3>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {selectedMistake.subject.name} • {selectedMistake.chapter.title}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAnalyze(selectedMistake)}
                    disabled={analyzingMistake === selectedMistake.id || analyzeMutation.isPending}
                    className="rounded-lg bg-purple-500/20 px-3 py-1.5 text-xs font-medium text-purple-300 hover:bg-purple-500/30 disabled:opacity-50"
                  >
                    {analyzingMistake === selectedMistake.id ? "Analyzing..." : "AI Analyze"}
                  </button>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-300">Description</h4>
                  <p className="text-sm text-slate-400 whitespace-pre-wrap">{selectedMistake.description}</p>
                </div>

                {selectedMistake.aiSummary && (
                  <div className="space-y-2 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                    <h4 className="text-sm font-semibold text-purple-300">AI Summary</h4>
                    <p className="text-sm text-slate-300">{selectedMistake.aiSummary}</p>
                  </div>
                )}

                {selectedMistake.assets.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-slate-300">Attachments</h4>
                    <div className="space-y-2">
                      {selectedMistake.assets.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-2"
                        >
                          <span className="text-xs text-slate-400">{asset.kind}</span>
                          <a
                            href={asset.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            View
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                  <span className="rounded-full border border-slate-700 bg-slate-800/50 px-2 py-1 text-xs text-slate-300">
                    {selectedMistake.difficulty}
                  </span>
                  <span className="rounded-full border border-slate-700 bg-slate-800/50 px-2 py-1 text-xs text-slate-300">
                    {selectedMistake.status}
                  </span>
                  <span className="rounded-full border border-slate-700 bg-slate-800/50 px-2 py-1 text-xs text-slate-300">
                    {selectedMistake.errorType}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Select a mistake to view details</p>
            )}
          </div>
        </div>
      )}

      <MistakeFormDialog
        open={formState !== null}
        mode={formState?.mode ?? "create"}
        subjects={subjects}
        defaultValues={currentFormDefaults}
        isSubmitting={isSaving}
        errorMessage={formError}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
        onCreateChapter={handleCreateChapter}
      />
    </section>
  );
};