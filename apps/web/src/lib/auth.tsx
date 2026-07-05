import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "./api";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: any | null;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [accessToken, setAccessToken] = useState<string | null>(tokenStore.getAccessToken());
  const [refreshToken, setRefreshToken] = useState<string | null>(tokenStore.getRefreshToken());
  const [user, setUser] = useState<any | null>(null);

  const syncUser = async () => {
    const response = await api.get("/auth/me");
    setUser(response.data);
  };

  useEffect(() => {
    if (accessToken) {
      void syncUser().catch(() => {
        tokenStore.clear();
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
      });
    }
  }, [accessToken]);

  const login = async (nextAccessToken: string, nextRefreshToken: string) => {
    tokenStore.setTokens(nextAccessToken, nextRefreshToken);
    setAccessToken(nextAccessToken);
    setRefreshToken(nextRefreshToken);
    await syncUser();
  };

  const logout = async () => {
    if (refreshToken) {
      await api.post("/auth/logout", { refreshToken }).catch(() => undefined);
    }
    tokenStore.clear();
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ accessToken, refreshToken, user, login, logout, isAuthenticated: Boolean(accessToken) }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
};
