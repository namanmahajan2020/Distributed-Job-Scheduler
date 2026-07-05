import { Navigate } from "react-router-dom";
import { PropsWithChildren } from "react";
import { useAuth } from "../lib/auth";

export const RequireAuth = ({ children }: PropsWithChildren) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};
