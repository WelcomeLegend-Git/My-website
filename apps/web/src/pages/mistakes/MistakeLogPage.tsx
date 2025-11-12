import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useShellContext } from "../../app/layouts/useShellContext";
import { GlowSelect } from "../../components/ui/GlowSelect";
import {
  MistakeFormDialog,
  type MistakeDraft,
} from "../../features/mistakes/components/MistakeFormDialog";
import { MistakeLogChoiceModal } from "../../features/mistakes/components/MistakeLogChoiceModal";
import { AIMistakeDialog } from "../../features/mistakes/components/AIMistakeDialog";
import { ImageViewerModal } from "../../features/mistakes/components/ImageViewerModal";
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setAiSection, setAiContext } = useShellContext();
  const utils = trpc.useUtils();

  const { data: subjects } = trpc.subjects.list.useQuery();

  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [chapterId, setChapterId] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<"new" | "reviewing" | "resolved" | undefined>();
  const [difficultyFilter, setDifficultyFilter] = useState<"easy" | "medium" | "hard" | undefined>();
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'difficulty-high' | 'difficulty-low'>('recent');
  const [selectedMistake, setSelectedMistake] = useState<Mistake | null>(null);
  const [formState, setFormState] = useState<FormState | null>(null);
  const [pendingMistakeId, setPendingMistakeId] = useState<string | null>(null);
  const [choiceModalOpen, setChoiceModalOpen] = useState(false);
  const [aiDialogOpen, setAIDialogOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<Mistake['assets']>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

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
    data: mistakesData,
    isLoading: mistakesLoading,
  } = trpc.mistakes.list.useQuery(filters, {
    placeholderData: (previousData) => previousData,
  });

  // Sort mistakes
  const mistakes = useMemo(() => {
    if (!mistakesData) return [];
    const sorted = [...mistakesData];
    
    switch (sortBy) {
      case 'recent':
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'difficulty-high':
        const difficultyOrder = { hard: 3, medium: 2, easy: 1 };
        return sorted.sort((a, b) => (difficultyOrder[b.difficulty] || 0) - (difficultyOrder[a.difficulty] || 0));
      case 'difficulty-low':
        const difficultyOrderLow = { hard: 3, medium: 2, easy: 1 };
        return sorted.sort((a, b) => (difficultyOrderLow[a.difficulty] || 0) - (difficultyOrderLow[b.difficulty] || 0));
      default:
        return sorted;
    }
  }, [mistakesData, sortBy]);

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
    const intent = searchParams.get("intent");
    if (intent === "log-mistake" && !choiceModalOpen && !formState) {
      setChoiceModalOpen(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("intent");
        return next;
      }, { replace: true });
    }
  }, [choiceModalOpen, formState, searchParams, setSearchParams]);

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
    <section className="space-y-4 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Mistake archive</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-100">Learn from every slip</h2>
          <p className="text-xs sm:text-sm text-slate-400">Capture slips quickly, attach working photos, and let AI distill lessons.</p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 w-full sm:w-auto"
          onClick={() => setChoiceModalOpen(true)}
        >
          Log mistake
        </button>
      </header>

      <div className="rounded-2xl sm:rounded-3xl border border-slate-800/60 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-slate-950/80 glass-card p-4 sm:p-6 shadow-[0_24px_60px_-40px_rgba(15,118,230,0.45)]">
        <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-end">
          <div className="flex-1 space-y-1.5 sm:space-y-2 md:flex-none md:w-48 lg:w-56">
            <label className="text-xs uppercase tracking-wide text-slate-400">Subject</label>
            <GlowSelect
              id="mistake-subject"
              value={subjectId ?? ""}
              onChange={(nextValue) => setSubjectId(nextValue || undefined)}
              options={subjectSelectOptions}
              placeholder="All subjects"
              placement="right"
            />
          </div>

          <div className="flex-1 space-y-1.5 sm:space-y-2 md:flex-none md:w-48 lg:w-56">
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

          <div className="flex-1 space-y-1.5 sm:space-y-2 md:flex-none md:w-36 lg:w-40">
            <label className="text-xs uppercase tracking-wide text-slate-400">Status</label>
            <GlowSelect
              id="mistake-status"
              value={statusFilter ?? ""}
              onChange={(nextValue) =>
                setStatusFilter((nextValue as "new" | "reviewing" | "resolved") || undefined)
              }
              options={statusSelectOptions}
              placeholder="All status"
              placement="right"
            />
          </div>

          <div className="flex-1 space-y-1.5 sm:space-y-2 md:flex-none md:w-36 lg:w-40">
            <label className="text-xs uppercase tracking-wide text-slate-400">Difficulty</label>
            <GlowSelect
              id="mistake-difficulty"
              value={difficultyFilter ?? ""}
              onChange={(nextValue) => setDifficultyFilter((nextValue as "easy" | "medium" | "hard") || undefined)}
              options={difficultySelectOptions}
              placeholder="All difficulty"
              placement="right"
            />
          </div>
        </div>
      </div>

      {/* Sort Options */}
      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide pb-2">
        <span className="text-xs sm:text-sm text-slate-400 font-medium flex-shrink-0">Sort by:</span>
        {[
          { value: 'recent', label: 'Most Recent' },
          { value: 'oldest', label: 'Oldest First' },
          { value: 'difficulty-high', label: 'Hardest First' },
          { value: 'difficulty-low', label: 'Easiest First' },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setSortBy(option.value as any)}
            className={`flex-shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-colors ${
              sortBy === option.value
                ? 'bg-red-500 text-white'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
            }`}
          >
            {option.label}
          </button>
        ))}
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {mistakes.map((mistake) => {
            const imageCount = mistake.assets.filter((a) => a.kind === 'image').length;
            const difficultyColors = {
              easy: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
              medium: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
              hard: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
            };
            const statusColors = {
              new: 'text-red-400 bg-red-500/10 border-red-500/30',
              reviewing: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
              resolved: 'text-green-400 bg-green-500/10 border-green-500/30',
            };

            return (
              <button
                key={mistake.id}
                onClick={() => navigate(`/mistakes/${mistake.id}`)}
                className="group rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-800/30 backdrop-blur p-6 text-left hover:border-red-500/50 hover:shadow-xl hover:shadow-red-500/10 transition-all"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg shadow-red-500/25">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded-lg border text-xs font-semibold ${statusColors[mistake.status]}`}>
                      {mistake.status}
                    </span>
                    {imageCount > 0 && (
                      <span className="px-2 py-1 rounded-lg bg-slate-500/10 border border-slate-500/30 text-slate-400 text-xs font-bold flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {imageCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content */}
                <h3 className="text-lg font-semibold text-slate-100 mb-2 group-hover:text-red-400 transition-colors line-clamp-2">
                  {mistake.title}
                </h3>
                
                <div className="space-y-1 text-sm text-slate-400 mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span>{mistake.subject.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span>{mistake.chapter.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      {new Date(mistake.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${difficultyColors[mistake.difficulty]}`}>
                    {mistake.difficulty}
                  </span>
                  <span className="px-2 py-0.5 rounded-full border border-purple-500/40 bg-purple-500/10 text-purple-300 text-[11px] font-semibold">
                    {mistake.errorType}
                  </span>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 mb-3">{mistake.description}</p>

                {/* Hover Arrow */}
                <div className="flex items-center gap-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-sm font-medium">View Details</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}
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

      {/* Choice Modal */}
      <MistakeLogChoiceModal
        open={choiceModalOpen}
        onClose={() => setChoiceModalOpen(false)}
        onChooseManual={() => {
          setChoiceModalOpen(false);
          openCreateForm();
        }}
        onChooseAI={() => {
          setChoiceModalOpen(false);
          setAIDialogOpen(true);
        }}
      />

      {/* AI Logging Dialog */}
      <AIMistakeDialog
        open={aiDialogOpen}
        onClose={() => setAIDialogOpen(false)}
        subjects={subjects}
        onSuccess={(mistakeId) => {
          setAIDialogOpen(false);
          // Navigate to detail view
          navigate(`/mistakes/${mistakeId}`);
        }}
      />

      {/* Image Viewer */}
      <ImageViewerModal
        open={imageViewerOpen}
        images={viewerImages}
        initialIndex={viewerInitialIndex}
        onClose={() => setImageViewerOpen(false)}
      />
    </section>
  );
};