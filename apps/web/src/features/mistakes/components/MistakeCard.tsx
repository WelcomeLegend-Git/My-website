import type { RouterOutputs } from "../../../types/trpc";

type Mistake = RouterOutputs["mistakes"]["list"][number];

type Props = {
  mistake: Mistake;
  isActive: boolean;
  onSelect: (mistake: Mistake) => void;
  onEdit: (mistake: Mistake) => void;
  onDelete: (mistake: Mistake) => void;
  onTransition: (mistake: Mistake, status: Mistake["status"]) => void;
  onImageClick?: (images: Mistake["assets"], index: number) => void;
  onViewDetails?: (mistake: Mistake) => void;
};

const difficultyBadge: Record<Mistake["difficulty"], string> = {
  easy: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  medium: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  hard: "text-rose-300 border-rose-500/40 bg-rose-500/10",
};

const statusBadge: Record<Mistake["status"], string> = {
  new: "text-red-300 border-red-500/40 bg-red-500/10",
  reviewing: "text-blue-300 border-blue-500/40 bg-blue-500/10",
  resolved: "text-green-300 border-green-500/40 bg-green-500/10",
};

const errorTypeBadge: Record<Mistake["errorType"], string> = {
  conceptual: "text-purple-300",
  calculation: "text-orange-300",
  careless: "text-yellow-300",
  unknown: "text-gray-300",
};

export const MistakeCard = ({ mistake, isActive, onSelect, onEdit, onDelete, onTransition, onImageClick, onViewDetails }: Props) => {
  const nextStatus = mistake.status === "new" ? "reviewing" : mistake.status === "reviewing" ? "resolved" : null;

  return (
    <div
      className={`rounded-2xl border px-4 py-4 transition-colors ${
        isActive
          ? "border-primary/80 bg-primary/10"
          : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60"
      }`}
    >
      <button type="button" onClick={() => onSelect(mistake)} className="w-full text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {mistake.subject.name} • {mistake.chapter.title}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${difficultyBadge[mistake.difficulty]}`}>
                {mistake.difficulty}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadge[mistake.status]}`}>
                {mistake.status}
              </span>
            </div>
            <h3 className="mt-2 text-lg font-semibold text-slate-100">{mistake.title}</h3>
            <p className="mt-2 line-clamp-2 text-sm text-slate-400">{mistake.description}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-xs ${errorTypeBadge[mistake.errorType]}`}>
                {mistake.errorType}
              </span>
              {mistake.assets.length > 0 && (
                <span className="text-xs text-slate-500">• {mistake.assets.length} attachment{mistake.assets.length !== 1 ? "s" : ""}</span>
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Image Preview Section */}
      {mistake.assets && mistake.assets.length > 0 && onImageClick && (
        <div className="mt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onImageClick(mistake.assets, 0);
            }}
            className="relative group overflow-hidden rounded-lg border border-slate-800 hover:border-primary/50 transition-all w-full"
          >
            <img
              src={mistake.assets[0].url}
              alt="Mistake preview"
              className="w-full h-32 object-cover"
            />
            {mistake.assets.length > 1 && (
              <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 backdrop-blur-sm rounded-md text-xs font-medium text-white">
                +{mistake.assets.length - 1} more
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <svg className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </div>
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-slate-800 pt-3">
        {onViewDetails && (
          <button
            type="button"
            onClick={() => onViewDetails(mistake)}
            className="rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:from-blue-500/30 hover:to-purple-500/30 transition-all"
          >
            View Details
          </button>
        )}
        <button
          type="button"
          onClick={() => onEdit(mistake)}
          className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
        >
          Edit
        </button>
        {nextStatus && (
          <button
            type="button"
            onClick={() => onTransition(mistake, nextStatus)}
            className="rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/30"
          >
            Mark {nextStatus}
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(mistake)}
          className="ml-auto rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/40"
        >
          Delete
        </button>
      </div>
    </div>
  );
};
