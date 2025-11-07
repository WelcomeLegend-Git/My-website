import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../../app/providers/AuthProvider";
import { trpc } from "../../lib/trpc";

const loginSchema = z.object({
  email: z.string().email({ message: "Enter a valid email" }),
  password: z.string().min(8, "Minimum 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

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
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    setFocus("email");
  }, [setFocus]);

  const mutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      handleAuth(data);
      navigate(from, { replace: true });
    },
  });

  const onSubmit = (values: LoginForm) => {
    mutation.mutate(values);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <div className="w-full max-w-md space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">JEE Companion</p>
          <h1 className="text-3xl font-semibold">Welcome back</h1>
          <p className="text-sm text-slate-400">Log in to continue your mastery streak.</p>
        </header>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-slate-200">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none"
            />
            {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-slate-200">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none"
            />
            {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
          </div>
          {mutation.error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              {mutation.error.message ?? "Invalid credentials"}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="text-center text-sm text-slate-400">
          No account yet?{" "}
          <Link to="/auth/register" className="text-primary hover:underline">
            Create one now
          </Link>
        </p>
        {status === "authenticated" && (
          <button
            type="button"
            onClick={() => navigate(from, { replace: true })}
            className="w-full text-sm text-slate-400 underline"
          >
            Continue to app
          </button>
        )}
      </div>
    </div>
  );
};