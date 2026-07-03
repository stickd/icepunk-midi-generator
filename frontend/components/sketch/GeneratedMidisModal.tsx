"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { GenerateMidiResponse, GeneratedMidiItem, MidiPreviewNote } from "@/lib/api";
import { CreatePackDraft } from "./CreatePackModal";
import PianoRollPreview from "./PianoRollPreview";

type GeneratedMidisModalProps = {
  draft: CreatePackDraft;
  isGenerating: boolean;
  lastGeneration: GenerateMidiResponse | null;
  onClose: () => void;
  onGenerateRealPack: () => void;
  onStubStatus: (message: string) => void;
};

type WindowWithAudioContext = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

function formatDuration(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "duration n/a";
  }

  return `${value.toFixed(1)}s`;
}

function midiPitchToFrequency(pitch: number) {
  return 440 * 2 ** ((pitch - 69) / 12);
}

export default function GeneratedMidisModal({
  draft,
  isGenerating,
  lastGeneration,
  onClose,
  onGenerateRealPack,
  onStubStatus,
}: GeneratedMidisModalProps) {
  const [playingItemId, setPlayingItemId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const items = lastGeneration?.items ?? [];

  function stopPreview() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    setPlayingItemId(null);
  }

  useEffect(() => {
    return () => stopPreview();
  }, []);

  function schedulePreviewNotes(context: AudioContext, notes: MidiPreviewNote[]) {
    const startTime = context.currentTime + 0.05;

    notes.forEach((note) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = startTime + Math.max(0, note.start);
      const noteEnd = noteStart + Math.min(Math.max(note.duration, 0.04), 2);

      oscillator.type = "triangle";
      oscillator.frequency.value = midiPitchToFrequency(note.pitch);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.02, note.velocity / 1270),
        noteStart + 0.01,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.02);
    });
  }

  function playPreview(item: GeneratedMidiItem) {
    const notes = item.preview?.notes ?? [];

    if (notes.length === 0) {
      onStubStatus("Preview playback is unavailable for this MIDI item.");
      return;
    }

    if (playingItemId === item.id) {
      stopPreview();
      return;
    }

    stopPreview();

    try {
      const AudioContextClass =
        window.AudioContext ?? (window as WindowWithAudioContext).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("AudioContext unavailable");
      }

      const context = new AudioContextClass();
      audioContextRef.current = context;
      setPlayingItemId(item.id);

      schedulePreviewNotes(context, notes.slice(0, 96));
      const previewEndSeconds = Math.min(
        Math.max(...notes.map((note) => note.start + note.duration), 1),
        12,
      );
      timeoutRef.current = window.setTimeout(stopPreview, previewEndSeconds * 1000 + 250);
    } catch {
      stopPreview();
      onStubStatus("Browser audio preview is unavailable here.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-xl">
      <section
        aria-labelledby="generated-midis-title"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-[#0c0c16] shadow-[var(--ice-shadow-card)] backdrop-blur-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-ice-muted">
              {lastGeneration
                ? `${lastGeneration.source.replace("_", " ")} / ${lastGeneration.type}`
                : "Ready to generate"}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ice-primary" id="generated-midis-title">
              {lastGeneration?.name ?? draft.packName}
            </h2>
            <p className="mt-2 text-sm text-ice-secondary">
              {lastGeneration
                ? `${items.length} MIDI items / BPM ${lastGeneration.bpm ?? "n/a"} / pitch ${
                    lastGeneration.pitch ?? "n/a"
                  } / octaves ${lastGeneration.octaves ?? "n/a"}`
                : `${draft.amount} ${draft.type} ideas will be generated as a real ZIP pack.`}
            </p>
          </div>
          <button
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-ice-secondary transition-colors duration-150 ease-out hover:bg-white/[0.08] hover:text-ice-primary"
            onClick={onClose}
            type="button"
          >
            X
          </button>
        </div>

        <div className="grid max-h-[calc(90vh-120px)] gap-5 overflow-y-auto p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
            <div className="text-sm text-ice-secondary">
              {lastGeneration
                ? "Generated MIDI items are available below."
                : "Run generation to receive real MIDI items, metadata, previews, and download links."}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={isGenerating} onClick={onGenerateRealPack} type="button" variant="primary">
                {isGenerating ? "Generating..." : lastGeneration ? "Regenerate pack" : "Generate real pack"}
              </Button>
              {lastGeneration ? (
                <a
                  className="inline-flex h-10 items-center rounded-full border border-white/[0.09] bg-white/[0.04] px-5 text-sm font-medium text-ice-primary transition-colors duration-150 ease-out hover:bg-white/[0.08]"
                  href={lastGeneration.packDownloadUrl || lastGeneration.downloadUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Download ZIP
                </a>
              ) : null}
            </div>
          </div>

          {lastGeneration ? (
            <div aria-label="Generated MIDI items" className="grid gap-3">
              {items.length > 0 ? (
                items.map((item) => (
                  <GeneratedMidiItemCard
                    isPlaying={playingItemId === item.id}
                    item={item}
                    key={item.id}
                    onPlay={() => playPreview(item)}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-sm text-ice-secondary">
                  No individual MIDI items were returned. The whole ZIP is still available.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function GeneratedMidiItemCard({
  item,
  isPlaying,
  onPlay,
}: {
  item: GeneratedMidiItem;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  return (
    <article className="grid gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="truncate text-sm text-ice-primary">{item.fileName}</strong>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-xs text-ice-muted">
            #{item.index + 1}
          </span>
          <span className="text-xs text-ice-muted">{formatDuration(item.durationSeconds)}</span>
          {item.noteCount !== null ? (
            <span className="text-xs text-ice-muted">{item.noteCount} notes</span>
          ) : null}
        </div>
        <PianoRollPreview
          compact
          durationSeconds={item.durationSeconds}
          label={`${item.fileName} piano roll preview`}
          maxPitch={item.maxPitch}
          minPitch={item.minPitch}
          notes={item.preview?.notes}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
        <Button
          disabled={!item.preview?.notes?.length}
          onClick={onPlay}
          size="sm"
          type="button"
          variant={isPlaying ? "primary" : "secondary"}
        >
          {isPlaying ? "Stop" : "Play"}
        </Button>
        <a
          className="inline-flex h-8 items-center rounded-full border border-white/[0.09] bg-white/[0.04] px-4 text-xs font-medium text-ice-primary transition-colors duration-150 ease-out hover:bg-white/[0.08]"
          href={item.downloadUrl}
          rel="noreferrer"
          target="_blank"
        >
          Download
        </a>
      </div>
    </article>
  );
}
