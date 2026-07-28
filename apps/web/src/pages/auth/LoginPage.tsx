import { useGoogleLogin } from "@react-oauth/google";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../../app/providers/AuthProvider";
import { trpc } from "../../lib/trpc";
import { authStorage } from "../../lib/auth-storage";

const loginSchema = z.object({
  email: z.string().email({ message: "Enter a valid email" }),
  password: z.string().min(8, "Minimum 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

// Standalone Google Sign-In button — fully custom styled
const GoogleSignInButton = ({
  onSuccess,
  loading,
  label = "Continue with Google",
}: {
  onSuccess: (accessToken: string) => void;
  loading: boolean;
  label?: string;
}) => {
  const [googleLoading, setGoogleLoading] = useState(false);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      onSuccess(tokenResponse.access_token);
      setGoogleLoading(false);
    },
    onError: () => setGoogleLoading(false),
    onNonOAuthError: () => setGoogleLoading(false),
  });

  return (
    <button
      type="button"
      disabled={loading || googleLoading}
      onClick={() => {
        setGoogleLoading(true);
        login();
      }}
      className="w-full flex items-center justify-center gap-3 rounded-xl border border-line bg-surface-2 px-5 py-3.5 text-sm font-semibold text-ink hover:bg-surface hover:border-brass/40 disabled:cursor-not-allowed disabled:opacity-60 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
    >
      {googleLoading ? (
        <svg className="w-5 h-5 animate-spin text-ink-muted" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        /* Google logo SVG */
        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )}
      <span className="flex-1 text-center leading-none">{label}</span>
    </button>
  );
};

export const LoginPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { handleAuth, status } = useAuth();
  const from = (location.state as { from?: { pathname?: string } } | undefined)?.from?.pathname ?? "/";

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => { setFocus("email"); }, [setFocus]);

  const mutation = trpc.authApi.login.useMutation();
  const googleMutation = trpc.authApi.googleLogin.useMutation();

  useEffect(() => {
    if (mutation.isSuccess && mutation.data) {
      handleAuth(mutation.data);
      navigate(from, { replace: true });
    }
  }, [mutation.isSuccess, mutation.data, handleAuth, navigate, from]);

  useEffect(() => {
    if (googleMutation.isSuccess && googleMutation.data) {
      handleAuth(googleMutation.data);
      navigate(from, { replace: true });
    }
  }, [googleMutation.isSuccess, googleMutation.data, handleAuth, navigate, from]);

  const onSubmit = (values: LoginForm) => mutation.mutate(values);
  const activeError = mutation.error || googleMutation.error;
  const isLoading = mutation.isPending || googleMutation.isPending;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-paper px-4 py-8 sm:px-6 sm:py-12 text-ink overflow-hidden">
      <div className="relative w-full max-w-sm sm:max-w-md space-y-6 sm:space-y-8 scale-in">
        {/* Header */}
        <header className="space-y-3 sm:space-y-4 text-center fade-in-down">
          <div className="inline-flex items-center justify-center">
            <div className="px-5 py-2.5 sm:px-6 sm:py-3 bg-surface border border-line rounded-2xl">
              <p className="text-xs uppercase tracking-[0.3em] text-brass font-mono font-bold">JEE Companion</p>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-ink font-display">
            Welcome back
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted max-w-xs sm:max-w-sm mx-auto px-2">
            Log in to continue your mastery streak and access your personalized study dashboard.
          </p>
        </header>

        {/* Form Card */}
        <div className="relative">
          <div className="relative space-y-4 sm:space-y-5 rounded-2xl bg-surface border border-line p-5 sm:p-8 shadow-sm fade-in-up">

            {/* Google Button */}
            <GoogleSignInButton
              label="Continue with Google"
              loading={isLoading}
              onSuccess={(accessToken) => googleMutation.mutate({ accessToken })}
            />

            {/* Divider */}
            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-line" />
              <span className="text-xs text-ink-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap">or sign in with email</span>
              <div className="flex-1 border-t border-line" />
            </div>

            {/* Email */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-semibold text-ink flex items-center gap-2">
                  <svg className="w-4 h-4 text-brass flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register("email")}
                  className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink placeholder-ink-muted focus:border-brass/50 focus:outline-none focus:ring-2 focus:ring-brass/20 transition-all"
                  placeholder="your.email@example.com"
                />
                {errors.email && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-semibold text-ink flex items-center gap-2">
                  <svg className="w-4 h-4 text-brass flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register("password")}
                  className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink placeholder-ink-muted focus:border-brass/50 focus:outline-none focus:ring-2 focus:ring-brass/20 transition-all"
                  placeholder="Enter your password"
                />
                {errors.password && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.password.message}
                  </p>
                )}
                <div className="flex justify-end pt-0.5">
                  <Link to="/auth/forgot-password" className="text-xs text-brass hover:text-brass-strong font-medium transition-colors">
                    Forgot password?
                  </Link>
                </div>
              </div>

              {/* Error */}
              {activeError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 sm:p-4 flex items-start gap-3 fade-in">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs sm:text-sm text-red-600">{activeError.message ?? "Invalid credentials"}</p>
                </div>
              )}

              {/* Sign In */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-brass hover:bg-brass-strong px-5 py-3 sm:py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70 transition-all duration-300 hover-lift disabled:hover:transform-none flex items-center justify-center gap-2"
              >
                {mutation.isPending ? (
                  <>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  <>Sign in &rarr;</>
                )}
              </button>

              {/* Guest */}
              <div className="relative flex items-center gap-3">
                <div className="flex-1 border-t border-line" />
                <span className="text-xs text-ink-muted font-medium uppercase tracking-wider">or</span>
                <div className="flex-1 border-t border-line" />
              </div>

              <button
                type="button"
                onClick={() => { authStorage.setGuestMode(); navigate(from, { replace: true }); }}
                className="w-full rounded-xl border border-line bg-surface px-5 py-3 sm:py-3.5 text-sm font-semibold text-ink hover:bg-surface-2 hover:border-brass/40 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Continue as Guest
              </button>

              <p className="text-xs text-ink-muted text-center">
                Guest mode: Your data will be cleared when you close the browser
              </p>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-2 fade-in">
          <p className="text-sm text-ink-muted">
            No account yet?{" "}
            <Link to="/auth/register" className="text-brass hover:text-brass-strong font-semibold transition-colors">
              Create one now
            </Link>
          </p>
          {status === "authenticated" && (
            <button
              type="button"
              onClick={() => navigate(from, { replace: true })}
              className="text-sm text-ink-muted hover:text-ink underline transition-colors"
            >
              Continue to app →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};