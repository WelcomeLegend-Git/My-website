import { authRouter } from "./routers/auth";
import { formulasRouter } from "./routers/formulas";
import { mistakesRouter } from "./routers/mistakes";
import { studyRouter } from "./routers/study";
import { subjectsRouter } from "./routers/subjects";
import { quizRouter } from "./routers/quiz";
import { router } from "./trpc";

export const appRouter = router({
  authApi: authRouter,
  subjects: subjectsRouter,
  formulas: formulasRouter,
  mistakes: mistakesRouter,
  studyApi: studyRouter,
  quiz: quizRouter,
});

export type AppRouter = typeof appRouter;