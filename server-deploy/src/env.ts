import { config as loadEnv } from "dotenv";
import path from "node:path";
import process from "node:process";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  GEMINI_API_KEYS: z
    .string()
    .min(1, "Provide at least one Gemini API key")
    .transform((value) => value.split(",").map((key) => key.trim()).filter(Boolean)),
  GEMINI_MODEL_PRIMARY: z.string().default("models/gemini-2.0-pro-exp"),
  GEMINI_MODEL_FALLBACK: z
    .string()
    .default("models/gemini-2.0-pro-exp-1121")
    .transform((value) => value.split(",").map((model) => model.trim()).filter(Boolean)),
  UPLOAD_DIR: z
    .string()
    .default(path.join(process.cwd(), "uploads"))
    .transform((dir) => path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir)),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = {
  ...parsed.data,
  GEMINI_FALLBACK_MODELS: parsed.data.GEMINI_MODEL_FALLBACK,
};