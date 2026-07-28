import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { JeeDiagram } from '../../quiz/components/JeeDiagram';
import { trpc } from '../../../lib/trpc';

// Add custom styles for better math rendering
const mathStyles = `
  .katex { font-size: 1.1em; }
  .katex-display { 
    font-size: 1.3em; 
    padding: 0.5rem 0;
  }
  .katex .mord { color: inherit; }
  .katex .mbin, .katex .mrel { color: inherit; }
`;

// Helper to ensure LaTeX is wrapped in proper delimiters
const ensureMathDelimiters = (text: string): string => {
  if (!text) return text;
  
  // Convert LaTeX delimiters to KaTeX format
  let converted = text
    // Convert \[ ... \] to $$ ... $$
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$1$$')
    // Convert \( ... \) to $ ... $
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  
  // If already has $ delimiters after conversion, return
  if (converted.includes('$')) return converted;
  
  // If text has LaTeX commands but no delimiters, wrap in $
  if (converted.match(/\\[a-zA-Z]+/)) {
    // For short expressions (likely inline), use single $
    if (converted.length < 100 && !converted.includes('\n')) {
      return `$${converted}$`;
    }
    // For longer expressions, use display math
    return `$$${converted}$$`;
  }
  
  return converted;
};

type FormulaExample = {
  problem: string;
  solution: string;
  answer: string;
};

type CommonMistake = {
  mistake: string;
  correction: string;
};

type Formula = {
  id: string;
  title: string;
  expression: string;
  explanation?: string | null;
  difficulty: string;
  applications?: string | null;
  examples?: FormulaExample[];
  derivationSteps?: string[];
  prerequisites?: string[];
  relatedFormulas?: string[];
  commonMistakes?: CommonMistake[];
  tags?: string[];
  diagram?: unknown;
};

type Collection = {
  id: string;
  title: string;
  description?: string | null;
  subject: { name: string };
  chapter: { title: string };
  formulas: Formula[];
  createdAt: string;
};

type Props = {
  collection: Collection;
  highlightCollection?: boolean;
  highlightFormulaId?: string;
};

 export const FormulaCollectionView = ({ collection, highlightCollection, highlightFormulaId }: Props) => {
  const [expandedFormulas, setExpandedFormulas] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (collection.formulas[0]?.id) {
      initial.add(collection.formulas[0].id);
    }
    if (highlightFormulaId) {
      initial.add(highlightFormulaId);
    }
    return initial;
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, Set<string>>>({});
  const [collectionHighlighted, setCollectionHighlighted] = useState<boolean>(Boolean(highlightCollection));
  const [localCollectionBookmarked, setLocalCollectionBookmarked] = useState<boolean | null>(null);
  const [localBookmarkedFormulaIds, setLocalBookmarkedFormulaIds] = useState<Set<string> | null>(null);

  const utils = trpc.useUtils();

  const collectionBookmarkStatusQuery = trpc.bookmarks.getStatusForEntities.useQuery(
    {
      entityType: 'formula_collection',
      targets: [{ entityId: collection.id }],
    },
    { enabled: true },
  );

  const formulaBookmarkStatusQuery = trpc.bookmarks.getStatusForEntities.useQuery(
    {
      entityType: 'formula',
      targets: collection.formulas.map((f) => ({ entityId: f.id })),
    },
    { enabled: collection.formulas.length > 0 },
  );

  const toggleBookmarkMutation = trpc.bookmarks.toggle.useMutation();

  const serverCollectionBookmarked = !!(collectionBookmarkStatusQuery.data?.items ?? []).some(
    (item: any) => item && item.entityId === collection.id,
  );

  const serverBookmarkedFormulaIds = useMemo(() => {
    const set = new Set<string>();
    (formulaBookmarkStatusQuery.data?.items ?? []).forEach((item: any) => {
      if (!item) return;
      set.add(item.entityId);
    });
    return set;
  }, [formulaBookmarkStatusQuery.data]);

  const isCollectionBookmarked = localCollectionBookmarked ?? serverCollectionBookmarked;
  const bookmarkedFormulaIds = localBookmarkedFormulaIds ?? serverBookmarkedFormulaIds;

  useEffect(() => {
    if (highlightCollection) {
      setCollectionHighlighted(true);
      const timeout = window.setTimeout(() => {
        setCollectionHighlighted(false);
      }, 1600);
      return () => window.clearTimeout(timeout);
    }
  }, [highlightCollection]);

  useEffect(() => {
    if (highlightFormulaId) {
      setExpandedFormulas((prev) => {
        const next = new Set(prev);
        next.add(highlightFormulaId);
        return next;
      });
    }
  }, [highlightFormulaId]);

  const toggleFormula = (formulaId: string) => {
    setExpandedFormulas((prev) => {
      const next = new Set(prev);
      if (next.has(formulaId)) {
        next.delete(formulaId);
      } else {
        next.add(formulaId);
      }
      return next;
    });
  };

  const toggleSection = (formulaId: string, section: string) => {
    setExpandedSections((prev) => {
      const formulaSections = prev[formulaId] || new Set();
      const next = new Set(formulaSections);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return { ...prev, [formulaId]: next };
    });
  };

  const expandAll = () => {
    setExpandedFormulas(new Set(collection.formulas.map((f) => f.id)));
    const allSections: Record<string, Set<string>> = {};
    collection.formulas.forEach((f) => {
      allSections[f.id] = new Set(['applications', 'examples', 'derivation', 'prerequisites', 'related', 'mistakes']);
    });
    setExpandedSections(allSections);
  };

  const collapseAll = () => {
    setExpandedFormulas(new Set());
    setExpandedSections({});
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-signal/10 text-signal border-signal/30';
      case 'medium':
        return 'bg-brass-soft text-brass border-brass/30';
      case 'hard':
        return 'bg-red-500/10 text-red-500 border-red-500/30';
      default:
        return 'bg-surface-2 text-ink-muted border-line';
    }
  };

  const isSectionExpanded = (formulaId: string, section: string) => {
    return expandedSections[formulaId]?.has(section) || false;
  };

  const handleToggleCollectionBookmark = async () => {
    const currentlyBookmarked = isCollectionBookmarked;

    setLocalCollectionBookmarked(!currentlyBookmarked);

    try {
      await toggleBookmarkMutation.mutateAsync({
        entityType: 'formula_collection',
        entityId: collection.id,
        metadata: {
          title: collection.title,
          subjectName: collection.subject.name,
          chapterTitle: collection.chapter.title,
          formulaCount: collection.formulas.length,
        },
      });

      await Promise.all([
        collectionBookmarkStatusQuery.refetch(),
        utils.bookmarks.listByCategory.invalidate({ category: 'formulas' }).catch(() => undefined),
      ]);

      setLocalCollectionBookmarked(null);
    } catch {
      setLocalCollectionBookmarked(null);
    }
  };

  const handleToggleFormulaBookmark = async (formula: Formula) => {
    const formulaId = formula.id;

    setLocalBookmarkedFormulaIds((prev) => {
      const base = new Set(prev ?? serverBookmarkedFormulaIds);
      if (base.has(formulaId)) {
        base.delete(formulaId);
      } else {
        base.add(formulaId);
      }
      return base;
    });

    try {
      await toggleBookmarkMutation.mutateAsync({
        entityType: 'formula',
        entityId: formula.id,
        metadata: {
          title: formula.title,
          subjectName: collection.subject.name,
          chapterTitle: collection.chapter.title,
          collectionId: collection.id,
        },
      });

      await Promise.all([
        formulaBookmarkStatusQuery.refetch(),
        utils.bookmarks.listByCategory.invalidate({ category: 'formulas' }).catch(() => undefined),
      ]);

      setLocalBookmarkedFormulaIds(null);
    } catch {
      setLocalBookmarkedFormulaIds(null);
    }
  };

  return (
    <div className="w-full">
      {/* Inject custom styles for textbook-quality math rendering */}
      <style>{mathStyles}</style>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div
          className={
            "mb-6 sm:mb-8 rounded-2xl sm:rounded-3xl border bg-surface p-4 sm:p-6 lg:p-8 " +
            (collectionHighlighted
              ? "border-brass/70 animate-pulse"
              : "border-line")
          }
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 sm:p-3 rounded-xl bg-brass">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-ink leading-tight">{collection.title}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 font-mono text-xs sm:text-sm text-ink-muted ml-0 sm:ml-14">
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  {collection.subject.name}
                </span>
                <span className="text-ink-muted hidden sm:inline">•</span>
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {collection.chapter.title}
                </span>
                <span className="text-ink-muted hidden sm:inline">•</span>
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {new Date(collection.createdAt).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
            <div className="flex sm:flex-col gap-2 sm:gap-2 items-center sm:items-end">
              <button
                onClick={expandAll}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-brass-soft border border-brass/30 text-brass text-xs sm:text-sm font-medium hover:bg-brass-strong transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-surface-2 border border-line text-ink text-xs sm:text-sm font-medium hover:bg-surface transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>
          {collection.description && (
            <p className="text-ink-muted text-sm sm:text-base ml-0 sm:ml-14">{collection.description}</p>
          )}
          <div className="mt-3 sm:mt-4 ml-0 sm:ml-14 flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-medium text-ink-muted">
              {collection.formulas.length} formula{collection.formulas.length !== 1 ? 's' : ''} extracted
            </span>
            <button
              type="button"
              onClick={handleToggleCollectionBookmark}
              className={`inline-flex items-center gap-1 px-3 sm:px-4 py-1.5 rounded-lg sm:rounded-xl border text-xs sm:text-xs font-medium transition-all duration-300 ${
                isCollectionBookmarked
                  ? 'bg-surface-2 border-brass/30'
                  : 'bg-surface border-line text-ink-muted hover:bg-surface-2 hover:text-ink'
              }`}
              title={isCollectionBookmarked ? 'Remove bookmark' : 'Bookmark collection'}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-300 ${isCollectionBookmarked ? 'scale-110' : 'scale-90'}`}
                fill={isCollectionBookmarked ? 'url(#diamond-gradient-collection)' : 'none'}
                stroke={isCollectionBookmarked ? 'none' : 'currentColor'}
                strokeWidth={isCollectionBookmarked ? 0 : 2}
                viewBox="0 0 24 24"
              >
                <defs>
                  <linearGradient id="diamond-gradient-collection" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="50%" stopColor="#e879f9" />
                    <stop offset="100%" stopColor="#818cf8" />
                  </linearGradient>
                </defs>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Formulas */}
        <div className="space-y-3 sm:space-y-4">
          {collection.formulas.map((formula, index) => {
            const isExpanded = expandedFormulas.has(formula.id);
            const isHighlighted = highlightFormulaId === formula.id;
            
            return (
              <div
                key={formula.id}
                className={
                  "relative rounded-xl sm:rounded-2xl border bg-surface overflow-hidden shadow-xl hover:shadow-2xl transition-shadow " +
                  (isHighlighted
                    ? "border-brass/70 animate-pulse"
                    : "border-line")
                }
              >
                {/* Formula Header */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleFormula(formula.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleFormula(formula.id);
                    }
                  }}
                  className="w-full px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl font-bold font-mono text-sm sm:text-lg bg-brass text-white flex-shrink-0`}>
                      {index + 1}
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <h3 className="text-lg font-display sm:text-xl font-semibold text-ink leading-tight">{formula.title}</h3>
                      <div className="flex flex-wrap items-center font-mono gap-1 sm:gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getDifficultyColor(formula.difficulty)}`}>
                          {formula.difficulty}
                        </span>
                        {formula.tags && formula.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {formula.tags.slice(0, 2).map((tag, i) => (
                              <span key={i} className="px-2 py-0.5 rounded text-xs text-ink-muted bg-surface-2 border border-line">
                                {tag}
                              </span>
                            ))}
                            {formula.tags.length > 2 && (
                              <span className="px-2 py-0.5 rounded text-xs text-ink-muted bg-surface-2 border border-line">
                                +{formula.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleToggleFormulaBookmark(formula);
                      }}
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border text-xs transition-all duration-300 ${
                        bookmarkedFormulaIds.has(formula.id)
                          ? 'bg-surface-2 border-brass/30'
                          : 'bg-surface border-line text-ink-muted hover:text-ink hover:bg-surface-2'
                      }`}
                      title={bookmarkedFormulaIds.has(formula.id) ? 'Remove bookmark' : 'Bookmark formula'}
                    >
                      <svg
                        className={`w-4 h-4 transition-transform duration-300 ${
                          bookmarkedFormulaIds.has(formula.id) ? 'scale-110' : 'scale-90'
                        }`}
                        fill={bookmarkedFormulaIds.has(formula.id) ? 'url(#diamond-gradient-formula)' : 'none'}
                        stroke={bookmarkedFormulaIds.has(formula.id) ? 'none' : 'currentColor'}
                        strokeWidth={bookmarkedFormulaIds.has(formula.id) ? 0 : 2}
                        viewBox="0 0 24 24"
                      >
                        <defs>
                          <linearGradient id="diamond-gradient-formula" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#22d3ee" />
                            <stop offset="50%" stopColor="#e879f9" />
                            <stop offset="100%" stopColor="#818cf8" />
                          </linearGradient>
                        </defs>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                        />
                      </svg>
                    </button>
                    <svg
                      className={`w-6 h-6 text-ink-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Formula Content */}
                {isExpanded && (
                  <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-3 sm:space-y-4">
                    {/* Expression */}
                    <div className="p-4 sm:p-6 rounded-xl bg-surface-2 border border-line">
                      <div className="formula-expression text-center text-ink font-mono">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath, remarkGfm]}
                          rehypePlugins={[rehypeKatex]}
                          className="text-xl sm:text-2xl lg:text-3xl"
                        >
                          {ensureMathDelimiters(formula.expression)}
                        </ReactMarkdown>
                      </div>
                      {formula.diagram ? (
                        <div className="mt-4">
                          <JeeDiagram diagram={formula.diagram as any} />
                        </div>
                      ) : null}
                    </div>

                    {/* Explanation */}
                    {formula.explanation && (
                      <div className="prose prose-invert prose-sm sm:prose-base max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath, remarkGfm]}
                          rehypePlugins={[rehypeKatex]}
                          className="text-ink leading-relaxed text-sm sm:text-base"
                        >
                          {ensureMathDelimiters(formula.explanation)}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Collapsible Sections */}
                    <div className="space-y-3">
                      {/* Applications */}
                      {formula.applications && (
                        <div className="rounded-xl border border-line bg-surface-2 overflow-hidden">
                          <button
                            onClick={() => toggleSection(formula.id, 'applications')}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface transition-colors"
                          >
                            <span className="flex items-center gap-2 text-ink font-medium">
                              <svg className="w-5 h-5 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Applications
                            </span>
                            <svg
                              className={`w-5 h-5 text-ink-muted transition-transform ${isSectionExpanded(formula.id, 'applications') ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isSectionExpanded(formula.id, 'applications') && (
                            <div className="px-4 pb-4">
                              <ReactMarkdown
                                remarkPlugins={[remarkMath, remarkGfm]}
                                rehypePlugins={[rehypeKatex]}
                                className="text-ink text-sm leading-relaxed"
                              >
                                {ensureMathDelimiters(formula.applications)}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Examples */}
                      {formula.examples && formula.examples.length > 0 && (
                        <div className="rounded-xl border border-line bg-surface-2 overflow-hidden">
                          <button
                            onClick={() => toggleSection(formula.id, 'examples')}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface transition-colors"
                          >
                            <span className="flex items-center gap-2 text-ink font-medium">
                              <svg className="w-5 h-5 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Worked Examples ({formula.examples.length})
                            </span>
                            <svg
                              className={`w-5 h-5 text-ink-muted transition-transform ${isSectionExpanded(formula.id, 'examples') ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isSectionExpanded(formula.id, 'examples') && (
                            <div className="px-4 pb-4 space-y-3">
                              {formula.examples.map((example, i) => (
                                <div key={i} className="p-3 rounded-lg bg-surface border border-line">
                                  <div className="mb-2">
                                    <span className="text-xs font-semibold font-mono text-ink-muted">Problem:</span>
                                    <ReactMarkdown
                                      remarkPlugins={[remarkMath, remarkGfm]}
                                      rehypePlugins={[rehypeKatex]}
                                      className="text-ink text-sm mt-1"
                                    >
                                      {ensureMathDelimiters(example.problem)}
                                    </ReactMarkdown>
                                  </div>
                                  <div className="mb-2">
                                    <span className="text-xs font-semibold font-mono text-ink-muted">Solution:</span>
                                    <ReactMarkdown
                                      remarkPlugins={[remarkMath, remarkGfm]}
                                      rehypePlugins={[rehypeKatex]}
                                      className="text-ink text-sm mt-1"
                                    >
                                      {ensureMathDelimiters(example.solution)}
                                    </ReactMarkdown>
                                  </div>
                                  <div>
                                    <span className="text-xs font-semibold font-mono text-ink-muted">Answer:</span>
                                    <ReactMarkdown
                                      remarkPlugins={[remarkMath, remarkGfm]}
                                      rehypePlugins={[rehypeKatex]}
                                      className="text-ink text-sm mt-1 font-medium"
                                    >
                                      {ensureMathDelimiters(example.answer)}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Derivation Steps */}
                      {formula.derivationSteps && formula.derivationSteps.length > 0 && (
                        <div className="rounded-xl border border-line bg-surface-2 overflow-hidden">
                          <button
                            onClick={() => toggleSection(formula.id, 'derivation')}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface transition-colors"
                          >
                            <span className="flex items-center gap-2 text-ink font-medium">
                              <svg className="w-5 h-5 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                              Derivation ({formula.derivationSteps.length} steps)
                            </span>
                            <svg
                              className={`w-5 h-5 text-ink-muted transition-transform ${isSectionExpanded(formula.id, 'derivation') ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isSectionExpanded(formula.id, 'derivation') && (
                            <div className="px-4 pb-4 space-y-2">
                              {formula.derivationSteps.map((step, i) => (
                                <div key={i} className="flex items-start gap-3">
                                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-surface text-ink-muted border border-line font-mono text-xs font-bold flex items-center justify-center mt-0.5">
                                    {i + 1}
                                  </span>
                                  <ReactMarkdown
                                    remarkPlugins={[remarkMath, remarkGfm]}
                                    rehypePlugins={[rehypeKatex]}
                                    className="text-ink text-sm flex-1"
                                  >
                                    {ensureMathDelimiters(step)}
                                  </ReactMarkdown>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Prerequisites */}
                      {formula.prerequisites && formula.prerequisites.length > 0 && (
                        <div className="rounded-xl border border-line bg-surface-2 overflow-hidden">
                          <button
                            onClick={() => toggleSection(formula.id, 'prerequisites')}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface transition-colors"
                          >
                            <span className="flex items-center gap-2 text-ink font-medium">
                              <svg className="w-5 h-5 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              Prerequisites
                            </span>
                            <svg
                              className={`w-5 h-5 text-ink-muted transition-transform ${isSectionExpanded(formula.id, 'prerequisites') ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isSectionExpanded(formula.id, 'prerequisites') && (
                            <div className="px-4 pb-4">
                              <ul className="space-y-1">
                                {formula.prerequisites.map((prereq, i) => (
                                  <li key={i} className="flex items-start gap-2 text-ink text-sm">
                                    <span className="text-ink-muted mt-1">•</span>
                                    <span>{prereq}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Related Formulas */}
                      {formula.relatedFormulas && formula.relatedFormulas.length > 0 && (
                        <div className="rounded-xl border border-line bg-surface-2 overflow-hidden">
                          <button
                            onClick={() => toggleSection(formula.id, 'related')}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface transition-colors"
                          >
                            <span className="flex items-center gap-2 text-ink font-medium">
                              <svg className="w-5 h-5 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                              Related Formulas
                            </span>
                            <svg
                              className={`w-5 h-5 text-ink-muted transition-transform ${isSectionExpanded(formula.id, 'related') ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isSectionExpanded(formula.id, 'related') && (
                            <div className="px-4 pb-4">
                              <ul className="space-y-1">
                                {formula.relatedFormulas.map((related, i) => (
                                  <li key={i} className="flex items-start gap-2 text-ink text-sm">
                                    <span className="text-ink-muted mt-1">→</span>
                                    <span>{related}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Common Mistakes */}
                      {formula.commonMistakes && formula.commonMistakes.length > 0 && (
                        <div className="rounded-xl border border-line bg-surface-2 overflow-hidden">
                          <button
                            onClick={() => toggleSection(formula.id, 'mistakes')}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface transition-colors"
                          >
                            <span className="flex items-center gap-2 text-ink font-medium">
                              <svg className="w-5 h-5 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Common Mistakes
                            </span>
                            <svg
                              className={`w-5 h-5 text-ink-muted transition-transform ${isSectionExpanded(formula.id, 'mistakes') ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isSectionExpanded(formula.id, 'mistakes') && (
                            <div className="px-4 pb-4 space-y-3">
                              {formula.commonMistakes.map((mistake, i) => (
                                <div key={i} className="p-3 rounded-lg bg-surface border border-line">
                                  <div className="mb-2">
                                    <span className="text-xs font-semibold font-mono text-red-500">❌ Mistake:</span>
                                    <ReactMarkdown
                                      remarkPlugins={[remarkMath, remarkGfm]}
                                      rehypePlugins={[rehypeKatex]}
                                      className="text-ink text-sm mt-1"
                                    >
                                      {ensureMathDelimiters(mistake.mistake)}
                                    </ReactMarkdown>
                                  </div>
                                  <div>
                                    <span className="text-xs font-semibold font-mono text-signal">✓ Correction:</span>
                                    <ReactMarkdown
                                      remarkPlugins={[remarkMath, remarkGfm]}
                                      rehypePlugins={[rehypeKatex]}
                                      className="text-ink text-sm mt-1"
                                    >
                                      {ensureMathDelimiters(mistake.correction)}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quiz History Shortcut */}
        <div className="mt-6 sm:mt-8 glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-line">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-ink flex items-center gap-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Practice Quizzes
              </h3>
              <p className="text-xs sm:text-sm text-ink-muted mt-1">
                View all quizzes created from this collection
              </p>
            </div>
            <a
              href="/quiz-history"
              className="w-full sm:w-auto px-4 py-2 rounded-lg sm:rounded-xl bg-brass-soft border border-brass/30 text-brass font-medium hover:bg-brass/20 transition-all flex items-center justify-center gap-2 text-sm"
            >
              View All Quizzes
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
          <p className="text-ink-muted font-mono text-xs sm:text-sm">
            Generated quizzes from this collection will appear here. Use the AI mentor to create practice quizzes!
          </p>
        </div>
      </div>
    </div>
  );
};
