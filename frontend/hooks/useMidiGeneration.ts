"use client";

import { useState } from "react";
import { generateMidiPack, TOKEN_KEY } from "@/lib/api";

export function useMidiGeneration(onUnauthorized?: () => void) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState("");

  async function handleGenerateMidi() {
    try {
      setIsGenerating(true);
      setStatus("Generating frozen MIDI patterns...");

      const savedToken = localStorage.getItem(TOKEN_KEY);

      const response = await generateMidiPack(savedToken);

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
        setStatus("Session expired. Please log in again.");
        onUnauthorized?.();
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

  return {
    isGenerating,
    status,
    setStatus,
    handleGenerateMidi,
  };
}
