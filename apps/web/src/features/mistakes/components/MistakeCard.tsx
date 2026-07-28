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
  easy: "text-brass border-brass/30 bg-brass-soft",
  medium: "text-brass border-brass/30 bg-brass-soft",
  hard: "text-red-500 border-red-500/30 bg-red-500/10",
};

const statusBadge: Record<Mistake["status"], string> = {
  new: "text-red-500 border-red-500/30 bg-red-500/10",
  reviewing: "text-brass border-brass/30 bg-brass-soft",
  resolved: "text-signal border-signal/30 bg-signal/10",
};

const errorTypeBadge: Record<Mistake["errorType"], string> = {
  conceptual: "text-brass",
  calculation: "text-brass",
  careless: "text-brass",
  unknown: "text-ink-muted",
};

export const MistakeCard = ({ mistake, isActive, onSelect, onEdit, onDelete, onTransition, onImageClick, onViewDetails }: Props) => {
  const nextStatus = mistake.status === "new" ? "reviewing" : mistake.status === "reviewing" ? "resolved" : null;

  return (
    <div
      className={`rounded-2xl border px-4 py-4 transition-colors ${
        isActive
          ? "border-brass/80 bg-brass-soft"
          : "border-line bg-surface hover:border-line hover:bg-surface-2"
      }`}
    >
      <button type="button" onClick={() => onSelect(mistake)} className="w-full text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase font-mono tracking-wide text-ink-muted">
                {mistake.subject.name} • {mistake.chapter.title}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${difficultyBadge[mistake.difficulty]}`}>
                {mistake.difficulty}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadge[mistake.status]}`}>
                {mistake.status}
              </span>
            </div>
            <h3 className="mt-2 text-lg font-semibold text-ink">{mistake.title}</h3>
            <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{mistake.description}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-xs ${errorTypeBadge[mistake.errorType]}`}>
                {mistake.errorType}
              </span>
              {mistake.assets.length > 0 && (
                <span className="text-xs text-ink-muted">• {mistake.assets.length} attachment{mistake.assets.length !== 1 ? "s" : ""}</span>
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
            className="relative group overflow-hidden rounded-lg border border-line hover:border-brass/40 transition-all w-full"
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

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        {onViewDetails && (
          <button
            type="button"
            onClick={() => onViewDetails(mistake)}
            className="rounded-lg bg-brass-soft border border-brass/30 px-3 py-1.5 text-xs font-semibold text-brass hover:bg-brass-soft/80 transition-all"
          >
            View Details
          </button>
        )}
        <button
          type="button"
          onClick={() => onEdit(mistake)}
          className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface"
        >
          Edit
        </button>
        {nextStatus && (
          <button
            type="button"
            onClick={() => onTransition(mistake, nextStatus)}
            className="rounded-lg bg-brass-soft px-3 py-1.5 text-xs font-medium text-brass hover:bg-brass/20"
          >
            Mark {nextStatus}
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(mistake)}
          className="ml-auto rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20"
        >
          Delete
        </button>
      </div>
    </div>
  );
};
