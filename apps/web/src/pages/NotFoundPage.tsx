import { Link } from "react-router-dom";

export const NotFoundPage = () => {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full border border-line bg-surface-2 px-4 py-2 text-xs uppercase tracking-[0.3em] font-mono text-ink-muted">
        404
      </div>
      <h2 className="text-3xl font-display font-semibold text-ink">Page not found</h2>
      <p className="text-sm text-ink-muted">
        The page you are looking for has moved or never existed. Let&apos;s head back to the dashboard and continue the flow.
      </p>
      <Link to="/" className="rounded-xl bg-brass px-4 py-2 text-sm font-semibold text-paper hover:bg-brass-strong">
        Go to dashboard
      </Link>
    </div>
  );
};