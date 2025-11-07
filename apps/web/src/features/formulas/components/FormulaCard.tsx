import type { RouterOutputs } from "../../../types/trpc";

type Formula = RouterOutputs["formulas"]["list"][number];

type Props = {
  formula: Formula;
  isActive: boolean;
  onSelect: (formula: Formula) => void;
  onEdit: (formula: Formula) => void;
  onDelete: (formula: Formula) => void;
};

const difficultyBadge: Record<Formula["difficulty"], string> = {
  easy: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  medium: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  hard: "text-rose-300 border-rose-500/40 bg-rose-500/10",
};

export const FormulaCard = ({ formula, isActive, onSelect, onEdit, onDelete }: Props) => {
  return (
    <button
      type="button"
      onClick={() => onSelect(formula)}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
        isActive
          ? "border-primary/80 bg-primary/10"
          : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {formula.subject.name} • {formula.chapter.title}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${difficultyBadge[formula.difficulty]}`}>
              {formula.difficulty}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-slate-100">{formula.title}</h3>
          <p className="mt-2 text-sm font-mono text-slate-300">{formula.expression}</p>
          {formula.tags?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {formula.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-slate-800 bg-slate-900/80 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-400">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2 text-xs text-slate-500">
          <span>{new Date(formula.updatedAt).toLocaleDateString()}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(formula);
              }}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:border-primary hover:text-primary"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(formula);
              }}
              className="rounded-full border border-slate-800 px-3 py-1 text-xs font-medium text-rose-300 hover:border-rose-500 hover:text-rose-400"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </button>
  );
};