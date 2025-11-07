import { initTRPC } from "@trpc/server";
import superjson from "superjson";

export const buildTrpc = <TContext extends object>() => {
  const t = initTRPC.context<TContext>().create({
    transformer: superjson,
  });

  return {
    router: t.router,
    procedure: t.procedure,
    middleware: t.middleware,
    mergeRouters: t.mergeRouters,
  };
};