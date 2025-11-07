import { Route, Routes } from "react-router-dom";

import { ShellLayout } from "./app/layouts/ShellLayout";
import { ProtectedRoute } from "./app/routes/ProtectedRoute";
import { PublicRoute } from "./app/routes/PublicRoute";
import { useRegisterPwa } from "./hooks/useRegisterPwa";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { FormulaLibraryPage } from "./pages/formulas/FormulaLibraryPage";
import { MistakeLogPage } from "./pages/mistakes/MistakeLogPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { StudyCoachPage } from "./pages/study/StudyCoachPage";

const App = () => {
  useRegisterPwa();

  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<ShellLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="formulas" element={<FormulaLibraryPage />} />
          <Route path="mistakes" element={<MistakeLogPage />} />
          <Route path="study" element={<StudyCoachPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default App;