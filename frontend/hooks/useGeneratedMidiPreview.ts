"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGeneratedItemPreviewUrl } from "@/lib/api";
import { parseMidiArrayBuffer, PianoRollData } from "./useMidiPianoRoll";

const MAX_CONCURRENT_PREVIEW_LOADS = 3;
const MAX_CACHED_PREVIEWS = 48;

export type GeneratedMidiPreview = {
  data: PianoRollData;
  fileName: string;
  midiBuffer: ArrayBuffer;
};

export type GeneratedMidiPreviewState = {
  error: string | null;
  preview: GeneratedMidiPreview | null;
  status: "idle" | "loading" | "ready" | "error";
};

type PreviewInput = {
  fileName: string;
  itemId: string;
  packId: string;
  token?: string | null;
};

type InflightPreview = {
  consumers: Set<symbol>;
  controller: AbortController;
  promise: Promise<GeneratedMidiPreview>;
};

const previewCache = new Map<string, GeneratedMidiPreview>();
const inflightPreviews = new Map<string, InflightPreview>();
const queuedLoads: Array<() => void> = [];
let activePreviewLoads = 0;

function previewKey(packId: string, itemId: string) {
  return `${packId}:${itemId}`;
}

function abortError() {
  return new DOMException("MIDI preview request was aborted.", "AbortError");
}

function drainPreviewQueue() {
  while (activePreviewLoads < MAX_CONCURRENT_PREVIEW_LOADS && queuedLoads.length > 0) {
    queuedLoads.shift()?.();
  }
}

function enqueuePreviewLoad<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queuedLoads.push(() => {
      if (signal.aborted) {
        reject(abortError());
        drainPreviewQueue();
        return;
      }

      activePreviewLoads += 1;
      void task()
        .then(resolve, reject)
        .finally(() => {
          activePreviewLoads -= 1;
          drainPreviewQueue();
        });
    });
    drainPreviewQueue();
  });
}

function isExpiredAccessResponse(status: number) {
  return status === 401 || status === 403;
}

async function fetchGeneratedMidi(input: PreviewInput, signal: AbortSignal): Promise<GeneratedMidiPreview> {
  // A presigned URL is intentionally temporary. Refresh it once when the object
  // service rejects an old signature, without treating the URL as cache identity.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const access = await getGeneratedItemPreviewUrl(input.packId, input.itemId, input.token, signal);
    const response = await fetch(access.url, { signal });

    if (response.ok) {
      const midiBuffer = await response.arrayBuffer();
      const data = await parseMidiArrayBuffer(midiBuffer, input.fileName);
      const preview = { data, fileName: input.fileName, midiBuffer };

      previewCache.set(previewKey(input.packId, input.itemId), preview);
      if (previewCache.size > MAX_CACHED_PREVIEWS) {
        const oldestKey = previewCache.keys().next().value;
        if (oldestKey) previewCache.delete(oldestKey);
      }

      return preview;
    }

    if (attempt === 0 && isExpiredAccessResponse(response.status)) {
      continue;
    }

    throw new Error(`HTTP_${response.status}`);
  }

  throw new Error("MIDI_PREVIEW_UNAVAILABLE");
}

function acquirePreview(input: PreviewInput, consumer: symbol) {
  const key = previewKey(input.packId, input.itemId);
  const cached = previewCache.get(key);
  if (cached) return { key, preview: cached, promise: Promise.resolve(cached) };

  let inflight = inflightPreviews.get(key);
  if (!inflight) {
    const controller = new AbortController();
    const promise = enqueuePreviewLoad(() => fetchGeneratedMidi(input, controller.signal), controller.signal)
      .finally(() => {
        inflightPreviews.delete(key);
      });

    inflight = { consumers: new Set(), controller, promise };
    inflightPreviews.set(key, inflight);
  }

  inflight.consumers.add(consumer);
  return { key, preview: null, promise: inflight.promise };
}

function releasePreview(key: string, consumer: symbol) {
  const inflight = inflightPreviews.get(key);
  if (!inflight) return;

  inflight.consumers.delete(consumer);
  if (inflight.consumers.size === 0) {
    inflight.controller.abort();
  }
}

function idleState(): GeneratedMidiPreviewState {
  return { error: null, preview: null, status: "idle" };
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message === "NO_MIDI_NOTES") {
    return "This MIDI file has no notes to render.";
  }

  return "Could not load this MIDI preview.";
}

export function useGeneratedMidiPreview(input: PreviewInput | null, enabled: boolean) {
  const [state, setState] = useState<GeneratedMidiPreviewState>(idleState);
  const [retryVersion, setRetryVersion] = useState(0);
  const consumerRef = useRef<symbol>(Symbol("generated-midi-preview"));
  const fileName = input?.fileName;
  const itemId = input?.itemId;
  const packId = input?.packId;
  const token = input?.token;

  useEffect(() => {
    let isCurrent = true;
    const consumer = consumerRef.current;
    const currentInput = fileName && itemId && packId
      ? { fileName, itemId, packId, token }
      : null;

    async function loadPreview() {
      if (!currentInput || !enabled) {
        setState(idleState());
        return;
      }

      const acquired = acquirePreview(currentInput, consumer);
      if (acquired.preview) {
        setState({ error: null, preview: acquired.preview, status: "ready" });
        return;
      }

      setState({ error: null, preview: null, status: "loading" });

      try {
        const preview = await acquired.promise;
        if (isCurrent) {
          setState({ error: null, preview, status: "ready" });
        }
      } catch (error) {
        if (!isCurrent || (error instanceof DOMException && error.name === "AbortError")) return;
        setState({ error: errorMessage(error), preview: null, status: "error" });
      }
    }

    void loadPreview();

    return () => {
      isCurrent = false;
      if (currentInput && enabled) {
        releasePreview(previewKey(currentInput.packId, currentInput.itemId), consumer);
      }
    };
  }, [enabled, fileName, itemId, packId, retryVersion, token]);

  const retry = useCallback(() => {
    if (!itemId || !packId) return;
    previewCache.delete(previewKey(packId, itemId));
    setRetryVersion((current) => current + 1);
  }, [itemId, packId]);

  return { ...state, retry };
}

export function __resetGeneratedMidiPreviewCacheForTests() {
  previewCache.clear();
  inflightPreviews.forEach((entry) => entry.controller.abort());
  inflightPreviews.clear();
  queuedLoads.splice(0, queuedLoads.length);
  activePreviewLoads = 0;
}
