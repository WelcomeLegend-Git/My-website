import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

export const PublicRoute = () => {
  const { status } = useAuth();

  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};