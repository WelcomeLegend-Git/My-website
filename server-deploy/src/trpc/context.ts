import type { inferAsyncReturnType } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

import { prisma } from "../prisma";
import { geminiClient, type IGeminiClient } from "../services/ai/gemini-client";

export const createContext = async ({ req, res }: CreateExpressContextOptions) => {
  const user = (req as typeof req & { user?: { id: string; email: string } }).user;

  return {
    req,
    res,
    prisma,
    gemini: geminiClient as IGeminiClient,
    user,
  };
};

export type Context = inferAsyncReturnType<typeof createContext>;