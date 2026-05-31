"use client"; // This component runs on the client side

import { useEffect, useState } from "react";
import { useMidiGeneration } from "@/hooks/useMidiGeneration";
import { authUser, TOKEN_KEY } from "@/lib/api";

import Snowfall from "@/components/Snowfall";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import AuthModal from "@/components/AuthModal";

// Authentication modal state type
type AuthMode = "login" | "register" | null;

export default function Home() {
  // Controls which authentication modal is open
  const [authMode, setAuthMode] = useState<AuthMode>(null);

  // Status message displayed during login/registration
  const [authStatus, setAuthStatus] = useState("");

  // Stores JWT token of authenticated user
  const [token, setToken] = useState<string | null>(null);

  // Form input states
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Custom hook responsible for MIDI generation
  const { isGenerating, status, setStatus, handleGenerateMidi } =
    useMidiGeneration(() => {
      // Logout user if backend reports unauthorized access
      setToken(null);
    });

  useEffect(() => {
    // Restore saved JWT token after page refresh
    const savedToken = localStorage.getItem(TOKEN_KEY);

    if (savedToken) {
      setToken(savedToken);
      setStatus("You are logged in.");
    }
  }, [setStatus]);

  async function handleAuth() {
    // Prevent execution if no auth mode is selected
    if (!authMode) return;

    try {
      // Show loading status depending on selected action
      setAuthStatus(
        authMode === "login" ? "Logging in..." : "Creating account...",
      );

      // Build request payload
      const body =
        authMode === "login"
          ? { email, password }
          : { username, email, password };

      // Send authentication request to backend
      const response = await authUser(authMode, body);

      if (!response.ok) {
        setAuthStatus("Auth failed. Check your data.");
        return;
      }

      const data = await response.json();

      // Save JWT token in browser storage
      localStorage.setItem(TOKEN_KEY, data.token);

      // Update application state
      setToken(data.token);
      setStatus("You are logged in.");

      // Close modal and clear form
      setAuthStatus("");
      setAuthMode(null);

      setEmail("");
      setUsername("");
      setPassword("");
    } catch {
      // Display error if backend is unavailable
      setAuthStatus("Backend is not available right now.");
    }
  }

  function handleLogout() {
    // Remove JWT token and reset user session
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setStatus("You are logged out.");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      {/* Background visual effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#38bdf822,transparent_35%),radial-gradient(circle_at_bottom,#1e3a8a55,transparent_40%)]" />

      {/* Snow animation */}
      <Snowfall />

      {/* Navigation bar */}
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

      {/* Main hero section with MIDI generation button */}
      <Hero
        isGenerating={isGenerating}
        status={status}
        onGenerate={handleGenerateMidi}
      />

      {/* Authentication modal */}
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
