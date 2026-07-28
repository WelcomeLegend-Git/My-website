import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

export const ProtectedRoute = () => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-ink">
        <div className="animate-spin rounded-full border-4 border-line border-t-brass h-12 w-12" aria-label="Loading" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};