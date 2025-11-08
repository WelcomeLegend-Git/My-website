import type { RouterOutputs } from "../../../types/trpc";

type Mistake = RouterOutputs["mistakes"]["list"][number];

type Props = {
  mistake: Mistake;
  isActive: boolean;
  onSelect: (mistake: Mistake) => void;
  onEdit: (mistake: Mistake) => void;
  onDelete: (mistake: Mistake) => void;
  onTransition: (mistake: Mistake, status: Mistake["status"]) => void;
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

export const MistakeCard = ({ mistake, isActive, onSelect, onEdit, onDelete, onTransition }: Props) => {
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

      <div className="mt-3 flex items-center gap-2 border-t border-slate-800 pt-3">
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
