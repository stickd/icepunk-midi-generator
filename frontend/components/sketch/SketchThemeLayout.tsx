"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Badge, Button, Panel } from "@/components/ui";
import { SoundEngineSettings, useBrowserMidiPlayback } from "@/hooks/useBrowserMidiPlayback";
import { useMidiGeneration } from "@/hooks/useMidiGeneration";
import {
  authUser,
  getGenerationStats,
  getGenerationUsage,
  getMe,
  GenerationUsageResponse,
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
import { EtherealShadowBackground } from "@/components/ui/ethereal-shadow";
import { InteractiveBubbleBackground, ToastNotification, UserAvatar } from "@/components/ui";
import { AuroraBackground } from "@/components/ui/aurora-background";

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
  const [showGuestLimitModal, setShowGuestLimitModal] = useState(false);
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
  const [usage, setUsage] = useState<GenerationUsageResponse | null>(null);
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
    bpm: 146,
    pitch: 0,
    octaves: 0,
    isLooping: false,
  });
  const [activeMidiSource, setActiveMidiSource] = useState<string | null>(null);
  const playback = useBrowserMidiPlayback();
  const stopPlayback = playback.stop;
  const updatePlaybackSettings = playback.updateSettings;
  const hadGenerationRef = useRef(false);
  const {
    lastGeneration,
    resetGeneration,
    status: generationStatus,
    handleGenerateMidi,
  } = useMidiGeneration(clearToken, setTotalGenerations, () => {
    setActiveModal(null);
    setShowGuestLimitModal(true);
  });

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

  useEffect(() => {
    const controller = new AbortController();

    getGenerationUsage(token, controller.signal)
      .then((data) => setUsage(data))
      .catch(() => setUsage(null));

    return () => controller.abort();
  }, [token, lastGeneration]);

  useEffect(() => {
    if (lastGeneration) {
      hadGenerationRef.current = true;
      return;
    }
    if (!hadGenerationRef.current) return;

    hadGenerationRef.current = false;
    setActiveMidiSource(null);
    stopPlayback();
  }, [lastGeneration, stopPlayback]);

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
  }

  function handleLogout() {
    clearToken();
    setStatus("You are logged out.");
  }

  const generatorScrollRef = useRef<HTMLDivElement>(null);
  const feedScrollRef = useRef<HTMLDivElement>(null);
  const [genProgress, setGenProgress] = useState(0);
  const [feedProgress, setFeedProgress] = useState(0);
  const [isGenScrolling, setIsGenScrolling] = useState(false);
  const [isFeedScrolling, setIsFeedScrolling] = useState(false);
  const genTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleGenScroll = () => {
    const el = generatorScrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setGenProgress(max > 0 ? el.scrollTop / max : 0);

    setIsGenScrolling(true);
    if (genTimeoutRef.current) clearTimeout(genTimeoutRef.current);
    genTimeoutRef.current = setTimeout(() => setIsGenScrolling(false), 1200);
  };

  const handleFeedScroll = () => {
    const el = feedScrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setFeedProgress(max > 0 ? el.scrollTop / max : 0);

    setIsFeedScrolling(true);
    if (feedTimeoutRef.current) clearTimeout(feedTimeoutRef.current);
    feedTimeoutRef.current = setTimeout(() => setIsFeedScrolling(false), 1200);
  };

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

  const handleActiveMidiChange = useCallback((midiUrl: string | null) => {
    setActiveMidiSource(midiUrl);
  }, []);

  const handleSoundEngineChange = useCallback((nextSettings: SoundEngineSettings) => {
    setSoundEngine(nextSettings);
    updatePlaybackSettings(nextSettings);
  }, [updatePlaybackSettings]);

  function toggleMasterPlayback() {
    if (playback.isPlaying) {
      playback.pause();
      return;
    }

    playback.play(activeMidiSource, soundEngine);
  }

  return (
    <EtherealShadowBackground>
      <div className="relative z-10 mx-auto w-full max-w-[1880px] px-3 py-4 sm:px-6 lg:px-8">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link
            className="text-sm font-bold tracking-[0.04em] text-white outline-none transition-colors duration-150 ease-out hover:text-ice-accent focus-visible:ring-2 focus-visible:ring-[rgba(100,120,255,0.45)]"
            href="/"
          >
            iCEPUNK
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <Badge
              title={
                token
                  ? "Unlimited generations"
                  : usage
                    ? `${usage.used} of ${usage.limit} used today`
                    : undefined
              }
              tone="accent"
            >
              {token
                ? "Unlimited"
                : usage
                ? `${Math.max(0, usage.limit - usage.used)} left today`
                : "5/day"}
            </Badge>

            {me ? (
              <Link
                className="flex items-center gap-2 text-sm font-medium text-ice-primary outline-none transition-colors duration-150 ease-out hover:text-white focus-visible:ring-2 focus-visible:ring-[rgba(100,120,255,0.45)]"
                href={`/u/${encodeURIComponent(me.username)}`}
              >
                <UserAvatar sizeClassName="h-7 w-7 text-xs" username={me.username} />
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

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.3fr)] lg:items-start lg:gap-8">
          {/* Generator Column */}
          <div
            ref={generatorScrollRef}
            onScroll={handleGenScroll}
            className="ice-scrollbar grid gap-6 pr-1 lg:max-h-[calc(100vh-4.5rem)] lg:overflow-y-auto"
          >
            <h1 className="flex items-center gap-3 pl-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center p-0.5">
                <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-[3px] bg-[color:var(--ice-accent)] opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-[3px] bg-[color:var(--ice-accent)] shadow-[0_0_14px_var(--ice-accent)]" />
              </span>
              Generator
            </h1>

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
              <div className="relative overflow-hidden rounded-2xl rounded-tl-none border border-white/[0.08] bg-[#070914]/94 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_36px_rgba(132,146,255,0.05)]">
                <InteractiveBubbleBackground className="min-h-[440px] p-5 flex flex-col justify-center">
                  {lastGeneration ? (
                    <GeneratedPackVisualizer
                      generation={lastGeneration}
                      onActiveMidiChange={handleActiveMidiChange}
                      onNewGeneration={resetGeneration}
                      playback={playback}
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
                </InteractiveBubbleBackground>
              </div>
            </div>
          </div>

          {/* Symmetrical Dual Scroll Indicator Track */}
          <div
            aria-hidden="true"
            className="hidden self-stretch w-5 relative flex-col items-center justify-between py-6 lg:flex select-none pointer-events-none"
            title="Left dot: Generator scroll • Right dot: Feed scroll"
          >
            {/* Center Vertical Divider Line */}
            <div className="absolute inset-y-6 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/15 to-transparent" />

            {/* Left Square (Generator Scroll Position - Soft Periwinkle) */}
            <div
              className={`absolute left-1/2 h-2 w-2 -translate-x-[11px] rounded-[2px] bg-[color:var(--ice-accent)] shadow-[0_0_8px_rgba(132,146,255,0.4)] transition-all duration-300 ease-out ${
                isGenScrolling ? "opacity-60 scale-100" : "opacity-0 scale-75"
              }`}
              style={{ top: `calc(1.5rem + ${genProgress * 85}%)` }}
            />

            {/* Right Square (Feed Scroll Position - Soft Cyan, 1-to-1 Symmetrical relative to divider) */}
            <div
              className={`absolute left-1/2 h-2 w-2 translate-x-[3px] rounded-[2px] bg-[#6ee7ff] shadow-[0_0_8px_rgba(110,231,255,0.4)] transition-all duration-300 ease-out ${
                isFeedScrolling ? "opacity-60 scale-100" : "opacity-0 scale-75"
              }`}
              style={{ top: `calc(1.5rem + ${feedProgress * 85}%)` }}
            />
          </div>

          {/* Feed Column */}
          <div className="min-w-0">
            <div
              ref={feedScrollRef}
              onScroll={handleFeedScroll}
              className="ice-scrollbar grid gap-4 overflow-y-auto pr-1 lg:max-h-[calc(100vh-4.5rem)]"
            >
              <UserGenerationsFeed
                isLoggedIn={Boolean(token)}
                onRequireLogin={() => {
                  setAuthMode("login");
                  setAuthStatus("Sign up or log in to keep creating and downloading free of charge!");
                }}
                onStubStatus={setStatus}
                soundEngine={soundEngine}
              />
            </div>
          </div>
        </div>

        {/* Floating Master Bottom Sound Engine Dock */}
        <SoundEngineCard
          isPlaying={playback.isPlaying}
          onChange={handleSoundEngineChange}
          onPlayToggle={toggleMasterPlayback}
          onStop={stopPlayback}
          settings={soundEngine}
        />
      </div>

      {status ? (() => {
        const isSuccessToast = status.includes("generated") || status.includes("ready") || status.includes("logged in");
        const isErrorToast = status.includes("failed") || status.includes("expired") || status.includes("busy");
        const toastType = isSuccessToast ? "success" : isErrorToast ? "error" : "info";
        const toastTitle = isSuccessToast ? "Success" : isErrorToast ? "Notice" : "Account Required";

        return (
          <div className="fixed top-6 left-1/2 z-[100] w-full max-w-md -translate-x-1/2 px-4 pointer-events-auto">
            <ToastNotification
              message={status}
              onClose={() => setStatus("")}
              title={toastTitle}
              type={toastType}
            />
          </div>
        );
      })() : null}

      {activeModal === "create" ? (
        <CreatePackModal
          onClose={() => setActiveModal(null)}
          onNext={startGeneration}
        />
      ) : null}

      {showGuestLimitModal ? (
        <div
          aria-labelledby="guest-limit-title"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-xl"
          role="dialog"
        >
          <section className="w-full max-w-md rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-[#0c0c16] p-8 shadow-[var(--ice-shadow-card)] backdrop-blur-2xl">
            <h2
              className="text-2xl font-semibold tracking-[-0.01em] text-ice-primary"
              id="guest-limit-title"
            >
              Free guest limit reached
            </h2>
            <p className="mt-2 text-sm text-ice-secondary">
              Create a free account to generate unlimited MIDI packs.
            </p>
            <div className="mt-7 flex flex-wrap justify-end gap-2">
              <Button
                onClick={() => {
                  setShowGuestLimitModal(false);
                  setAuthStatus("");
                  setAuthMode("register");
                }}
                type="button"
                variant="primary"
              >
                Sign up
              </Button>
              <Button
                onClick={() => {
                  setShowGuestLimitModal(false);
                  setAuthStatus("");
                  setAuthMode("login");
                }}
                type="button"
              >
                Log in
              </Button>
              <Button
                onClick={() => setShowGuestLimitModal(false)}
                type="button"
              >
                Close
              </Button>
            </div>
          </section>
        </div>
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
    </EtherealShadowBackground>
  );
}
