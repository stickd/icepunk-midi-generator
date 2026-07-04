"use client";

import { useState } from "react";
import {
  GenerateMidiRequest,
  GenerateMidiResponse,
  generateMidiPack,
  TOKEN_KEY,
} from "@/lib/api";
import { notifyFeedRefresh } from "@/lib/events";

export function useMidiGeneration(
  onUnauthorized?: () => void,
  onGenerated?: (totalGenerations: number) => void,
) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [lastGeneration, setLastGeneration] =
    useState<GenerateMidiResponse | null>(null);

  async function handleGenerateMidi(request: GenerateMidiRequest) {
    try {
      setIsGenerating(true);
      setStatus("Generating frozen MIDI patterns...");

      const savedToken = localStorage.getItem(TOKEN_KEY);
      const token =
        savedToken && savedToken !== "undefined" && savedToken !== "null"
          ? savedToken
          : null;

      if (savedToken && !token) {
        localStorage.removeItem(TOKEN_KEY);
        onUnauthorized?.();
      }

      const data = await generateMidiPack(request, token);
      setLastGeneration(data);

      onGenerated?.(data.totalGenerations);
      notifyFeedRefresh();
      setStatus("MIDI pack generated. Download links are ready.");
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Guest daily generation limit reached")) {
          setStatus(
            "You've used your guest generation limit. Log in or create an account to unlock unlimited generations.",
          );
          return;
        }

        if (error.message.includes("User daily generation limit reached")) {
          setStatus(
            "You've reached today's generation limit. Log in or create an account to unlock unlimited generations.",
          );
          return;
        }

        if (error.message.includes("Server is busy") || error.message.includes("HTTP_429")) {
          setStatus("The generator is busy right now. Please try again in a moment.");
          return;
        }

        if (error.message.includes("HTTP_401")) {
          localStorage.removeItem(TOKEN_KEY);
          setStatus("Your session expired. Please log in again.");
          onUnauthorized?.();
          return;
        }

        if (error.message.includes("HTTP_403")) {
          setStatus("Please log in again before generating.");
          onUnauthorized?.();
          return;
        }
      }

      setStatus("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  function resetGeneration() {
    setLastGeneration(null);
    setStatus("");
  }

  return {
    isGenerating,
    status,
    lastGeneration,
    resetGeneration,
    setStatus,
    handleGenerateMidi,
  };
}
