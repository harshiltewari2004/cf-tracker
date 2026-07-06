import axios, { AxiosError } from "axios";

import { useAuthStore } from "@/stores/authStore";

const EXPECTED_401_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",
];

const LOGIN_ROUTE = "/login";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // config.url stays relative when baseURL is set — includes() is effectively exact here.
    // If a full URL is ever passed to apiClient directly, this check changes meaning.
    const requestPath = error.config?.url ?? "";
    const isExpected401 = EXPECTED_401_PATHS.some((p) =>
      requestPath.includes(p),
    );

    if (error.response?.status === 401 && !isExpected401) {
      useAuthStore.getState().clearAuth();

      if (window.location.pathname != LOGIN_ROUTE) {
        window.location.href = LOGIN_ROUTE;
      }
    }
    return Promise.reject(error);
  },
);
