import { authRouter } from "./routers/auth";
import { formulasRouter } from "./routers/formulas";
import { mistakesRouter } from "./routers/mistakes";
import { studyRouter } from "./routers/study";
import { subjectsRouter } from "./routers/subjects";
import { router } from "./trpc";

export const appRouter = router({
  auth: authRouter,
  subjects: subjectsRouter,
  formulas: formulasRouter,
  mistakes: mistakesRouter,
  study: studyRouter,
});

export type AppRouter = typeof appRouter;