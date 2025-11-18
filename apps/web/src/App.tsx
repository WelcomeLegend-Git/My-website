import { Route, Routes } from "react-router-dom";

import { ShellLayout } from "./app/layouts/ShellLayout";
import { ProtectedRoute } from "./app/routes/ProtectedRoute";
import { PublicRoute } from "./app/routes/PublicRoute";
import { useRegisterPwa } from "./hooks/useRegisterPwa";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { FormulaCollectionPage } from "./pages/formulas/FormulaCollectionPage";
import { FormulaCollectionsListPage } from "./pages/formulas/FormulaCollectionsListPage";
import { MistakeLogPage } from "./pages/mistakes/MistakeLogPage";
import { MistakeDetailPage } from "./pages/mistakes/MistakeDetailPage";
import { StudyCoachPage } from "./pages/study-coach/StudyCoachPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { QuizHistoryPage } from "./pages/quiz/QuizHistoryPage";
import { QuizPage } from "./pages/quiz/QuizPage";
import { QuizResultsPage } from "./pages/quiz/QuizResultsPage";
import { SettingsPage } from "./pages/settings/SettingsPage";

const App = () => {
  useRegisterPwa();

  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<ShellLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="formulas" element={<FormulaCollectionsListPage />} />
          <Route path="formulas/collections/:id" element={<FormulaCollectionPage />} />
          <Route path="quiz/:id" element={<QuizPage />} />
          <Route path="quiz/:id/results" element={<QuizResultsPage />} />
          <Route path="mistakes" element={<MistakeLogPage />} />
          <Route path="mistakes/:id" element={<MistakeDetailPage />} />
          <Route path="quiz-history" element={<QuizHistoryPage />} />
          <Route path="study-coach" element={<StudyCoachPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default App;