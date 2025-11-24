import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { JeeDiagram } from '../../quiz/components/JeeDiagram';

const mathStyles = `
  .katex { font-size: 1.1em; }
  .katex-display { font-size: 1.3em; padding: 0.5rem 0; }
`;

const ensureMathDelimiters = (text: string): string => {
  if (!text) return text;
  let converted = text
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$1$$')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  if (converted.includes('$')) return converted;
  if (converted.match(/\\[a-zA-Z]+/)) {
    return converted.length < 100 ? `$${converted}$` : `$$${converted}$$`;
  }
  return converted;
};

type MistakeAsset = {
  id: string;
  url: string;
  kind: string;
  caption?: string | null;
};

type Mistake = {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  errorType: string;
  status: string;
  aiSummary?: string | null;
  aiMindMap?: any;
   aiDiagram?: any;
  subject: { name: string };
  chapter: { title: string };
  assets: MistakeAsset[];
  createdAt: string;
};

type Props = {
  mistake: Mistake;
  onImageClick?: (imageUrl: string, imageIndex: number, allImages: string[]) => void;
  highlightHeader?: boolean;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
};

export const MistakeDetailView = ({ mistake, onImageClick, highlightHeader, isBookmarked, onToggleBookmark }: Props) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']));

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const expandAll = () => setExpandedSections(new Set(['summary', 'description', 'images']));
  const collapseAll = () => setExpandedSections(new Set());

  const getDifficultyColor = (d: string) => {
    return d === 'easy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
           d === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
           'bg-red-500/10 text-red-400 border-red-500/30';
  };

  const getErrorTypeColor = (e: string) => {
    return e === 'conceptual' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
           e === 'calculation' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
           e === 'careless' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
           'bg-slate-500/10 text-slate-400 border-slate-500/30';
  };

  const getStatusColor = (s: string) => {
    return s === 'new' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
           s === 'reviewing' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
           'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  };

  const imageAssets = mistake.assets.filter((a) => a.kind === 'image');
  const allImageUrls = imageAssets.map((a) => a.url);

  return (
    <div className="w-full">
      <style>{mathStyles}</style>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div
          className={
            "mb-6 sm:mb-8 rounded-2xl sm:rounded-3xl border bg-gradient-to-br from-slate-900/90 to-slate-800/50 backdrop-blur p-4 sm:p-6 lg:p-8 shadow-2xl " +
            (highlightHeader
              ? "border-red-400 shadow-[0_0_40px_rgba(248,113,113,0.45)] animate-pulse"
              : "border-slate-800")
          }
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 shadow-lg shadow-red-500/25">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-100 leading-tight">{mistake.title}</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getDifficultyColor(mistake.difficulty)}`}>
                      {mistake.difficulty}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getErrorTypeColor(mistake.errorType)}`}>
                      {mistake.errorType}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(mistake.status)}`}>
                      {mistake.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-400 ml-0 sm:ml-14">
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  {mistake.subject.name}
                </span>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {mistake.chapter.title}
                </span>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {new Date(mistake.createdAt).toLocaleDateString('en-US', { 
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
            <div className="flex sm:flex-col gap-2 sm:gap-2">
              <button onClick={expandAll} className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs sm:text-sm font-medium hover:bg-red-500/20 transition-colors">
                Expand All
              </button>
              <button onClick={collapseAll} className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl bg-slate-700/50 border border-slate-600 text-slate-300 text-xs sm:text-sm font-medium hover:bg-slate-700 transition-colors">
                Collapse All
              </button>
            </div>
          </div>
          {onToggleBookmark && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={onToggleBookmark}
                className={`inline-flex items-center gap-1 px-3 sm:px-4 py-1.5 rounded-lg sm:rounded-xl border text-xs sm:text-xs font-medium transition-all ${
                  isBookmarked
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.35)]'
                    : 'bg-slate-900/80 border-slate-700 text-slate-200 hover:bg-slate-800/80'
                }`}
                title={isBookmarked ? 'Remove bookmark' : 'Bookmark mistake'}
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
            </div>
          )}
        </div>

        {/* Image Gallery */}
        {imageAssets.length > 0 && (
          <div className="mb-6 sm:mb-8 rounded-xl sm:rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-800/30 backdrop-blur p-4 sm:p-6 shadow-xl">
            <h3 className="text-base sm:text-lg font-semibold text-slate-100 mb-3 sm:mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Uploaded Images ({imageAssets.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {imageAssets.map((asset, index) => (
                <div key={asset.id} className="group relative rounded-lg sm:rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500 transition-all cursor-pointer"
                  onClick={() => onImageClick?.(asset.url, index, allImageUrls)}>
                  <img src={asset.url} alt={asset.caption || `Image ${index + 1}`} className="w-full h-32 sm:h-48 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                    <div className="p-3 w-full">
                      <p className="text-white text-sm font-medium">{asset.caption || `Image ${index + 1}`}</p>
                      <p className="text-slate-400 text-xs mt-1">Click to view fullscreen</p>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/60 text-white text-xs font-bold">{index + 1}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Diagram (optional) */}
        {mistake.aiDiagram && (
          <div className="mb-4 rounded-xl border border-purple-500/20 bg-purple-500/5 overflow-hidden">
            <div className="px-4 pt-4">
              <h3 className="text-sm font-medium text-purple-300 mb-2">AI Diagram</h3>
              <JeeDiagram diagram={mistake.aiDiagram as any} />
            </div>
          </div>
        )}

        {/* AI Summary */}
        {mistake.aiSummary && (
          <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 overflow-hidden">
            <button onClick={() => toggleSection('summary')} className="w-full px-4 py-3 flex items-center justify-between hover:bg-cyan-500/10 transition-colors">
              <span className="flex items-center gap-2 text-cyan-400 font-medium">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                AI Summary & Analysis
              </span>
              <svg className={`w-5 h-5 text-cyan-400 transition-transform ${expandedSections.has('summary') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.has('summary') && (
              <div className="px-4 pb-4">
                <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} className="prose prose-invert max-w-none text-slate-300 leading-relaxed">
                  {ensureMathDelimiters(mistake.aiSummary)}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Description/Analysis */}
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
          <button onClick={() => toggleSection('description')} className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-500/10 transition-colors">
            <span className="flex items-center gap-2 text-red-400 font-medium">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Detailed Analysis
            </span>
            <svg className={`w-5 h-5 text-red-400 transition-transform ${expandedSections.has('description') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.has('description') && (
            <div className="px-4 pb-4">
              <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} className="prose prose-invert max-w-none text-slate-300 leading-relaxed">
                {ensureMathDelimiters(mistake.description)}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Practice Shortcut */}
        <div className="mt-6 sm:mt-8 glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-800/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Practice & Learn
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Use AI mentor to practice similar problems or create a quiz from this mistake
              </p>
            </div>
            <a href="/quiz-history" className="w-full sm:w-auto px-4 py-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-primary/20 to-purple-500/20 border border-primary/30 text-primary font-medium hover:from-primary/30 hover:to-purple-500/30 transition-all flex items-center justify-center gap-2 text-sm">
              View Quiz History
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm">
            Ask the AI mentor (sidebar) to generate practice problems or create a quiz targeting this mistake type!
          </p>
        </div>
      </div>
    </div>
  );
};
