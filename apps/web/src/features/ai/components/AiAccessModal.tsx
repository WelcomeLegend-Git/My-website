import { useState } from "react";
import { trpc } from "../../../lib/trpc";

type Props = {
  onVerified: () => void;
};

export const AiAccessModal = ({ onVerified }: Props) => {
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 fade-in">
      <div className="glass-card rounded-2xl border border-slate-700 max-w-md w-full p-8 stagger-item shadow-2xl">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-slate-100 text-center mb-2">
          AI Mentor Access
        </h2>
        <p className="text-slate-400 text-sm text-center mb-6">
          Enter the access code to unlock AI-powered study assistance
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="access-code" className="block text-sm font-medium text-slate-300 mb-2">
              Access Code
            </label>
            <input
              id="access-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={verifyMutation.isPending}
              className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-900/50 text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter your code"
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 fade-in">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-300">{error}</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={verifyMutation.isPending}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-70 transition-all duration-300 hover-lift disabled:hover:transform-none flex items-center justify-center gap-2"
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
        <div className="mt-6 pt-6 border-t border-slate-700">
          <p className="text-xs text-slate-400 text-center mb-3">
            Don't have an access code?
          </p>
          <button
            type="button"
            onClick={handleRequestAccess}
            className="w-full rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/50 hover:border-slate-600 transition-all duration-200"
          >
            Request Access
          </button>
        </div>

        {/* Info */}
        <div className="mt-6 rounded-xl bg-slate-800/30 border border-slate-700/50 p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-slate-400 leading-relaxed">
              This verification protects the AI API from unauthorized usage. You only need to verify once per device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
