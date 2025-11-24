import { useState, useMemo, useEffect, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import { useShellContext } from '../../app/layouts/useShellContext';
import { FormulaFormDialog } from '../../features/formulas/components/FormulaFormDialog';
import { DeleteConfirmationDialog } from '../../components/ui/DeleteConfirmationDialog';
import { GlowSelect, type GlowSelectOption } from '../../components/ui/GlowSelect';

// Helper to create AI context from collections list
const toAiContext = (collections: any[], filters: { subjectId?: string; chapterId?: string; searchTerm: string }) => ({
  entity: 'formulaCollectionsList',
  totalCount: collections?.length || 0,
  filters,
  collections: collections?.slice(0, 10).map((c: any) => ({
    id: c.id,
    title: c.title,
    subject: c.subject.name,
    chapter: c.chapter.title,
    formulaCount: c._count.formulas,
    createdAt: c.createdAt,
  })) || [],
});

type SortOption = 'recent' | 'oldest' | 'large' | 'small' | 'name';

export const FormulaCollectionsListPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setAiContext, setAiSection } = useShellContext();
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [showDeleted] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<any | null>(null);
  const [subjectId, setSubjectId] = useState<string>();
  const [chapterId, setChapterId] = useState<string>();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const utils = trpc.useUtils();
  const { data: subjects } = trpc.subjects.list.useQuery();
  const createChapterMutation = trpc.subjects.createChapter.useMutation();
  const createFormulaMutation = trpc.formulas.create.useMutation();
  const { data: collections, isLoading } = trpc.formulas.listCollections.useQuery({ includeDeleted: showDeleted });
  const deleteMutation = trpc.formulas.deleteCollections.useMutation();

  const bookmarkStatusQuery = trpc.bookmarks.getStatusForEntities.useQuery(
    {
      entityType: 'formula_collection',
      targets: (collections ?? []).map((c) => ({ entityId: c.id })),
    },
    {
      enabled: !!collections && collections.length > 0,
    },
  );

  const toggleBookmarkMutation = trpc.bookmarks.toggle.useMutation();

  const serverBookmarkedCollectionIds = useMemo(() => {
    const set = new Set<string>();
    (bookmarkStatusQuery.data?.items ?? []).forEach((item: any) => {
      if (!item) return;
      set.add(item.entityId);
    });
    return set;
  }, [bookmarkStatusQuery.data]);

  const [localBookmarkedCollectionIds, setLocalBookmarkedCollectionIds] = useState<Set<string> | null>(null);

  const bookmarkedCollectionIds = localBookmarkedCollectionIds ?? serverBookmarkedCollectionIds;

  // Filter by subject and chapter
  const filteredCollections = useMemo(() => {
    if (!collections) return [];

    return collections.filter((collection) => {
      // Subject filter
      if (subjectId && collection.subjectId !== subjectId) return false;

      // Chapter filter
      if (chapterId && collection.chapterId !== chapterId) return false;

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesTitle = collection.title.toLowerCase().includes(search);
        const matchesSubject = collection.subject.name.toLowerCase().includes(search);
        const matchesChapter = collection.chapter.title.toLowerCase().includes(search);
        if (!matchesTitle && !matchesSubject && !matchesChapter) return false;
      }

      return true;
    });
  }, [collections, subjectId, chapterId, searchTerm]);

  const sortedCollections = useMemo(() => {
    if (!filteredCollections) return [];

    const sorted = [...filteredCollections];

    switch (sortBy) {
      case 'recent':
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'large':
        return sorted.sort((a, b) => b._count.formulas - a._count.formulas);
      case 'small':
        return sorted.sort((a, b) => a._count.formulas - b._count.formulas);
      case 'name':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return sorted;
    }
  }, [filteredCollections, sortBy]);

  // Get chapters for selected subject
  const chapterOptions = useMemo(() => {
    if (!subjectId || !subjects) return [];
    const subject = subjects.find((s) => s.id === subjectId);
    return subject?.chapters ?? [];
  }, [subjectId, subjects]);

  // GlowSelect options for subjects
  const subjectSelectOptions: GlowSelectOption[] = useMemo(() => [
    { value: '', label: 'All subjects' },
    ...(subjects?.map((subject) => ({
      value: subject.id,
      label: subject.name,
    })) || []),
  ], [subjects]);

  // GlowSelect options for chapters
  const chapterSelectOptions: GlowSelectOption[] = useMemo(() => [
    { value: '', label: subjectId ? 'All chapters' : 'Select a subject' },
    ...chapterOptions.map((chapter) => ({
      value: chapter.id,
      label: chapter.title,
    })),
  ], [chapterOptions, subjectId]);

  // Set AI section on mount
  useEffect(() => {
    setAiSection('formulas');
    return () => {
      setAiContext(undefined);
    };
  }, [setAiContext, setAiSection]);

  const handleToggleCollectionBookmark = async (event: MouseEvent<HTMLButtonElement>, collection: (typeof sortedCollections)[number]) => {
    event.stopPropagation();

    const isCurrentlyBookmarked = bookmarkedCollectionIds.has(collection.id);

    setLocalBookmarkedCollectionIds((prev) => {
      const base = new Set(prev ?? serverBookmarkedCollectionIds);
      if (isCurrentlyBookmarked) {
        base.delete(collection.id);
      } else {
        base.add(collection.id);
      }
      return base;
    });

    try {
      await toggleBookmarkMutation.mutateAsync({
        entityType: 'formula_collection',
        entityId: collection.id,
        metadata: {
          title: collection.title,
          subjectName: collection.subject.name,
          chapterTitle: collection.chapter.title,
          formulaCount: collection._count.formulas,
        },
      });

      await Promise.all([
        bookmarkStatusQuery.refetch(),
        utils.bookmarks.listByCategory.invalidate({ category: 'formulas' }).catch(() => undefined),
      ]);

      setLocalBookmarkedCollectionIds(null);
    } catch {
      setLocalBookmarkedCollectionIds(null);
    }
  };

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const intent = searchParams.get('intent');
    if (intent === 'add-formula' && !isModalOpen) {
      setIsModalOpen(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('intent');
        return next;
      }, { replace: true });
    }
  }, [isModalOpen, searchParams, setSearchParams]);

  // Update AI context when collections or filters change
  useEffect(() => {
    const filters = { subjectId, chapterId, searchTerm };
    if (sortedCollections && sortedCollections.length > 0) {
      setAiContext(toAiContext(sortedCollections, filters));
    } else {
      setAiContext(toAiContext([], filters));
    }
  }, [sortedCollections, subjectId, chapterId, searchTerm, setAiContext]);

  const handleDeleteCollection = async () => {
    if (!collectionToDelete) return;

    try {
      await deleteMutation.mutateAsync({ ids: [collectionToDelete.id] });
      await utils.formulas.listCollections.invalidate();
      setCollectionToDelete(null);
    } catch (error) {
      console.error("Failed to delete collection", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400 text-lg">Loading collections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Formula Studio</p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-100 mb-1 sm:mb-2">Archive your derivations</h1>
              <p className="text-xs sm:text-sm text-slate-400">Filter by subject, dissect with AI, and keep every insight searchable.</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors flex-shrink-0"
            >
              Add Formula
            </button>
          </div>

          {/* Filters */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-800/60 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-slate-950/80 glass-card p-4 sm:p-6 shadow-[0_24px_60px_-40px_rgba(15,118,230,0.45)] mb-6">
            <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-end">
              <div className="flex-1 space-y-1.5 sm:space-y-2 md:flex-none md:w-48 lg:w-56">
                <label className="text-xs uppercase tracking-wide text-slate-400">Subject</label>
                <GlowSelect
                  value={subjectId ?? ''}
                  onChange={(value) => {
                    setSubjectId(value || undefined);
                    setChapterId(undefined);
                  }}
                  options={subjectSelectOptions}
                  placeholder="All subjects"
                  placement={isMobile ? 'bottom' : 'right'}
                  className="min-w-0"
                  listClassName="min-w-0 sm:min-w-[12rem]"
                />
              </div>

              <div className="flex-1 space-y-1.5 sm:space-y-2 md:flex-none md:w-48 lg:w-56">
                <label className="text-xs uppercase tracking-wide text-slate-400">Chapter</label>
                <GlowSelect
                  value={chapterId ?? ''}
                  onChange={(value) => setChapterId(value || undefined)}
                  options={chapterSelectOptions}
                  placeholder={subjectId ? 'All chapters' : 'Select a subject'}
                  disabled={!subjectId}
                  placement={isMobile ? 'bottom' : 'right'}
                  className="min-w-0"
                  listClassName="min-w-0 sm:min-w-[12rem]"
                />
              </div>

              <div className="flex-1 space-y-1.5 sm:space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">Search</label>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Title, subject, chapter"
                  className="w-full rounded-xl border border-slate-800/60 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 backdrop-blur focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition"
                />
              </div>

              {(subjectId || chapterId || searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setSubjectId(undefined);
                    setChapterId(undefined);
                    setSearchTerm('');
                  }}
                  className="rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-2 text-sm font-medium text-slate-300 hover:border-primary/40 hover:text-primary transition"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>

          {/* Sort Options */}
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide pb-2">
            <span className="text-xs sm:text-sm text-slate-400 font-medium flex-shrink-0">Sort by:</span>
            {[
              { value: 'recent', label: 'Most Recent' },
              { value: 'oldest', label: 'Oldest First' },
              { value: 'large', label: 'Most Formulas' },
              { value: 'small', label: 'Least Formulas' },
              { value: 'name', label: 'Name (A-Z)' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value as SortOption)}
                className={`flex-shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-colors ${sortBy === option.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                  }`}
              >
                {option.label}
               </button>
             ))}
          </div>
        </div>

        {/* Collections Grid */}
        {!sortedCollections || sortedCollections.length === 0 ? (
          <div className="text-center py-16">
            <div className="mb-4 p-4 rounded-full bg-slate-800/50 inline-block">
              <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-400 mb-2">No Formulas Yet</h2>
            <p className="text-slate-500 mb-6">Add your first formula or use "Bulk Extract with AI" to get started!</p>
            <button
              onClick={() => navigate('/formulas/add')}
              className="px-6 py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
            >
              Add Formula
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {sortedCollections.map((collection) => {
              const isBookmarked = bookmarkedCollectionIds.has(collection.id);

              return (
                <button
                  key={collection.id}
                  onClick={() => navigate(`/formulas/collections/${collection.id}`)}
                  className="group relative rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-800/30 backdrop-blur p-6 text-left hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10 transition-all"
                >
                  {/* Bookmark + Delete Buttons */}
                  <div className="absolute top-4 right-4 z-10 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => handleToggleCollectionBookmark(e, collection)}
                      className={`p-2 rounded-lg border text-xs transition-all ${
                        isBookmarked
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.35)]'
                          : 'bg-slate-900/80 border-slate-700 text-slate-200 hover:bg-slate-800/80'
                      }`}
                      title={isBookmarked ? 'Remove bookmark' : 'Bookmark collection'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 4a2 2 0 012-2h10a2 2 0 012 2v16.382a1 1 0 01-1.447.894L12 17.118l-5.553 4.158A1 1 0 015 20.382V4z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCollectionToDelete(collection);
                      }}
                      className="p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-slate-700 hover:border-red-500/30"
                      title="Delete collection"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Collection Header */}
                  <div className="flex items-start mb-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                  </div>

                  {/* Collection Info */}
                  <h3 className="text-lg font-semibold text-slate-100 mb-2 group-hover:text-blue-400 transition-colors">
                    {collection.title}
                  </h3>

                  <div className="space-y-1 text-sm text-slate-400 mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <span>{collection.subject.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span>{collection.chapter.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        {new Date(collection.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {collection.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{collection.description}</p>
                  )}

                  {/* Bottom row: arrow + formulas count */}
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-sm font-medium">View Collection</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-bold">
                      {collection._count.formulas}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Formula Creation Modal */}
      <FormulaFormDialog
        open={isModalOpen}
        mode="create"
        subjects={subjects}
        defaultValues={undefined}
        isSubmitting={createFormulaMutation.isPending}
        errorMessage={createFormulaMutation.error?.message}
        onClose={() => {
          setIsModalOpen(false);
          createFormulaMutation.reset();
        }}
        onSubmit={async (draft) => {
          try {
            const result = await createFormulaMutation.mutateAsync({
              subjectId: draft.subjectId,
              chapterId: draft.chapterId,
              title: draft.title,
              expression: draft.expression,
              explanation: draft.explanation,
              difficulty: draft.difficulty,
              tags: draft.tags,
              derivationSteps: draft.derivationSteps,
              attachments: draft.attachments,
              applications: draft.applications,
              examples: draft.examples,
              prerequisites: draft.prerequisites,
              relatedFormulas: draft.relatedFormulas,
              commonMistakes: draft.commonMistakes,
            });

            await utils.formulas.listCollections.invalidate();
            setIsModalOpen(false);
            createFormulaMutation.reset();

            // Navigate to the new collection if created successfully
            if ('collectionId' in result) {
              navigate(`/formulas/collections/${result.collectionId}`);
            }
          } catch (error) {
            // Error handled by mutation state
          }
        }}
        onCreateChapter={async (subjectId) => {
          const subject = subjects?.find((s) => s.id === subjectId);
          if (!subject) return undefined;

          const title = window.prompt("New chapter title", "New Chapter");
          if (!title) return undefined;

          const trimmed = title.trim();
          if (!trimmed) return undefined;

          try {
            const chapter = await createChapterMutation.mutateAsync({
              subjectId,
              title: trimmed,
            });
            await utils.subjects.list.invalidate();
            return chapter.id;
          } catch {
            return undefined;
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={!!collectionToDelete}
        title="Delete Collection"
        description="Are you sure you want to delete this collection? All formulas within it will be deleted. This action cannot be undone."
        onClose={() => setCollectionToDelete(null)}
        onConfirm={handleDeleteCollection}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
};
