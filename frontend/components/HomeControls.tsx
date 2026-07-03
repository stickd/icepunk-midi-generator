"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useMidiGeneration } from "@/hooks/useMidiGeneration";
import { authUser, getGenerationStats, TOKEN_KEY } from "@/lib/api";

import GenerateButton from "@/components/GenerateButton";
import GenerationCounter from "@/components/GenerationCounter";
import Navbar from "@/components/Navbar";
import {
  Badge,
  Button,
  CreditBadge,
  Panel,
  SegmentedControl,
} from "@/components/ui";

type AuthMode = "login" | "register" | null;
type GenerationMode = "melody" | "drums" | "bass";

const TOKEN_CHANGE_EVENT = "icepunk-token-change";
const PIANO_ROLL_NOTE_ROWS = [
  ["ml-0 w-16", "ml-6 w-24", "ml-3 w-20", "ml-8 w-28"],
  ["ml-8 w-24", "ml-2 w-14", "ml-10 w-32", "ml-4 w-20"],
  ["ml-3 w-20", "ml-9 w-28", "ml-1 w-16", "ml-12 w-24"],
  ["ml-10 w-28", "ml-4 w-20", "ml-8 w-24", "ml-1 w-32"],
  ["ml-5 w-14", "ml-12 w-24", "ml-2 w-28", "ml-7 w-20"],
  ["ml-1 w-24", "ml-8 w-16", "ml-5 w-32", "ml-10 w-20"],
] as const;

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
  const [generationMode, setGenerationMode] = useState<GenerationMode>("melody");
  const token = useStoredToken();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { isGenerating, status, lastGeneration, setStatus, handleGenerateMidi } =
    useMidiGeneration(clearToken, setTotalGenerations);

  function handleFactoryGenerate() {
    return handleGenerateMidi({
      amount: 17,
      bpm: 140,
      octaves: 1,
      packName: "IcePunk Factory Pack",
      pitch: 0,
      publishMode: "PUBLIC",
      source: "FACTORY",
      type: generationMode === "drums" ? "DRUMS" : "MELODY",
    });
  }

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

  function showComingSoon(feature: string) {
    setStatus(`${feature} will be available soon.`);
  }

  function handleDownloadLatestPack() {
    if (!lastGeneration) {
      showComingSoon("Download controls");
      return;
    }

    const downloadLink = document.createElement("a");
    downloadLink.href = lastGeneration.downloadUrl;
    downloadLink.target = "_blank";
    downloadLink.rel = "noreferrer";
    downloadLink.click();
    setStatus("Latest MIDI pack opened for download.");
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

      <div className="mt-12 grid w-full max-w-6xl gap-5 text-left lg:grid-cols-[0.92fr_1.08fr]">
        <Panel elevated className="relative overflow-hidden p-5 md:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(94,234,212,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_42%)]" />

          <div className="relative">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <Badge tone="accent">Live generator</Badge>
              <CreditBadge credits={token ? 7 : 3} />
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-black tracking-tight text-ice-primary">
                Create pack
              </h2>
              <p className="mt-2 text-sm leading-6 text-ice-secondary">
                Start with a clean musical direction. Advanced shaping lands in
                the next workspace phase.
              </p>
            </div>

            <div className="grid gap-5">
              <div className="grid gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-ice-muted">
                  Mode
                </p>
                <SegmentedControl
                  value={generationMode}
                  onChange={setGenerationMode}
                  options={[
                    { label: "Melody", value: "melody" },
                    { label: "Drums", value: "drums" },
                    { label: "Bass", value: "bass" },
                  ]}
                  className="w-full justify-between"
                />
              </div>

              <div className="grid gap-3 rounded-3xl border border-white/10 bg-black/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-ice-primary">Source</p>
                    <p className="mt-1 text-sm text-ice-secondary">
                      Random generation is active for this iteration.
                    </p>
                  </div>
                  <Badge tone="neutral">Random</Badge>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => showComingSoon("Reference MIDI")}
                  >
                    Reference MIDI
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => showComingSoon("One-shot conditioning")}
                  >
                    One-shot sample
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-ice-secondary">Pack size</span>
                  <span className="font-bold text-ice-primary">17 MIDIs</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 w-2/3 rounded-full bg-cyan-200/80 shadow-[0_0_20px_rgba(94,234,212,0.4)]" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-ice-muted">
                  <span>BPM 140</span>
                  <span>Key C</span>
                  <span>Oct +1</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-cyan-200/15 bg-cyan-200/[0.08] p-4">
                <div>
                  <p className="text-sm font-bold text-ice-primary">Generation cost</p>
                  <p className="mt-1 text-sm text-ice-secondary">
                    Credits are deducted only after a successful pack.
                  </p>
                </div>
                <CreditBadge credits={2} />
              </div>
            </div>

            <div className="flex justify-center">
              <GenerateButton
                isGenerating={isGenerating}
                onGenerate={handleFactoryGenerate}
              />
            </div>
          </div>
        </Panel>

        <Panel elevated className="relative overflow-hidden p-5 md:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(34,211,238,0.12),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.075),transparent_48%)]" />

          <div className="relative">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-ice-muted">
                  Preview workspace
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-ice-primary">
                  Generated pack
                </h2>
              </div>
              <GenerationCounter
                totalGenerations={totalGenerations}
                isLoading={isLoadingGenerations}
              />
            </div>

            <div className="relative min-h-56 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#070A0F]/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(94,234,212,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(94,234,212,0.06)_1px,transparent_1px)] bg-[size:28px_28px] opacity-40" />
              <div className="relative mb-4 flex flex-wrap items-center justify-between gap-3">
                <Badge tone={lastGeneration ? "success" : "neutral"}>
                  {lastGeneration ? "Ready to download" : "Waiting for first pack"}
                </Badge>
                <span className="text-xs font-bold uppercase tracking-[0.22em] text-ice-muted">
                  ZIP artifact
                </span>
              </div>
              <div className="relative grid h-48 content-center gap-3">
                {PIANO_ROLL_NOTE_ROWS.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex items-center gap-3">
                    {row.map((noteClass, noteIndex) => (
                      <span
                        key={`${rowIndex}-${noteIndex}`}
                        className={`h-3 rounded-full bg-cyan-200/70 shadow-[0_0_18px_rgba(94,234,212,0.28)] ${noteClass}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {["MIDI 01", "MIDI 02", "MIDI 03"].map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => showComingSoon(`${name} preview controls`)}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:border-cyan-200/30 hover:bg-white/[0.065]"
                >
                  <span className="block text-sm font-bold text-ice-primary">
                    {name}
                  </span>
                  <span className="mt-1 block text-xs text-ice-muted">
                    Preview controls soon
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => showComingSoon("Save to Library")}
              >
                Save
              </Button>
              <Button
                type="button"
                variant={lastGeneration ? "primary" : "secondary"}
                onClick={handleDownloadLatestPack}
              >
                {lastGeneration ? "Download latest ZIP" : "Download"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => showComingSoon("Publishing")}
              >
                Publish
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      {status && (
        <div className="mt-5 max-w-3xl rounded-full border border-white/10 bg-white/[0.045] px-6 py-3 text-center backdrop-blur-xl">
          <p className="text-sm text-ice-secondary">{status}</p>
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
