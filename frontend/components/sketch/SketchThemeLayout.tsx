"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Badge, Button, Panel } from "@/components/ui";
import { SoundEngineSettings } from "@/hooks/useBrowserMidiPlayback";
import { useMidiGeneration } from "@/hooks/useMidiGeneration";
import {
  authUser,
  getGenerationStats,
  getMe,
  MeResponse,
  TOKEN_KEY,
} from "@/lib/api";
import CreatePackModal, { CreatePackDraft } from "./CreatePackModal";
import GeneratedPackVisualizer from "./GeneratedPackVisualizer";
import RandomGeneratePanel, {
  GenerationSourceState,
} from "./RandomGeneratePanel";
import SoundEngineCard from "./SoundEngineCard";
import UserGenerationsFeed from "./UserGenerationsFeed";

type AuthMode = "login" | "register" | null;
const TOKEN_CHANGE_EVENT = "icepunk-token-change";

const TAB_BUTTON_BASE =
  "rounded-t-xl border border-b-0 px-4 py-2 text-xs font-medium tracking-[0.02em] outline-none transition-colors duration-150 ease-out";
const TAB_BUTTON_ACTIVE =
  "border-white/[0.08] bg-[color:var(--ice-surface)] text-ice-primary";

const AuthModal = dynamic(() => import("@/components/AuthModal"), {
  ssr: false,
});

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

export default function SketchThemeLayout() {
  const [status, setStatus] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [authStatus, setAuthStatus] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const token = useSyncExternalStore(
    subscribeToTokenChanges,
    getTokenSnapshot,
    getServerTokenSnapshot,
  );
  const [totalGenerations, setTotalGenerations] = useState<number | null>(null);
  const [meFetch, setMeFetch] = useState<{
    token: string;
    me: MeResponse;
  } | null>(null);
  const [activeModal, setActiveModal] = useState<"create" | null>(null);
  const [sourceState, setSourceState] = useState<GenerationSourceState>({
    source: "FACTORY",
  });
  const [soundEngine, setSoundEngine] = useState<SoundEngineSettings>({
    preset: "Soft Piano",
    sampleFile: null,
    volume: 0.8,
  });
  const {
    lastGeneration,
    resetGeneration,
    status: generationStatus,
    handleGenerateMidi,
  } = useMidiGeneration(clearToken, setTotalGenerations);

  useEffect(() => {
    const controller = new AbortController();

    getGenerationStats(controller.signal)
      .then((data) => setTotalGenerations(data.totalGenerations))
      .catch(() => setTotalGenerations(null));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    getMe(token, controller.signal)
      .then((data) => setMeFetch({ token, me: data }))
      .catch(() => {});

    return () => controller.abort();
  }, [token]);

  const me = token && meFetch?.token === token ? meFetch.me : null;

  function saveToken(value: string) {
    localStorage.setItem(TOKEN_KEY, value);
    notifyTokenChanged();
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    notifyTokenChanged();
  }

  async function handleAuth() {
    if (!authMode) return;

    try {
      setIsAuthenticating(true);
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
          setAuthStatus(
            "An account with that email or username already exists.",
          );
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
    } finally {
      setIsAuthenticating(false);
    }
  }

  function handleLogout() {
    clearToken();
    setStatus("You are logged out.");
  }

  function startGeneration(draft: CreatePackDraft) {
    setActiveModal(null);

    return handleGenerateMidi({
      amount: draft.amount,
      bpm: 146,
      octaves: 1,
      packName: draft.packName,
      pitch: 0,
      publishMode: "PUBLIC",
      source: sourceState.source,
      tempAnalysisId: sourceState.tempAnalysisId,
      type: draft.type === "drums" ? "DRUMS" : "MELODY",
    });
  }

  return (
    <main className="min-h-screen bg-[color:var(--background)]">
      <div className="mx-auto w-full max-w-7xl px-6 py-6">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link
            className="text-sm font-semibold tracking-[0.02em] text-ice-primary outline-none transition-colors duration-150 ease-out hover:text-white focus-visible:ring-2 focus-visible:ring-[rgba(100,120,255,0.45)]"
            href="/"
          >
            iCEPUNK
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="accent">{token ? "7/day" : "3/day"}</Badge>

            {me ? (
              <Link
                className="flex items-center gap-2 text-sm font-medium text-ice-primary outline-none transition-colors duration-150 ease-out hover:text-white focus-visible:ring-2 focus-visible:ring-[rgba(100,120,255,0.45)]"
                href={`/u/${encodeURIComponent(me.username)}`}
              >
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--ice-accent-soft)] text-xs font-semibold text-[color:var(--ice-accent-text)] ring-1 ring-[color:var(--ice-accent-border)]"
                >
                  {me.username.slice(0, 1).toUpperCase()}
                </span>
                {me.username}
              </Link>
            ) : (
              <span className="text-sm text-ice-muted">guest</span>
            )}

            <div className="flex flex-wrap gap-2">
              {token ? (
                <Button onClick={handleLogout} size="sm" type="button">
                  Logout
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => {
                      setAuthStatus("");
                      setAuthMode("login");
                    }}
                    size="sm"
                    type="button"
                  >
                    Login
                  </Button>
                  <Button
                    onClick={() => {
                      setAuthStatus("");
                      setAuthMode("register");
                    }}
                    size="sm"
                    type="button"
                    variant="primary"
                  >
                    Sign up
                  </Button>
                </>
              )}
            </div>
          </div>
        </nav>

        <h1 className="mt-8 text-2xl font-medium tracking-[-0.01em] text-ice-primary">
          Midis Generator
        </h1>

        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px_minmax(0,1fr)] lg:items-start">
          <div className="grid gap-0">
            <div className="flex gap-1 px-1" role="tablist">
              <button
                aria-selected="true"
                className={`${TAB_BUTTON_BASE} ${TAB_BUTTON_ACTIVE}`}
                role="tab"
                type="button"
              >
                Generate
              </button>
            </div>
            <Panel className="grid gap-5 rounded-tl-none p-5" elevated>
              {lastGeneration ? (
                <GeneratedPackVisualizer
                  generation={lastGeneration}
                  onNewGeneration={resetGeneration}
                  soundEngine={soundEngine}
                />
              ) : (
                <RandomGeneratePanel
                  onOpenCreatePack={() => setActiveModal("create")}
                  onSourceStateChange={setSourceState}
                  onStubStatus={setStatus}
                  sourceState={sourceState}
                  status={generationStatus || status}
                />
              )}
            </Panel>
          </div>

          <SoundEngineCard
            onChange={setSoundEngine}
            settings={soundEngine}
          />

          <div className="grid max-h-[720px] gap-4 overflow-y-auto">
            <UserGenerationsFeed onStubStatus={setStatus} />
          </div>
        </div>

        {totalGenerations !== null ? (
          <p className="mt-8 text-center text-sm text-ice-muted">
            Generated {totalGenerations.toLocaleString()} MIDI packs
          </p>
        ) : null}
      </div>

      {activeModal === "create" ? (
        <CreatePackModal
          onClose={() => setActiveModal(null)}
          onNext={startGeneration}
        />
      ) : null}

      {authMode ? (
        <AuthModal
          authStatus={authStatus}
          email={email}
          isSubmitting={isAuthenticating}
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSubmit={handleAuth}
          password={password}
          setEmail={setEmail}
          setPassword={setPassword}
          setUsername={setUsername}
          username={username}
        />
      ) : null}
    </main>
  );
}
