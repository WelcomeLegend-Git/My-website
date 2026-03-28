import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    // In production, hide internal error details (like DB connection strings)
    const isInternalError =
      error.code === "INTERNAL_SERVER_ERROR" &&
      !(error.cause instanceof TRPCError);

    return {
      ...shape,
      message: isInternalError
        ? "Service temporarily unavailable. Please try again."
        : shape.message,
      data: {
        ...shape.data,
        // Strip the stack trace in production
        stack: process.env.NODE_ENV === "production" ? undefined : shape.data.stack,
      },
    };
  },
});

export const router = t.router;
export const procedure = t.procedure;
export const middleware = t.middleware;