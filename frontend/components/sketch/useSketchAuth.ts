"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  authUser,
  getMe,
  MeResponse,
  TOKEN_KEY,
} from "@/lib/api";

export type AuthMode = "login" | "register" | null;

const TOKEN_CHANGE_EVENT = "icepunk-token-change";

function normalizeToken(value: string | null) {
  return value && value !== "undefined" && value !== "null" ? value : null;
}

function subscribeToTokenChanges(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(TOKEN_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(TOKEN_CHANGE_EVENT, callback);
  };
}

function getTokenSnapshot() {
  return normalizeToken(localStorage.getItem(TOKEN_KEY));
}

function getServerTokenSnapshot() {
  return null;
}

function notifyTokenChanged() {
  window.dispatchEvent(new Event(TOKEN_CHANGE_EVENT));
}

type UseSketchAuthOptions = {
  setStatus: (message: string) => void;
};

export function useSketchAuth({ setStatus }: UseSketchAuthOptions) {
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [authStatus, setAuthStatus] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [meFetch, setMeFetch] = useState<{
    token: string;
    me: MeResponse;
  } | null>(null);
  const token = useSyncExternalStore(
    subscribeToTokenChanges,
    getTokenSnapshot,
    getServerTokenSnapshot,
  );

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    getMe(token, controller.signal)
      .then((data) => setMeFetch({ token, me: data }))
      .catch(() => {});

    return () => controller.abort();
  }, [token]);

  const saveToken = useCallback((value: string) => {
    localStorage.setItem(TOKEN_KEY, value);
    notifyTokenChanged();
  }, []);

  const clearToken = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    notifyTokenChanged();
  }, []);

  const handleAuth = useCallback(async () => {
    if (!authMode) return;

    try {
      setIsAuthenticating(true);
      setAuthStatus(
        authMode === "login" ? "Logging in..." : "Creating account...",
      );

      const body =
        authMode === "login"
          ? { identifier: email, password }
          : { username, email, password };

      const response = await authUser(authMode, body);

      if (!response.ok) {
        if (response.status === 409) {
          setAuthStatus("Username or email is already taken.");
          return;
        }

        if (response.status === 401) {
          setAuthStatus("Invalid credentials.");
          return;
        }

        if (response.status === 400) {
          setAuthStatus("Check your email, username, and password length.");
          return;
        }

        setAuthStatus("Auth failed. Check your data.");
        return;
      }

      const data = await response.json();
      saveToken(data.token);
      setStatus("You are logged in.");
      setAuthStatus("");
      setAuthMode(null);
      setEmail("");
      setUsername("");
      setPassword("");
    } catch {
      setAuthStatus("Backend is not available right now.");
    } finally {
      setIsAuthenticating(false);
    }
  }, [authMode, email, password, saveToken, setStatus, username]);

  const handleLogout = useCallback(() => {
    clearToken();
    setStatus("You are logged out.");
  }, [clearToken, setStatus]);

  const requireLogin = useCallback(() => {
    setAuthMode("login");
    setAuthStatus("Sign up or log in to keep creating and downloading free of charge!");
  }, []);

  const me = token && meFetch?.token === token ? meFetch.me : null;

  return {
    authMode,
    authStatus,
    clearToken,
    email,
    handleAuth,
    handleLogout,
    isAuthenticating,
    me,
    password,
    requireLogin,
    setAuthMode,
    setAuthStatus,
    setEmail,
    setPassword,
    setUsername,
    token,
    username,
  };
}
