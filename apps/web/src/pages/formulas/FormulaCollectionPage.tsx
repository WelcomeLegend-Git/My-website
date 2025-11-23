import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import { FormulaCollectionView } from '../../features/formulas/components/FormulaCollectionView';
import { useShellContext } from '../../app/layouts/useShellContext';

// Helper to create AI context from collection
const toAiContext = (collection: any) => ({
  entity: 'formulaCollection',
  id: collection.id,
  title: collection.title,
  description: collection.description,
  subject: collection.subject.name,
  chapter: collection.chapter.title,
  formulaCount: collection.formulas?.length || 0,
  formulas: collection.formulas?.map((f: any) => ({
    id: f.id,
    title: f.title,
    expression: f.expression,
    explanation: f.explanation,
    difficulty: f.difficulty,
    applications: f.applications,
    prerequisites: f.prerequisites,
  })) || [],
});

export const FormulaCollectionPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setAiContext, setAiSection } = useShellContext();
  const [searchParams] = useSearchParams();

  const { data: collection, isLoading, error } = trpc.formulas.getCollection.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  // Set AI context when collection loads
  useEffect(() => {
    setAiSection('formulas');
    return () => {
      setAiContext(undefined);
    };
  }, [setAiContext, setAiSection]);

  useEffect(() => {
    if (collection) {
      setAiContext(toAiContext(collection));
    } else {
      setAiContext(undefined);
    }
  }, [collection, setAiContext]);

  const highlightCollection = searchParams.get('highlightCollection') === '1';
  const highlightFormulaId = searchParams.get('highlightFormulaId') || undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400 text-lg">Loading collection...</p>
        </div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mb-4 p-4 rounded-full bg-red-500/10 inline-block">
            <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Collection Not Found</h2>
          <p className="text-slate-400 mb-6">
            The formula collection you're looking for doesn't exist or you don't have access to it.
          </p>
          <button
            onClick={() => navigate('/formulas')}
            className="px-6 py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
          >
            Back to Formula Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <FormulaCollectionView
      collection={collection as any}
      highlightCollection={highlightCollection}
      highlightFormulaId={highlightFormulaId}
    />
  );
};
