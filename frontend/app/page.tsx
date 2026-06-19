"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useMidiGeneration } from "@/hooks/useMidiGeneration";
import { authUser, getGenerationStats, TOKEN_KEY } from "@/lib/api";

import Snowfall from "@/components/Snowfall";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import AuthModal from "@/components/AuthModal";

type AuthMode = "login" | "register" | null;

const TOKEN_CHANGE_EVENT = "icepunk-token-change";

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

export default function Home() {
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

    async function loadGenerationStats() {
      try {
        const data = await getGenerationStats();

        if (isMounted) {
          setTotalGenerations(data.totalGenerations);
        }
      } catch {
        if (isMounted) {
          setTotalGenerations(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingGenerations(false);
        }
      }
    }

    loadGenerationStats();

    return () => {
      isMounted = false;
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
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(56,189,248,0.18),transparent_38%)]" />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0)_0%,rgba(2,6,23,0.25)_100%)]" />

      <Snowfall />

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

      <Hero
        isGenerating={isGenerating}
        status={status}
        onGenerate={handleGenerateMidi}
        totalGenerations={totalGenerations}
        isLoadingGenerations={isLoadingGenerations}
      />

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
    </main>
  );
}
