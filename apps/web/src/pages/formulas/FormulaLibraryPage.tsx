import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useShellContext } from "../../app/layouts/useShellContext";
import { GlowSelect } from "../../components/ui/GlowSelect";
import { FormulaCard } from "../../features/formulas/components/FormulaCard";
import { DeleteConfirmationDialog } from "../../components/ui/DeleteConfirmationDialog";
import {
  FormulaFormDialog,
  type FormulaDraft,
} from "../../features/formulas/components/FormulaFormDialog";
import { trpc } from "../../lib/trpc";
import { JeeDiagram } from "../../features/quiz/components/JeeDiagram";

const trpcAny: any = trpc as any;

type Formula = any;
type Subject = any;
type FormulaCreateInput = any;
type FormulaUpdateInput = any;

type FormState =
  | { mode: "create" }
  | {
      mode: "edit";
      formula: Formula;
    };

type FormulaFilters = {
  subjectId?: string;
  chapterId?: string;
  search?: string;
};

const toAiContext = (formula: Formula) => ({
  entity: "formula",
  id: formula.id,
  title: formula.title,
  expression: formula.expression,
  difficulty: formula.difficulty,
  subject: formula.subject.name,
  chapter: formula.chapter.title,
  tags: formula.tags,
  explanation: formula.explanation,
});

const toAiListContext = (
  items: Formula[],
  filters: { subjectId?: string; chapterId?: string; search?: string }
) => ({
  entity: 'formulasList',
  totalCount: items.length,
  filters,
  items: items.slice(0, 12).map((f) => ({
    id: f.id,
    title: f.title,
    subject: f.subject.name,
    chapter: f.chapter.title,
    difficulty: f.difficulty,
    hasExplanation: !!f.explanation,
    tagCount: ((f.tags as unknown as string[]) || []).length,
  })),
});

const ensureChapterOptions = (subjectId: string | undefined, subjects?: Subject[]) => {
  if (!subjectId) {
    return [];
  }
  return subjects?.find((subject) => subject.id === subjectId)?.chapters ?? [];
};

const buildDraftFromFormula = (formula: Formula): FormulaDraft => ({
  subjectId: formula.subjectId,
  chapterId: formula.chapterId,
  title: formula.title,
  expression: formula.expression,
  explanation: formula.explanation ?? undefined,
  difficulty: formula.difficulty,
  tags: (formula.tags as string[]) ?? [],
  derivationSteps: formula.derivationSteps ?? [],
  attachments:
    formula.assets?.map((asset: any) => ({
      id: asset.id,
      url: asset.url,
      kind: asset.kind as "image" | "pdf" | "link",
      title: asset.title,
    })) ?? [],
});

export const FormulaLibraryPage = () => {
  const location = useLocation();
  const { setAiSection, setAiContext, openAi } = useShellContext();
  const utils = trpcAny.useUtils();

  const { data: subjects, isLoading: subjectsLoading } = trpc.subjects.list.useQuery();

  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [chapterId, setChapterId] = useState<string | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(null);
  const [formState, setFormState] = useState<FormState | null>(null);
  const [pendingFormulaId, setPendingFormulaId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [formulaToDelete, setFormulaToDelete] = useState<Formula | null>(null);

  const deferredSearch = useDeferredValue(searchTerm);

  const filters = useMemo<FormulaFilters | undefined>(() => {
    const trimmed = deferredSearch.trim();
    const active: FormulaFilters = {
      subjectId,
      chapterId,
      search: trimmed ? trimmed : undefined,
    };
    if (!active.subjectId && !active.chapterId && !active.search) {
      return undefined;
    }
    return active;
  }, [chapterId, deferredSearch, subjectId]);

  const {
    data: formulas,
    isLoading: formulasLoading,
    isFetching: formulasFetching,
  } = trpcAny.formulas.list.useQuery(filters as any, {
    placeholderData: (previousData: any) => previousData,
  });

  const createMutation = trpc.formulas.create.useMutation();
  const updateMutation = trpc.formulas.update.useMutation();
  const deleteMutation = trpc.formulas.remove.useMutation();
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
    setAiSection("formulas");
    return () => {
      setAiContext(undefined);
    };
  }, [setAiContext, setAiSection]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Auto-open add formula modal when navigating to /formulas/add
  useEffect(() => {
    if (location.pathname === '/formulas/add' && !formState) {
      setFormState({ mode: 'create' });
    }
  }, [location.pathname, formState]);

  useEffect(() => {
    if (selectedFormula) {
      setAiContext(toAiContext(selectedFormula));
    } else {
      setAiContext(undefined);
    }
  }, [selectedFormula, setAiContext]);

  useEffect(() => {
    if (selectedFormula) return;
    const search = deferredSearch.trim();
    if (formulas && formulas.length > 0) {
      setAiContext(toAiListContext(formulas, { subjectId, chapterId, search: search || undefined }));
    } else {
      setAiContext(undefined);
    }
  }, [selectedFormula, formulas, subjectId, chapterId, deferredSearch, setAiContext]);

  useEffect(() => {
    if (!formulas || formulas.length === 0) {
      if (selectedFormula !== null) {
        setSelectedFormula(null);
      }
      return;
    }

    const desired =
      (pendingFormulaId ? formulas.find((formula: any) => formula.id === pendingFormulaId) : undefined) ??
      (selectedFormula ? formulas.find((formula: any) => formula.id === selectedFormula.id) : undefined) ??
      formulas[0];

    if (!desired) {
      if (selectedFormula !== null) {
        setSelectedFormula(null);
      }
      return;
    }

    if (
      !selectedFormula ||
      selectedFormula.id !== desired.id ||
      selectedFormula.updatedAt !== desired.updatedAt
    ) {
      setSelectedFormula(desired);
    }

    if (pendingFormulaId && formulas.some((formula: any) => formula.id === pendingFormulaId)) {
      setPendingFormulaId(null);
    }
  }, [formulas, pendingFormulaId, selectedFormula]);

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
    if (chapterId && !chapters.some((chapter: any) => chapter.id === chapterId)) {
      setChapterId(undefined);
    }
  }, [chapterId, subjectId, subjects]);

  const handleDeleteClick = (formula: Formula) => {
    setFormulaToDelete(formula);
  };

  const handleConfirmDelete = async () => {
    if (!formulaToDelete) return;

    try {
      await deleteMutation.mutateAsync({ id: formulaToDelete.id });
      await utils.formulas.list.invalidate();
      setSelectedFormula((current: any) => (current?.id === formulaToDelete.id ? null : current));
      setFormulaToDelete(null);
    } catch {
      // Error surfaces via mutation state.
    }
  };

  const handleFormSubmit = async (draft: FormulaDraft) => {
    const payload: FormulaCreateInput = {
      subjectId: draft.subjectId,
      chapterId: draft.chapterId,
      title: draft.title,
      expression: draft.expression,
      explanation: draft.explanation,
      difficulty: draft.difficulty,
      derivationSteps: draft.derivationSteps,
      tags: draft.tags,
      attachments: draft.attachments,
    };

    try {
      if (formState?.mode === "edit") {
        const updatePayload: FormulaUpdateInput = { id: formState.formula.id, ...payload };
        await updateMutation.mutateAsync(updatePayload);
      } else {
        setSubjectId(draft.subjectId);
        setChapterId(draft.chapterId);
        const created = await createMutation.mutateAsync(payload);
        setPendingFormulaId(created.id);
      }
      await utils.formulas.list.invalidate();
      setFormState(null);
    } catch {
      // handled by mutation errors
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

  const openEditForm = (formula: Formula) => {
    setFormState({ mode: "edit", formula });
    updateMutation.reset();
  };

  const chapterOptions = ensureChapterOptions(subjectId, subjects);
  const isEmpty = !formulasLoading && (!formulas || formulas.length === 0);

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
      ...chapterOptions.map((chapter: any) => ({ value: chapter.id, label: chapter.title })),
    ];
  }, [chapterOptions, subjectId]);

  const currentFormDefaults: FormulaDraft | undefined = formState
    ? formState.mode === "edit"
      ? buildDraftFromFormula(formState.formula)
      : {
          subjectId:
            subjectId ?? subjects?.[0]?.id ?? "",
          chapterId:
            chapterId ?? ensureChapterOptions(subjectId ?? subjects?.[0]?.id, subjects)[0]?.id ?? "",
          title: "",
          expression: "",
          explanation: "",
          difficulty: "medium",
          tags: [],
          derivationSteps: [],
          attachments: [],
        }
    : undefined;

  const formError = formState?.mode === "edit" ? updateMutation.error?.message : createMutation.error?.message;
  const isSaving = formState?.mode === "edit" ? updateMutation.isPending : createMutation.isPending;

  return (
    <section className="space-y-6">
      {/* Only show modal when formState is set, hide everything else */}
      {formState && (
        <FormulaFormDialog
          key={formState.mode === "edit" ? formState.formula.id : "create"}
          defaultValues={currentFormDefaults}
          onSubmit={handleFormSubmit}
          onClose={closeForm}
          open={true}
          mode={formState.mode}
          subjects={subjects ?? []}
          onCreateChapter={handleCreateChapter}
          errorMessage={formError}
          isSubmitting={isSaving}
        />
      )}

      {/* Only show main interface when no modal is open */}
      {!formState && (
        <>
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] font-mono text-ink-muted">Formula studio</p>
              <h2 className="text-3xl font-display font-semibold text-ink">Add Formula</h2>
              <p className="text-sm text-ink-muted">Create a new formula or use AI bulk extraction</p>
            </div>
            <div className="flex gap-2">
              <a
                href="/formulas"
                className="rounded-xl bg-surface-2 border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-surface transition-colors"
              >
                ← Back to Formulas
              </a>
              <button
                type="button"
                className="rounded-xl bg-brass px-4 py-2 text-sm font-semibold text-white"
                onClick={openCreateForm}
              >
                Add formula
              </button>
            </div>
          </header>

          <div className="rounded-3xl border border-line bg-surface glass-card p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1 space-y-2 md:flex-none md:w-56">
                <label className="text-xs uppercase font-mono tracking-wide text-ink-muted">Subject</label>
                <GlowSelect
                  id="formula-subject"
                  value={subjectId ?? ""}
                  onChange={(nextValue: any) => setSubjectId(nextValue || undefined)}
                  options={subjectSelectOptions}
                  placeholder="All subjects"
                  placement={isMobile ? "bottom" : undefined}
                  className="min-w-0"
                  listClassName="min-w-0 sm:min-w-[12rem]"
                />
              </div>

              <div className="flex-1 space-y-2 md:flex-none md:w-56">
                <label className="text-xs uppercase font-mono tracking-wide text-ink-muted">Chapter</label>
                <GlowSelect
                  id="formula-chapter"
                  value={chapterId ?? ""}
                  onChange={(nextValue: any) => setChapterId(nextValue || undefined)}
                  options={chapterSelectOptions}
                  placeholder={subjectId ? "All chapters" : "Select a subject"}
                  disabled={!subjectId || !chapterOptions.length}
                  placement={isMobile ? "bottom" : undefined}
                  className="min-w-0"
                  listClassName="min-w-0 sm:min-w-[12rem]"
                />
              </div>

              <div className="flex-1 space-y-2">
                <label className="text-xs uppercase font-mono tracking-wide text-ink-muted">Search</label>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event: any) => setSearchTerm(event.target.value)}
                  placeholder="Title, expression, explanation keywords"
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink backdrop-blur focus:border-brass/50 focus:ring-2 focus:ring-brass/20 focus:outline-none transition"
                />
              </div>

              {(subjectId || chapterId || searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setSubjectId(undefined);
                    setChapterId(undefined);
                    setSearchTerm("");
                  }}
                  className="rounded-xl border border-line bg-surface-2 px-4 py-2 text-sm font-medium text-ink hover:border-brass/40 hover:text-brass transition"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.3fr_minmax(0,1fr)]">
            <div className="space-y-3">
              {subjectsLoading || formulasLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-28 rounded-2xl border border-line bg-surface-2"
                    />
                  ))}
                </div>
              ) : isEmpty ? (
                <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-ink-muted">
                  No formulas yet. Capture your first derivation to unlock AI powered insights.
                </div>
              ) : (
                formulas?.map((formula: any) => (
                  <FormulaCard
                    key={formula.id}
                    formula={formula}
                    isActive={selectedFormula?.id === formula.id}
                    onSelect={(formula: any) => setSelectedFormula(formula)}
                    onEdit={(formula: any) => openEditForm(formula)}
                    onDelete={handleDeleteClick}
                  />
                ))
              )}
              {formulasFetching && formulas && formulas.length > 0 && (
                <p className="text-center text-xs text-ink-muted">Refreshing...</p>
              )}
            </div>

            <aside className="space-y-4">
              {selectedFormula ? (
                <div className="rounded-2xl border border-line bg-surface p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase font-mono tracking-[0.3em] text-ink-muted">Active formula</p>
                      <h3 className="mt-2 text-2xl font-display font-semibold text-ink">{selectedFormula.title}</h3>
                    </div>
                    <span className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs uppercase font-mono tracking-wide text-ink-muted">
                      {selectedFormula.difficulty}
                    </span>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap font-mono text-sm text-ink">{selectedFormula.expression}</p>
                  {selectedFormula.diagram ? (
                    <div className="mt-4">
                      <JeeDiagram diagram={selectedFormula.diagram as any} />
                    </div>
                  ) : null}
                  {selectedFormula.explanation && (
                    <p className="mt-4 text-sm leading-relaxed text-ink">{selectedFormula.explanation}</p>
                  )}
                  {selectedFormula.derivationSteps?.length ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs uppercase tracking-wide font-mono text-ink-muted">Derivation steps</p>
                      <ol className="space-y-2 text-sm text-ink">
                        {selectedFormula.derivationSteps.map((step: any, index: number) => (
                          <li
                            key={index}
                            className="rounded-xl border border-line bg-surface-2 px-3 py-2"
                          >
                            <span className="mr-2 text-xs text-ink-muted font-mono">{index + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                  {selectedFormula.tags?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedFormula.tags.map((tag: any) => (
                        <span
                          key={tag}
                          className="rounded-full border border-brass/40 bg-brass-soft px-3 py-1 text-xs uppercase font-mono tracking-wide text-brass"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:border-line hover:bg-surface-2 transition"
                      onClick={() => openEditForm(selectedFormula)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 hover:border-red-500 hover:text-red-600 transition"
                      onClick={() => handleDeleteClick(selectedFormula)}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-brass px-4 py-2 text-sm font-semibold text-white hover:bg-brass-strong transition"
                      onClick={() => {
                        setAiContext(toAiContext(selectedFormula));
                        openAi();
                      }}
                    >
                      Ask mentor about this
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-ink-muted">
                  Select a formula to surface derivations, context, and AI prompts.
                </div>
              )}
              {deleteMutation.error && (
                <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-500">
                  {deleteMutation.error.message}
                </p>
              )}
            </aside>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={!!formulaToDelete}
        title="Delete Formula"
        description="Are you sure you want to delete this formula? This action cannot be undone."
        onClose={() => setFormulaToDelete(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />
    </section>
  );
};