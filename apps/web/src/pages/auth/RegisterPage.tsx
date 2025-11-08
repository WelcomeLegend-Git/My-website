import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../../app/providers/AuthProvider";
import { trpc } from "../../lib/trpc";

const registerSchema = z
  .object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email({ message: "Provide a valid email" }),
    password: z.string().min(8, "Minimum 8 characters"),
    confirmPassword: z.string().min(8, "Minimum 8 characters"),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

type RegisterForm = z.infer<typeof registerSchema>;

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { handleAuth } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    setFocus("name");
  }, [setFocus]);

  const mutation = trpc.auth.register.useMutation();

  useEffect(() => {
    if (mutation.isSuccess && mutation.data) {
      handleAuth(mutation.data);
      navigate("/", { replace: true });
    }
  }, [mutation.isSuccess, mutation.data, handleAuth, navigate]);

  const onSubmit = (values: RegisterForm) => {
    mutation.mutate({ name: values.name, email: values.email, password: values.password });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <div className="w-full max-w-md space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">JEE Companion</p>
          <h1 className="text-3xl font-semibold">Create your account</h1>
          <p className="text-sm text-slate-400">Start centralising formulas, mistakes, and AI support.</p>
        </header>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-slate-200">
              Full name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              {...register("name")}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none"
            />
            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
          </div>
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
              autoComplete="new-password"
              {...register("password")}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none"
            />
            {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-200">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none"
            />
            {errors.confirmPassword && <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>}
          </div>
          {mutation.error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              {mutation.error.message ?? "Unable to create account"}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Creating..." : "Create account"}
          </button>
        </form>
        <p className="text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link to="/auth/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};