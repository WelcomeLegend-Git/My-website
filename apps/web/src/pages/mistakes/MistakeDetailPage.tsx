import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import { MistakeDetailView } from '../../features/mistakes/components/MistakeDetailView';
import { ImageViewerModal } from '../../features/mistakes/components/ImageViewerModal';
import { DeleteConfirmationDialog } from '../../components/ui/DeleteConfirmationDialog';
import { useShellContext } from '../../app/layouts/useShellContext';

// Helper to create AI context from mistake
const toAiContext = (mistake: any) => ({
  entity: 'mistake',
  id: mistake.id,
  title: mistake.title,
  description: mistake.description,
  errorType: mistake.errorType,
  difficulty: mistake.difficulty,
  status: mistake.status,
  subject: mistake.subject.name,
  chapter: mistake.chapter.title,
  aiSummary: mistake.aiSummary,
  imageCount: mistake.assets?.filter((a: any) => a.kind === 'image').length || 0,
});

export const MistakeDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAiContext, setAiSection } = useShellContext();
  const utils = trpc.useUtils();
  const deleteMutation = trpc.mistakes.remove.useMutation();
  const [imageViewerState, setImageViewerState] = useState<{
    open: boolean;
    initialIndex: number;
  }>({ open: false, initialIndex: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [highlightHeader, setHighlightHeader] = useState(false);

  const { data: mistake, isLoading, error } = trpc.mistakes.getMistake.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const bookmarkStatusQuery = trpc.bookmarks.getStatusForEntities.useQuery(
    {
      entityType: 'mistake',
      targets: id ? [{ entityId: id }] : [],
    },
    {
      enabled: !!id && !!mistake,
    },
  );

  const toggleBookmarkMutation = trpc.bookmarks.toggle.useMutation();

  const isBookmarked = !!(bookmarkStatusQuery.data?.items ?? []).some(
    (item: any) => item && item.entityId === id,
  );

  // Set AI context when mistake loads
  useEffect(() => {
    setAiSection('mistakes');
    return () => {
      setAiContext(undefined);
    };
  }, [setAiContext, setAiSection]);

  useEffect(() => {
    if (mistake) {
      setAiContext(toAiContext(mistake));
    } else {
      setAiContext(undefined);
    }
  }, [mistake, setAiContext]);

  useEffect(() => {
    if (searchParams.get('highlight') === '1') {
      setHighlightHeader(true);
      const timeout = window.setTimeout(() => setHighlightHeader(false), 1600);
      return () => window.clearTimeout(timeout);
    }
  }, [searchParams]);

  const handleImageClick = (_imageUrl: string, imageIndex: number, _allImages: string[]) => {
    setImageViewerState({
      open: true,
      initialIndex: imageIndex,
    });
  };

  const handleImageViewerClose = () => {
    setImageViewerState({ open: false, initialIndex: 0 });
  };

  const imageAssets = mistake?.assets.filter((a: any) => a.kind === 'image') || [];

  const handleConfirmDelete = async () => {
    if (!mistake) return;

    try {
      await deleteMutation.mutateAsync({ id: mistake.id });
      await utils.mistakes.list.invalidate();
      navigate('/mistakes');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete mistake.';
      alert(message);
    }
  };

  const handleToggleBookmark = async () => {
    if (!mistake) return;

    try {
      await toggleBookmarkMutation.mutateAsync({
        entityType: 'mistake',
        entityId: mistake.id,
        metadata: {
          title: mistake.title,
          subjectName: mistake.subject.name,
          chapterTitle: mistake.chapter.title,
          status: mistake.status,
          difficulty: mistake.difficulty,
        },
      });

      await Promise.all([
        bookmarkStatusQuery.refetch(),
        utils.bookmarks.listByCategory.invalidate({ category: 'mistakes' }).catch(() => undefined),
      ]);
    } catch {
      // ignore for now
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400 text-lg">Loading mistake details...</p>
        </div>
      </div>
    );
  }

  if (error || !mistake) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mb-4 p-4 rounded-full bg-red-500/10 inline-block">
            <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Mistake Not Found</h2>
          <p className="text-slate-400 mb-6">
            The mistake log you're looking for doesn't exist or you don't have access to it.
          </p>
          <button
            onClick={() => navigate('/mistakes')}
            className="px-6 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
          >
            Back to Mistake Log
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <MistakeDetailView
        mistake={mistake}
        onImageClick={handleImageClick}
        highlightHeader={highlightHeader}
        isBookmarked={isBookmarked}
        onToggleBookmark={handleToggleBookmark}
      />
      <ImageViewerModal
        open={imageViewerState.open}
        images={imageAssets}
        initialIndex={imageViewerState.initialIndex}
        onClose={handleImageViewerClose}
      />
      <DeleteConfirmationDialog
        open={showDeleteConfirm}
        title="Delete Mistake"
        description="This will permanently delete this mistake log and all its attachments. This cannot be undone."
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />
    </>
  );
};
