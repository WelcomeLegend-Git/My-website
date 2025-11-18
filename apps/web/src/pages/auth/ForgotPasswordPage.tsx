import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trpc } from "../../lib/trpc";

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const requestMutation = trpc.authApi.requestPasswordReset.useMutation({
    onSuccess: () => {
      setStep("verify");
      setLocalError(null);
    },
  });

  const resetMutation = trpc.authApi.resetPasswordWithOtp.useMutation({
    onSuccess: () => {
      navigate("/auth/login");
    },
  });

  const handleRequest = (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    if (!email.trim()) {
      setLocalError("Please enter your email");
      return;
    }
    requestMutation.mutate({ email: email.trim() });
  };

  const handleVerify = (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    if (!otp.trim() || !newPassword) {
      setLocalError("Enter the code and new password");
      return;
    }
    if (newPassword.length < 8) {
      setLocalError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }
    resetMutation.mutate({
      email: email.trim(),
      otp: otp.trim(),
      newPassword,
    });
  };

  const isRequesting = requestMutation.isPending;
  const isResetting = resetMutation.isPending;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-12 text-slate-100 overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl float" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative w-full max-w-md space-y-8 scale-in">
        <header className="space-y-4 text-center fade-in-down">
          <div className="inline-flex items-center justify-center">
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-r from-primary to-purple-600 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition duration-300" />
              <div className="relative px-6 py-3 glass-card rounded-2xl border border-primary/20">
                <p className="text-xs uppercase tracking-[0.3em] text-primary font-bold">Account Security</p>
              </div>
            </div>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            {step === "request" ? "Forgot your password?" : "Enter reset code"}
          </h1>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            {step === "request"
              ? "We will email you a 6-digit code to reset your password."
              : "Check your email for the 6-digit code and choose a new password."}
          </p>
        </header>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary via-purple-600 to-blue-600 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition duration-500" />
          {step === "request" ? (
            <form onSubmit={handleRequest} className="relative space-y-5 rounded-3xl glass-card border border-slate-800/50 p-8 fade-in-up">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-slate-800/50 glass px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="your.email@example.com"
                />
              </div>

              {(localError || requestMutation.error) && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {localError || requestMutation.error?.message}
                </div>
              )}

              <button
                type="submit"
                disabled={isRequesting}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-purple-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/30 hover:shadow-primary/50 disabled:cursor-not-allowed disabled:opacity-70 transition-all duration-300 hover-lift disabled:hover:transform-none flex items-center justify-center gap-2"
              >
                {isRequesting ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Sending code...
                  </>
                ) : (
                  <>Send reset code</>
                )}
              </button>

              <p className="text-xs text-slate-500 text-center">
                Remembered your password?{" "}
                <Link to="/auth/login" className="text-primary hover:text-purple-400 font-semibold transition-colors">
                  Back to login
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="relative space-y-5 rounded-3xl glass-card border border-slate-800/50 p-8 fade-in-up">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
                  </svg>
                  Code sent to {email}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  className="w-full rounded-xl border border-slate-800/50 glass px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all tracking-[0.3em] text-center"
                  placeholder="6-digit code"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  New password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-800/50 glass px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Min. 8 characters"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Confirm password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-800/50 glass px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Repeat password"
                />
              </div>

              {(localError || resetMutation.error) && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {localError || resetMutation.error?.message}
                </div>
              )}

              <button
                type="submit"
                disabled={isResetting}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-purple-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/30 hover:shadow-primary/50 disabled:cursor-not-allowed disabled:opacity-70 transition-all duration-300 hover-lift disabled:hover:transform-none flex items-center justify-center gap-2"
              >
                {isResetting ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Updating password...
                  </>
                ) : (
                  <>Reset password</>
                )}
              </button>

              <p className="text-xs text-slate-500 text-center">
                Used the wrong email?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setStep("request");
                    setOtp("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setLocalError(null);
                  }}
                  className="text-primary hover:text-purple-400 font-semibold transition-colors"
                >
                  Change email
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
