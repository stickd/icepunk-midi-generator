"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import AuthModal from "@/components/AuthModal";

type AuthMode = "login" | "register" | null;

type Snowflake = {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
};

const TOKEN_KEY = "icepunk_token";

export default function Home() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);

  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [authStatus, setAuthStatus] = useState("");
  const [token, setToken] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);

    if (savedToken) {
      setToken(savedToken);
      setStatus("You are logged in.");
    }

    const flakes = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 10 + 10,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.7 + 0.2,
    }));

    setSnowflakes(flakes);
  }, []);

  async function handleGenerateMidi() {
    try {
      setIsGenerating(true);
      setStatus("Generating frozen MIDI patterns...");

      const savedToken = localStorage.getItem(TOKEN_KEY);

      const response = await fetch("http://localhost:8080/generate", {
        method: "GET",
        headers: savedToken
          ? {
              Authorization: `Bearer ${savedToken}`,
            }
          : {},
      });

      if (response.status === 429) {
        setStatus(
          savedToken
            ? "Daily generation limit reached, come back tomorrow."
            : "Daily free generation limit reached.",
        );
        return;
      }

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setStatus("Session expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        setStatus("Generation failed. Please try again.");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "icepunk-midi-pack.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);

      setStatus("MIDI pack downloaded.");
    } catch {
      setStatus("Backend is not available right now.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleAuth() {
    if (!authMode) return;

    try {
      setAuthStatus("Loading...");

      const endpoint = authMode === "login" ? "login" : "register";

      const body =
        authMode === "login"
          ? { email, password }
          : { username, email, password };

      const response = await fetch(`http://localhost:8080/auth/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Auth failed");
      }

      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
      }

      setAuthStatus(
        authMode === "login"
          ? "Logged in successfully."
          : data.token
            ? "Account created and logged in successfully."
            : "Account created successfully.",
      );

      setStatus(
        authMode === "login" || data.token
          ? "You are logged in."
          : "Account created. Now you can log in.",
      );

      setAuthMode(null);
      setEmail("");
      setUsername("");
      setPassword("");
    } catch (error) {
      setAuthStatus(error instanceof Error ? error.message : "Auth failed");
    }
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setStatus("You are logged out.");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#38bdf822,transparent_35%),radial-gradient(circle_at_bottom,#1e3a8a55,transparent_40%)]" />

      <div className="pointer-events-none absolute inset-0">
        {snowflakes.map((snow) => (
          <div
            key={snow.id}
            className="absolute top-[-10px] rounded-full bg-white"
            style={{
              left: `${snow.left}%`,
              width: snow.size,
              height: snow.size,
              opacity: snow.opacity,
              animation: `fall ${snow.duration}s linear ${snow.delay}s infinite`,
            }}
          />
        ))}
      </div>

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
