"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AnalyticsConsent = "unknown" | "granted" | "denied";

type ConsentContextValue = {
  analytics: AnalyticsConsent;
  settingsOpen: boolean;
  acceptAnalytics: () => void;
  rejectOptional: () => void;
  openSettings: () => void;
  closeSettings: () => void;
};

const CONSENT_KEY = "icepunk_privacy_preferences";
const CONSENT_VERSION = "2026-11-04";
const ConsentContext = createContext<ConsentContextValue | null>(null);

function readStoredConsent(): AnalyticsConsent {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return "unknown";
    const value = JSON.parse(raw) as { version?: string; analytics?: boolean };
    if (value.version !== CONSENT_VERSION || typeof value.analytics !== "boolean") return "unknown";
    return value.analytics ? "granted" : "denied";
  } catch {
    // Consent can still be made for this tab when storage is blocked.
    return "unknown";
  }
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [analytics, setAnalytics] = useState<AnalyticsConsent>("unknown");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => setAnalytics(readStoredConsent()), []);

  const save = useCallback((granted: boolean) => {
    try {
      window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: CONSENT_VERSION, analytics: granted }));
    } catch {
      // Do not turn a blocked-storage browser into an error state.
    }
    setAnalytics(granted ? "granted" : "denied");
    setSettingsOpen(false);
  }, []);

  const value = useMemo<ConsentContextValue>(() => ({
    analytics,
    settingsOpen,
    acceptAnalytics: () => save(true),
    rejectOptional: () => save(false),
    openSettings: () => setSettingsOpen(true),
    closeSettings: () => setSettingsOpen(false),
  }), [analytics, save, settingsOpen]);

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const context = useContext(ConsentContext);
  if (!context) throw new Error("useConsent must be used inside ConsentProvider");
  return context;
}
