import type { AppRouter } from "@jee/server/trpc/root";
import type { inferRouterOutputs } from "@trpc/server";

export type RouterOutputs = inferRouterOutputs<AppRouter>;