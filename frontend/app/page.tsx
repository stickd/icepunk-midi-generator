"use client";

import { useEffect, useState } from "react";
import { useMidiGeneration } from "@/hooks/useMidiGeneration";
import { authUser, TOKEN_KEY } from "@/lib/api";

import Snowfall from "@/components/Snowfall";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import AuthModal from "@/components/AuthModal";

type AuthMode = "login" | "register" | null;

export default function Home() {
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [authStatus, setAuthStatus] = useState("");
  const [token, setToken] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { isGenerating, status, setStatus, handleGenerateMidi } =
    useMidiGeneration(() => {
      setToken(null);
    });

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);

    if (savedToken) {
      setToken(savedToken);
      setStatus("You are logged in.");
    }
  }, [setStatus]);

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

      localStorage.setItem(TOKEN_KEY, data.token);

      setToken(data.token);
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
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
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
