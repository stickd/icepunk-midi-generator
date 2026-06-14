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
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Guest daily generation limit reached")) {
          setStatus(
            "You've used your free daily generation. Log in or create an account to unlock more generations.",
          );
          return;
        }

        if (error.message.includes("User daily generation limit reached")) {
          setStatus(
            "You've reached today's generation limit. Please try again tomorrow.",
          );
          return;
        }

        if (
          error.message.includes("HTTP_401") ||
          error.message.includes("HTTP_403")
        ) {
          localStorage.removeItem(TOKEN_KEY);
          setStatus("Your session expired. Please log in again.");
          onUnauthorized?.();
          return;
        }
      }

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
