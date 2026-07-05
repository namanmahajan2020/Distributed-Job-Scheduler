import axios from "axios";

const TOKEN_KEY = "scheduler_access_token";
const REFRESH_KEY = "scheduler_refresh_token";

export const api = axios.create({
  baseURL: "http://localhost:4000/api"
});

export const tokenStore = {
  getAccessToken: () => localStorage.getItem(TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
};

api.interceptors.request.use((config) => {
  const accessToken = tokenStore.getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status !== 401 || error.config?._retry) {
      return Promise.reject(error);
    }

    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken) {
      tokenStore.clear();
      return Promise.reject(error);
    }

    error.config._retry = true;
    const refreshResponse = await axios.post("http://localhost:4000/api/auth/refresh", { refreshToken });
    tokenStore.setTokens(refreshResponse.data.accessToken, refreshResponse.data.refreshToken);
    error.config.headers.Authorization = `Bearer ${refreshResponse.data.accessToken}`;
    return api.request(error.config);
  }
);
