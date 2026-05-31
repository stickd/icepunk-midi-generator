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

      const data = await generateMidiPack(savedToken);

      window.location.href = data.downloadUrl;

      setStatus("MIDI pack downloaded.");
    } catch {
      setStatus("Generation failed. Please try again.");
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
