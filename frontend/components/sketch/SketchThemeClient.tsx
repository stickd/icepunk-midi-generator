"use client";

import dynamic from "next/dynamic";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { BrowserMidiSource, SoundEngineSettings, useBrowserMidiPlayback } from "@/hooks/useBrowserMidiPlayback";
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
import SketchTopNav from "./SketchTopNav";
import SoundEngineCard from "./SoundEngineCard";
import { useSketchAuth } from "./useSketchAuth";
import { ToastNotification } from "@/components/ui";

const DEFAULT_SOURCE_STATE: GenerationSourceState = { source: "FACTORY" };

const AuthModal = dynamic(() => import("@/components/AuthModal"), {
  ssr: false,
});

const CreatePackModal = dynamic(() => import("./CreatePackModal"), {
  ssr: false,
});

const loadGeneratedPackVisualizer = () => import("./GeneratedPackVisualizer");
const GeneratedPackVisualizer = dynamic(loadGeneratedPackVisualizer, {
  loading: () => (
    <div className="grid min-h-[360px] place-items-center rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-white/[0.035] text-sm text-ice-muted">
      Preparing generated pack...
    </div>
  ),
  ssr: false,
});

export default function SketchThemeClient({ intro }: { intro?: ReactNode }) {
  const [status, setStatus] = useState("");
  const [showGuestLimitModal, setShowGuestLimitModal] = useState(false);
  const {
    authMode,
    authStatus,
    clearToken,
    email,
    handleAuth,
    handleResendVerification,
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
  const [sourceState, setSourceState] = useState<GenerationSourceState>(DEFAULT_SOURCE_STATE);
  const [sourceStateSession, setSourceStateSession] = useState<string | null>(token);
  const [soundEngine, setSoundEngine] = useState<SoundEngineSettings>({
    preset: "Soft Piano",
    sampleFile: null,
    volume: 0.8,
    bpm: 146,
    pitch: 0,
    octaves: 0,
    isLooping: true,
  });
  const [activeMidiSource, setActiveMidiSource] = useState<BrowserMidiSource>(null);
  const playback = useBrowserMidiPlayback();
  const stopPlayback = playback.stop;
  const updatePlaybackSettings = playback.updateSettings;
  const hadGenerationRef = useRef(false);
  const [lastRequest, setLastRequest] = useState<GenerateMidiRequest | null>(null);
  const {
    isGenerating,
    lastGeneration,
    resetGeneration,
    setStatus: setGenerationStatus,
    status: generationStatus,
    handleGenerateMidi,
  } = useMidiGeneration(clearToken, undefined, () => {
    setActiveModal(null);
    setShowGuestLimitModal(true);
  });

  useEffect(() => {
    let isAborted = false;
    const controller = new AbortController();

    const timerId = setTimeout(() => {
      if (isAborted) return;
      getGenerationUsage(token, controller.signal)
        .then((data) => {
          if (isAborted) return;
          setUsage(data);
          if (lastGeneration && data.limit > 0 && data.used >= data.limit) {
            setGenerationStatus(`You've reached today's limit of ${data.limit} packs. Please come back tomorrow.`);
          }
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
  }, [token, lastGeneration, setGenerationStatus]);

  const activeSourceState = sourceStateSession === token
    ? sourceState
    : DEFAULT_SOURCE_STATE;

  const handleSourceStateChange = useCallback((nextState: GenerationSourceState) => {
    setSourceState(nextState);
    setSourceStateSession(token);
  }, [token]);

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
      datasetIds: activeSourceState.datasetIds,
      includeFactoryPool: activeSourceState.includeFactoryPool,
      octaves: 1,
      packName: draft.packName,
      pitch: 0,
      publishMode: "PUBLIC",
      source: activeSourceState.source,
      tempAnalysisId: activeSourceState.tempAnalysisId,
      tempAnalysisAccessToken: activeSourceState.tempAnalysisAccessToken,
      type: "MELODY",
    };
    setLastRequest(request);

    return handleGenerateMidi(request);
  }, [
    handleGenerateMidi,
    activeSourceState.datasetIds,
    activeSourceState.includeFactoryPool,
    activeSourceState.source,
    activeSourceState.tempAnalysisId,
    activeSourceState.tempAnalysisAccessToken,
  ]);

  const handleRegenerate = useCallback(() => {
    if (!lastRequest) return;
    return handleGenerateMidi(lastRequest);
  }, [handleGenerateMidi, lastRequest]);

  const handleActiveMidiChange = useCallback((midiSource: BrowserMidiSource) => {
    setActiveMidiSource(midiSource);
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

    playback.play(activeMidiSource, soundEngine);
  }, [activeMidiSource, playback, soundEngine]);

  const openCreatePack = useCallback(() => {
    // Fetch the results UI while the user configures the pack, rather than
    // starting another network round trip after generation has finished.
    void loadGeneratedPackVisualizer().catch(() => undefined);
    setActiveModal("create");
  }, []);

  const handleCustomAnalysisUnauthorized = useCallback(() => {
    clearToken();
    setAuthStatus("Your session expired. Please log in again.");
    setAuthMode("login");
    setStatus("Your session expired. Please log in again.");
  }, [clearToken, setAuthMode, setAuthStatus]);

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
      <div className="studio-container">
        <SketchTopNav
          handleLogout={handleLogout}
          me={me}
          setAuthMode={setAuthMode}
          setAuthStatus={setAuthStatus}
          token={token}
          usage={usage}
        />

        {intro}
        <div className="studio-workspace" id="workspace">
          {/* Generator Column */}
          <div
            aria-label="MIDI generator"
            className="studio-generator"
            role="region"
            tabIndex={0}
          >
            <div className="studio-section-title"><h2>Generator<span aria-hidden="true"> / 01</span></h2><span className="studio-eyebrow">MAKE SOMETHING NEW</span></div>

            <div className="grid gap-0">

              <div className="studio-glass generator-glass">
                <div className="generator-content">
                  {lastGeneration ? (
                    <GeneratedPackVisualizer
                      generation={lastGeneration}
                      isRegenerating={isGenerating}
                      key={lastGeneration.packId}
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
                      onSourceStateChange={handleSourceStateChange}
                      onStubStatus={setStatus}
                      onUnauthorized={handleCustomAnalysisUnauthorized}
                      sourceState={activeSourceState}
                      status={generationStatus}
                      token={token}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>



          <FeedMountIsland
            isLoggedIn={Boolean(token)}
            onRequireLogin={requireLogin}
            onStubStatus={setStatus}
            playback={playback}
            soundEngine={soundEngine}
          />
        </div>

        {/* Keep core controls ready on first paint: no interaction-gated loading. */}
        <SoundEngineCard
          isPlaying={playback.isPlaying}
          onChange={handleSoundEngineChange}
          onPlayToggle={toggleMasterPlayback}
          onStop={stopPlayback}
          settings={soundEngine}
        />
      </div>

      {generationStatus || status ? (() => {
        const toastMessage = generationStatus || status;
        const isSuccessToast = toastMessage.includes("generated") || toastMessage.includes("ready") || toastMessage.includes("logged in");
        const isErrorToast = toastMessage.includes("failed") || toastMessage.includes("expired") || toastMessage.includes("busy") || toastMessage.includes("limit");
        const toastType = isSuccessToast ? "success" : isErrorToast ? "error" : "info";
        const toastTitle = isSuccessToast ? "Success" : isErrorToast ? "Notice" : "Account Required";

        return (
          <div className="fixed top-6 left-1/2 z-[100] w-full max-w-md -translate-x-1/2 px-4 pointer-events-auto">
            <ToastNotification
              message={toastMessage}
              onClose={() => {
                setStatus("");
                setGenerationStatus("");
              }}
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
          onResend={handleResendVerification}
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
