"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useMidiGeneration } from "@/hooks/useMidiGeneration";
import { authUser, getGenerationStats, TOKEN_KEY } from "@/lib/api";

import GenerateButton from "@/components/GenerateButton";
import GenerationCounter from "@/components/GenerationCounter";
import Navbar from "@/components/Navbar";

type AuthMode = "login" | "register" | null;

const TOKEN_CHANGE_EVENT = "icepunk-token-change";

const AuthModal = dynamic(() => import("@/components/AuthModal"), {
  ssr: false,
});

function subscribeToTokenChanges(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(TOKEN_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(TOKEN_CHANGE_EVENT, callback);
  };
}

function normalizeToken(token: string | null) {
  if (!token || token === "undefined" || token === "null") {
    return null;
  }

  return token;
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

function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  notifyTokenChanged();
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  notifyTokenChanged();
}

function useStoredToken() {
  return useSyncExternalStore(
    subscribeToTokenChanges,
    getTokenSnapshot,
    getServerTokenSnapshot,
  );
}

export default function HomeControls() {
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [authStatus, setAuthStatus] = useState("");
  const [totalGenerations, setTotalGenerations] = useState<number | null>(null);
  const [isLoadingGenerations, setIsLoadingGenerations] = useState(true);
  const token = useStoredToken();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { isGenerating, status, setStatus, handleGenerateMidi } =
    useMidiGeneration(clearToken, setTotalGenerations);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 1500);

    async function loadGenerationStats() {
      try {
        const data = await getGenerationStats(controller.signal);

        if (isMounted) {
          setTotalGenerations(data.totalGenerations);
        }
      } catch {
        if (isMounted) {
          setTotalGenerations(null);
        }
      } finally {
        window.clearTimeout(timeoutId);

        if (isMounted) {
          setIsLoadingGenerations(false);
        }
      }
    }

    loadGenerationStats();

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  async function handleAuth() {
    if (!authMode) return;

    try {
      setAuthStatus(
        authMode === "login" ? "Logging in..." : "Creating account...",
      );

      const body =
        authMode === "login"
          ? { email, password }
          : { username, email, password };

      const response = await authUser(authMode, body);

      if (!response.ok) {
        if (response.status === 429) {
          setAuthStatus("Too many attempts. Please try again later.");
          return;
        }

        if (response.status === 409) {
          setAuthStatus("An account with that email or username already exists.");
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

      if (!data.token || typeof data.token !== "string") {
        setAuthStatus("Auth failed. Token was not returned.");
        return;
      }

      saveToken(data.token);
      setStatus("You are logged in.");

      setAuthStatus("");
      setAuthMode(null);

      setEmail("");
      setUsername("");
      setPassword("");
    } catch {
      setAuthStatus("Backend is not available right now.");
    }
  }

  function handleLogout() {
    clearToken();
    setStatus("You are logged out.");
  }

  return (
    <>
      <Navbar
        isLoggedIn={!!token}
        onLoginClick={() => {
          setAuthStatus("");
          setAuthMode("login");
        }}
        onRegisterClick={() => {
          setAuthStatus("");
          setAuthMode("register");
        }}
        onLogoutClick={handleLogout}
      />

      <GenerationCounter
        totalGenerations={totalGenerations}
        isLoading={isLoadingGenerations}
      />

      <GenerateButton isGenerating={isGenerating} onGenerate={handleGenerateMidi} />

      {status && (
        <div className="mt-8 rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 backdrop-blur-xl">
          <p className="text-sm text-slate-300">{status}</p>
        </div>
      )}

      {authMode && (
        <AuthModal
          mode={authMode}
          email={email}
          username={username}
          password={password}
          authStatus={authStatus}
          setEmail={setEmail}
          setUsername={setUsername}
          setPassword={setPassword}
          onSubmit={handleAuth}
          onClose={() => setAuthMode(null)}
        />
      )}
    </>
  );
}
