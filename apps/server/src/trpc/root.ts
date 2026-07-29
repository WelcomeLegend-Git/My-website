import { authRouter } from "./routers/auth";
import { backupRouter } from "./routers/backup";
import { formulasRouter } from "./routers/formulas";
import { mistakesRouter } from "./routers/mistakes";
import { studyRouter } from "./routers/study";
import { subjectsRouter } from "./routers/subjects";
import { quizRouter } from "./routers/quiz";
import { bookmarksRouter } from "./routers/bookmarks";
import { chatRouter } from "./routers/chat";
import { router } from "./trpc";

export const appRouter = router({
  authApi: authRouter,
  backupApi: backupRouter,
  subjects: subjectsRouter,
  formulas: formulasRouter,
  mistakes: mistakesRouter,
  studyApi: studyRouter,
  quiz: quizRouter,
  bookmarks: bookmarksRouter,
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;