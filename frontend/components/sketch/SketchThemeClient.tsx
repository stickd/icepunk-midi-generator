"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { SoundEngineSettings, useBrowserMidiPlayback } from "@/hooks/useBrowserMidiPlayback";
import { useMidiGeneration } from "@/hooks/useMidiGeneration";
import {
  GenerateMidiRequest,
  getGenerationUsage,
  GenerationUsageResponse,
} from "@/lib/api";
import type { CreatePackDraft } from "./CreatePackModal";
import FeedMountIsland from "./FeedMountIsland";
import GuestLimitModal from "./GuestLimitModal";
import RandomGeneratePanel, {
  GenerationSourceState,
} from "./RandomGeneratePanel";
import SketchScrollIndicator from "./SketchScrollIndicator";
import SketchTopNav from "./SketchTopNav";
import { useDualScrollProgress } from "./useDualScrollProgress";
import { useSketchAuth } from "./useSketchAuth";
import { InteractiveBubbleBackground, ToastNotification } from "@/components/ui";

const TAB_BUTTON_BASE =
  "rounded-t-xl border border-b-0 px-4 py-2 text-xs font-medium tracking-[0.02em] outline-none transition-colors duration-150 ease-out";
const TAB_BUTTON_ACTIVE =
  "border-white/[0.08] bg-[color:var(--ice-surface)] text-ice-primary";

const AuthModal = dynamic(() => import("@/components/AuthModal"), {
  ssr: false,
});

const CreatePackModal = dynamic(() => import("./CreatePackModal"), {
  ssr: false,
});

const GeneratedPackVisualizer = dynamic(() => import("./GeneratedPackVisualizer"), {
  loading: () => (
    <div className="grid min-h-[360px] place-items-center rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-white/[0.035] text-sm text-ice-muted">
      Preparing generated pack...
    </div>
  ),
  ssr: false,
});

const SoundEngineCard = dynamic(() => import("./SoundEngineCard"), {
  ssr: false,
});

function SoundEngineShell({
  settings,
  onIntent,
}: {
  settings: SoundEngineSettings;
  onIntent: () => void;
}) {
  return (
    <div
      className="fixed bottom-3 left-1/2 z-40 -translate-x-1/2"
      onClick={onIntent}
      onFocus={onIntent}
      onTouchStart={onIntent}
    >
      <div className="w-[calc(100vw-1.5rem)] max-w-4xl rounded-2xl border border-white/[0.08] bg-[#070914]/94 px-4 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.6),0_0_24px_rgba(132,146,255,0.05)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-ice-primary">
              Sound Engine
            </span>
            <span className="text-xs font-medium text-ice-secondary">
              {settings.preset}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-medium text-ice-muted">
            <span>BPM <strong className="text-white">{settings.bpm ?? 146}</strong></span>
            <span>VOL <strong className="text-white">{Math.round((settings.volume ?? 0.8) * 100)}%</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SketchThemeClient() {
  const [status, setStatus] = useState("");
  const [showGuestLimitModal, setShowGuestLimitModal] = useState(false);
  const {
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
  } = useSketchAuth({ setStatus });
  const [usage, setUsage] = useState<GenerationUsageResponse | null>(null);
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
  const [isSoundEngineMounted, setIsSoundEngineMounted] = useState(false);

  const triggerSoundEngineMount = useCallback(() => {
    setIsSoundEngineMounted(true);
  }, []);

  const {
    feedProgress,
    feedScrollRef,
    genProgress,
    generatorScrollRef,
    handleFeedScroll,
    handleGenScroll,
    isFeedScrolling,
    isGenScrolling,
  } = useDualScrollProgress();
  const playback = useBrowserMidiPlayback();
  const stopPlayback = playback.stop;
  const updatePlaybackSettings = playback.updateSettings;
  const hadGenerationRef = useRef(false);
  const [lastRequest, setLastRequest] = useState<GenerateMidiRequest | null>(null);
  const {
    isGenerating,
    lastGeneration,
    resetGeneration,
    status: generationStatus,
    handleGenerateMidi,
  } = useMidiGeneration(clearToken, undefined, () => {
    setActiveModal(null);
    setShowGuestLimitModal(true);
  });

  const isSoundEngineActive = isSoundEngineMounted || playback.isPlaying;

  useEffect(() => {
    let isAborted = false;
    const controller = new AbortController();

    const timerId = setTimeout(() => {
      if (isAborted) return;
      getGenerationUsage(token, controller.signal)
        .then((data) => {
          if (!isAborted) setUsage(data);
        })
        .catch(() => {
          if (!isAborted) setUsage(null);
        });
  }, 200);

    return () => {
      isAborted = true;
      clearTimeout(timerId);
      controller.abort();
    };
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

  const startGeneration = useCallback((draft: CreatePackDraft) => {
    setActiveModal(null);

    const request: GenerateMidiRequest = {
      amount: draft.amount,
      bpm: 146,
      datasetIds: sourceState.datasetIds,
      includeFactoryPool: sourceState.includeFactoryPool,
      octaves: 1,
      packName: draft.packName,
      pitch: 0,
      publishMode: "PUBLIC",
      source: sourceState.source,
      tempAnalysisId: sourceState.tempAnalysisId,
      tempAnalysisAccessToken: sourceState.tempAnalysisAccessToken,
      type: draft.type === "drums" ? "DRUMS" : "MELODY",
    };
    setLastRequest(request);

    return handleGenerateMidi(request);
  }, [
    handleGenerateMidi,
    sourceState.datasetIds,
    sourceState.includeFactoryPool,
    sourceState.source,
    sourceState.tempAnalysisId,
    sourceState.tempAnalysisAccessToken,
  ]);

  const handleRegenerate = useCallback(() => {
    if (!lastRequest) return;
    return handleGenerateMidi(lastRequest);
  }, [handleGenerateMidi, lastRequest]);

  const handleActiveMidiChange = useCallback((midiUrl: string | null) => {
    setActiveMidiSource(midiUrl);
  }, []);

  const handleSoundEngineChange = useCallback((nextSettings: SoundEngineSettings) => {
    setSoundEngine(nextSettings);
    updatePlaybackSettings(nextSettings);
  }, [updatePlaybackSettings]);

  const toggleMasterPlayback = useCallback(() => {
    if (playback.isPlaying) {
      playback.pause();
      return;
    }

    playback.play(activeMidiSource, soundEngine, activeMidiSource);
  }, [activeMidiSource, playback, soundEngine]);

  const openCreatePack = useCallback(() => setActiveModal("create"), []);

  const openGuestSignUp = useCallback(() => {
    setShowGuestLimitModal(false);
    setAuthStatus("");
    setAuthMode("register");
  }, [setAuthMode, setAuthStatus]);

  const openGuestLogin = useCallback(() => {
    setShowGuestLimitModal(false);
    setAuthStatus("");
    setAuthMode("login");
  }, [setAuthMode, setAuthStatus]);

  return (
    <>
      <div className="relative z-10 mx-auto w-full max-w-[1880px] px-3 py-4 sm:px-6 lg:px-8">
        <SketchTopNav
          handleLogout={handleLogout}
          me={me}
          setAuthMode={setAuthMode}
          setAuthStatus={setAuthStatus}
          token={token}
          usage={usage}
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.3fr)] lg:items-start lg:gap-8">
          {/* Generator Column */}
          <div
            ref={generatorScrollRef}
            aria-label="MIDI generator"
            onScroll={handleGenScroll}
            className="ice-scrollbar grid gap-6 pr-1 lg:max-h-[calc(100vh-4.5rem)] lg:overflow-y-auto"
            role="region"
            tabIndex={0}
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
                      isRegenerating={isGenerating}
                      onActiveMidiChange={handleActiveMidiChange}
                      onNewGeneration={resetGeneration}
                      onRegenerate={handleRegenerate}
                      onStubStatus={setStatus}
                      playback={playback}
                      soundEngine={soundEngine}
                      tempAnalysisId={lastRequest?.tempAnalysisId}
                      tempAnalysisAccessToken={lastRequest?.tempAnalysisAccessToken}
                      token={token}
                    />
                  ) : (
                    <RandomGeneratePanel
                      onOpenCreatePack={openCreatePack}
                      onSourceStateChange={setSourceState}
                      onStubStatus={setStatus}
                      sourceState={sourceState}
                      status={generationStatus}
                      token={token}
                    />
                  )}
                </InteractiveBubbleBackground>
              </div>
            </div>
          </div>

          <SketchScrollIndicator
            feedProgress={feedProgress}
            genProgress={genProgress}
            isFeedScrolling={isFeedScrolling}
            isGenScrolling={isGenScrolling}
          />

          <FeedMountIsland
            feedScrollRef={feedScrollRef}
            handleFeedScroll={handleFeedScroll}
            isLoggedIn={Boolean(token)}
            onRequireLogin={requireLogin}
            onStubStatus={setStatus}
            playback={playback}
            soundEngine={soundEngine}
          />
        </div>

        {/* Floating Master Bottom Sound Engine Dock */}
        {isSoundEngineActive ? (
          <SoundEngineCard
            isPlaying={playback.isPlaying}
            onChange={handleSoundEngineChange}
            onPlayToggle={toggleMasterPlayback}
            onStop={stopPlayback}
            settings={soundEngine}
          />
        ) : (
          <SoundEngineShell
            onIntent={triggerSoundEngineMount}
            settings={soundEngine}
          />
        )}
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
        <GuestLimitModal
          onClose={() => setShowGuestLimitModal(false)}
          onLogin={openGuestLogin}
          onSignUp={openGuestSignUp}
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
    </>
  );
}
