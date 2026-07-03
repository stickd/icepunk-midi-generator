"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";
import FeedbackSection from "@/components/FeedbackSection";
import UploadProjectSection from "@/components/UploadProjectSection";
import { useMidiGeneration } from "@/hooks/useMidiGeneration";
import { authUser, getGenerationStats, TOKEN_KEY } from "@/lib/api";
import CreatePackModal, { CreatePackDraft } from "./CreatePackModal";
import CreditButton from "./CreditButton";
import GeneratedMidisModal from "./GeneratedMidisModal";
import RandomGeneratePanel, { GenerationSourceState } from "./RandomGeneratePanel";
import RightControlPanel from "./RightControlPanel";
import SketchButton from "./SketchButton";
import UserGenerationsFeed from "./UserGenerationsFeed";
import styles from "./sketchTheme.module.css";

const DEFAULT_DRAFT: CreatePackDraft = {
  amount: 17,
  packName: "SteveMuis",
  type: "melody",
};

type AuthMode = "login" | "register" | null;
const TOKEN_CHANGE_EVENT = "icepunk-token-change";

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
  const [activeModal, setActiveModal] = useState<"create" | "generated" | null>(null);
  const [packDraft, setPackDraft] = useState<CreatePackDraft>(DEFAULT_DRAFT);
  const [sourceState, setSourceState] = useState<GenerationSourceState>({ source: "FACTORY" });
  const { isGenerating, lastGeneration, status: generationStatus, handleGenerateMidi } =
    useMidiGeneration(clearToken, setTotalGenerations);

  useEffect(() => {
    const controller = new AbortController();

    getGenerationStats(controller.signal)
      .then((data) => setTotalGenerations(data.totalGenerations))
      .catch(() => setTotalGenerations(null));

    return () => controller.abort();
  }, []);

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
      setAuthStatus(authMode === "login" ? "Logging in..." : "Creating account...");

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
    } finally {
      setIsAuthenticating(false);
    }
  }

  function handleLogout() {
    clearToken();
    setStatus("You are logged out.");
  }

  function openGeneratedMidis(draft: CreatePackDraft) {
    setPackDraft(draft);
    setActiveModal("generated");
    setStatus(`${draft.amount} ${draft.type} ideas ready for real ZIP generation.`);
  }

  function generateCurrentPack() {
    return handleGenerateMidi({
      amount: packDraft.amount,
      bpm: 146,
      octaves: 1,
      packName: packDraft.packName,
      pitch: 0,
      publishMode: "PUBLIC",
      source: sourceState.source,
      tempAnalysisId: sourceState.tempAnalysisId,
      type: packDraft.type === "drums" ? "DRUMS" : "MELODY",
    });
  }

  return (
    <main className={styles.shell}>
      <div className={styles.pageFrame}>
        <section className={styles.topPanel} aria-label="Generator landing">
          <h1 className={styles.title}>Midis Generator</h1>
          <div className={styles.userArea}>
            <CreditButton ariaLabel={token ? "7 daily generations" : "3 daily generations"}>
              {token ? "7/day" : "3/day"}
            </CreditButton>
            <span>{token ? "user1" : "guest"}</span>
            <span className={styles.userIcon} aria-label="User profile placeholder" role="img" />
            <div className={styles.authButtons}>
              {token ? (
                <SketchButton size="small" type="button" onClick={handleLogout}>
                  Logout
                </SketchButton>
              ) : (
                <>
                  <SketchButton
                    size="small"
                    type="button"
                    onClick={() => {
                      setAuthStatus("");
                      setAuthMode("login");
                    }}
                  >
                    Login
                  </SketchButton>
                  <SketchButton
                    size="small"
                    type="button"
                    onClick={() => {
                      setAuthStatus("");
                      setAuthMode("register");
                    }}
                  >
                    Sign up
                  </SketchButton>
                </>
              )}
            </div>
          </div>

          <RandomGeneratePanel
            sourceState={sourceState}
            onSourceStateChange={setSourceState}
            onOpenCreatePack={() => setActiveModal("create")}
            onStubStatus={setStatus}
            status={generationStatus || status}
          />

          <p className={styles.tips}>
            Tips: use the pack modal to preview this rough product direction. Real downloads still
            use the existing generator.
          </p>
        </section>

        <div className={styles.mainGrid}>
          <UserGenerationsFeed onStubStatus={setStatus} />
          <RightControlPanel onStubStatus={setStatus} />
        </div>

        {totalGenerations !== null ? (
          <p className={styles.statusLine}>Generated {totalGenerations.toLocaleString()} MIDI packs</p>
        ) : null}
      </div>

      <div className={styles.preservedSection}>
          <UploadProjectSection />
        <FeedbackSection />
      </div>

      {activeModal === "create" ? (
        <CreatePackModal onClose={() => setActiveModal(null)} onNext={openGeneratedMidis} />
      ) : null}

      {activeModal === "generated" ? (
        <GeneratedMidisModal
          draft={packDraft}
          isGenerating={isGenerating}
          lastGeneration={lastGeneration}
          onClose={() => setActiveModal(null)}
          onGenerateRealPack={generateCurrentPack}
          onStubStatus={setStatus}
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
