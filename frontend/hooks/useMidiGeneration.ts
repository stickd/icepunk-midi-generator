"use client";

import { useCallback, useState } from "react";
import {
  GenerateMidiRequest,
  GenerateMidiResponse,
  generateMidiPack,
  normalizeAuthToken,
  TOKEN_KEY,
} from "@/lib/api";
import { notifyFeedRefresh } from "@/lib/events";

export function useMidiGeneration(
  onUnauthorized?: () => void,
  onGenerated?: (totalGenerations: number) => void,
  onGuestLimitReached?: () => void,
) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [lastGeneration, setLastGeneration] =
    useState<GenerateMidiResponse | null>(null);

  const handleGenerateMidi = useCallback(async (request: GenerateMidiRequest) => {
    let token: string | null = null;

    try {
      setIsGenerating(true);
      setStatus("Generating frozen MIDI patterns...");

      token = normalizeAuthToken(localStorage.getItem(TOKEN_KEY));

      if (localStorage.getItem(TOKEN_KEY) && !token) {
        localStorage.removeItem(TOKEN_KEY);
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
          onGuestLimitReached?.();
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

        if (token && error.message.includes("HTTP_401")) {
          localStorage.removeItem(TOKEN_KEY);
          setStatus("Your session expired. Please log in again.");
          onUnauthorized?.();
          return;
        }

        if (token && error.message.includes("HTTP_403")) {
          localStorage.removeItem(TOKEN_KEY);
          setStatus("Please log in again before generating.");
          onUnauthorized?.();
          return;
        }
      }

      setStatus("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [onGenerated, onGuestLimitReached, onUnauthorized]);

  const resetGeneration = useCallback(() => {
    setLastGeneration(null);
    setStatus("");
  }, []);

  return {
    isGenerating,
    status,
    lastGeneration,
    resetGeneration,
    setStatus,
    handleGenerateMidi,
  };
}
