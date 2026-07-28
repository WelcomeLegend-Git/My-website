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
  easy: "text-signal border-signal/40 bg-signal/10",
  medium: "text-brass border-brass/40 bg-brass-soft",
  hard: "text-red-500 border-red-500/40 bg-red-500/10",
};

export const FormulaCard = ({ formula, isActive, onSelect, onEdit, onDelete }: Props) => {
  return (
    <button
      type="button"
      onClick={() => onSelect(formula)}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
        isActive
          ? "border-brass/80 bg-brass-soft"
          : "border-line bg-surface-2 hover:border-brass/40 hover:bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] font-mono text-ink-muted">
              {formula.subject.name} • {formula.chapter.title}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-mono font-semibold ${difficultyBadge[formula.difficulty]}`}>
              {formula.difficulty}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-semibold font-display text-ink">{formula.title}</h3>
          <p className="mt-2 text-sm font-mono text-ink">{formula.expression}</p>
          {formula.tags?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {formula.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-mono uppercase tracking-wide text-ink-muted">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2 text-xs font-mono text-ink-muted">
          <span>{new Date(formula.updatedAt).toLocaleDateString()}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(formula);
              }}
              className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink hover:border-brass hover:text-brass"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(formula);
              }}
              className="rounded-full border border-line px-3 py-1 text-xs font-medium text-red-500 hover:border-red-500 hover:text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </button>
  );
};