import { useState } from "react";
import { trpc } from "../../../lib/trpc";

type Props = {
  onVerified: () => void;
  onClose?: () => void;
};

export const AiAccessModal = ({ onVerified, onClose }: Props) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const verifyMutation = trpc.studyApi.verifyAiAccess.useMutation({
    onSuccess: () => {
      // Store verification in localStorage
      localStorage.setItem("ai_access_verified", "true");
      onVerified();
    },
    onError: (err: { message: string }) => {
      setError(err.message);
      setCode("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Please enter the access code");
      return;
    }
    setError("");
    verifyMutation.mutate({ code: code.trim() });
  };

  const handleRequestAccess = () => {
    // Show a friendly message with contact info
    alert(
      "To get access to the AI Mentor:\n\n" +
      "1. Contact Suraj and request an access code\n" +
      "2. Once you receive the code, enter it below\n\n" +
      "This helps protect the AI API from unauthorized usage. Thanks for understanding!"
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 fade-in" onClick={onClose}>
      <div className="glass-card rounded-2xl border border-line max-w-md w-full p-8 stagger-item shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 rounded-lg p-2 text-ink-muted hover:bg-surface-2 hover:text-ink transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-brass-soft flex items-center justify-center">
            <svg className="w-8 h-8 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-ink text-center mb-2 font-display">
          AI Mentor Access
        </h2>
        <p className="text-ink-muted text-sm text-center mb-6">
          Enter the access code to unlock AI-powered study assistance
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="access-code" className="block text-sm font-medium text-ink-muted mb-2">
              Access Code
            </label>
            <input
              id="access-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={verifyMutation.isPending}
              className="w-full px-4 py-3 rounded-xl border border-line bg-surface text-ink placeholder-slate-500 focus:border-line focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter your code"
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 fade-in">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-500">{error}</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={verifyMutation.isPending}
            className="w-full rounded-xl bg-brass px-6 py-3 text-sm font-semibold text-white hover:bg-brass-strong disabled:cursor-not-allowed disabled:opacity-70 transition-all duration-300 hover-lift disabled:hover:transform-none flex items-center justify-center gap-2"
          >
            {verifyMutation.isPending ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Verify Access
              </>
            )}
          </button>
        </form>

        {/* Request Access */}
        <div className="mt-6 pt-6 border-t border-line">
          <p className="text-xs text-ink-muted text-center mb-3">
            Don't have an access code?
          </p>
          <button
            type="button"
            onClick={handleRequestAccess}
            className="w-full rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-2 hover:border-line transition-all duration-200"
          >
            Request Access
          </button>
        </div>

        {/* Info */}
        <div className="mt-6 rounded-xl bg-surface-2 border border-line p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-brass flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-ink-muted leading-relaxed">
              This verification protects the AI API from unauthorized usage. You only need to verify once per device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
