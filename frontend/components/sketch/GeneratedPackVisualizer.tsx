"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { GeneratedMidiItem, GenerateMidiResponse } from "@/lib/api";
import { SoundEngineSettings, useBrowserMidiPlayback } from "@/hooks/useBrowserMidiPlayback";
import BrowserPianoRoll from "./BrowserPianoRoll";
import MidiThumbnailCarousel from "./MidiThumbnailCarousel";

type GeneratedPackVisualizerProps = {
  generation: GenerateMidiResponse;
  onNewGeneration: () => void;
  onActiveMidiChange?: (midiUrl: string | null) => void;
  playback: ReturnType<typeof useBrowserMidiPlayback>;
  soundEngine: SoundEngineSettings;
};

function formatDuration(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}s`;
}

export default function GeneratedPackVisualizer({
  generation,
  onActiveMidiChange,
  onNewGeneration,
  playback,
  soundEngine,
}: GeneratedPackVisualizerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const items = generation.items;
  const activeItem: GeneratedMidiItem | null = items[activeIndex] ?? null;
  const isThisSource = Boolean(activeItem) && playback.activeSourceId === activeItem?.downloadUrl;
  const isThisLoading = isThisSource && playback.isLoading;
  const isThisPlaying = isThisSource && playback.isPlaying;

  const title = useMemo(
    () => activeItem?.fileName ?? generation.name,
    [activeItem, generation.name],
  );

  useEffect(() => {
    onActiveMidiChange?.(activeItem?.downloadUrl ?? null);
  }, [activeItem?.downloadUrl, onActiveMidiChange]);

  function selectItem(index: number) {
    if (index === activeIndex) return;
    if (isThisSource) {
      playback.stop();
    }
    setActiveIndex(index);
  }

  function togglePreview() {
    if (!activeItem) return;

    if (isThisPlaying) {
      playback.stop();
      return;
    }

    playback.play(activeItem.downloadUrl, soundEngine, activeItem.downloadUrl);
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-md transition duration-150 ease-out hover:border-white/20 hover:bg-white/[0.12] hover:shadow-[0_0_16px_rgba(255,255,255,0.15)]"
          onClick={onNewGeneration}
          type="button"
        >
          <svg className="h-3.5 w-3.5 text-ice-accent" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M19 12H5m0 0l6-6m-6 6l6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>New generation</span>
        </button>

        <a
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(110,231,255,0.3)] bg-[rgba(110,231,255,0.1)] px-3.5 py-1.5 text-xs font-bold text-[#6ee7ff] shadow-[0_0_16px_rgba(110,231,255,0.2)] backdrop-blur-md transition duration-150 ease-out hover:bg-[rgba(110,231,255,0.2)] hover:shadow-[0_0_24px_rgba(110,231,255,0.35)] hover:text-white"
          download={`${generation.name.replace(/\s+/g, "_")}_by_icepunk.zip`}
          href={generation.packDownloadUrl || generation.downloadUrl}
          rel="noreferrer"
          target="_blank"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Download whole pack (ZIP)</span>
        </a>
      </div>

      <div className="overflow-hidden rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-white/[0.04] shadow-[var(--ice-shadow-card)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-black/[0.25] px-4 py-3">
          <span className="truncate text-xs font-medium tracking-[0.02em] text-ice-primary/90">
            {title}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">{generation.type === "DRUMS" ? "Drums" : "Melody"}</Badge>
            {generation.bpm !== null ? <Badge>{generation.bpm} BPM</Badge> : null}
            {generation.pitch !== null ? <Badge>pitch {generation.pitch}</Badge> : null}
            {generation.octaves !== null ? <Badge>{generation.octaves} oct</Badge> : null}
          </div>
        </div>

        {activeItem ? (
          <BrowserPianoRoll
            isPlaying={isThisPlaying}
            midiFile={null}
            midiUrl={activeItem.downloadUrl}
            playbackPositionSeconds={isThisSource ? playback.positionSeconds : 0}
          />
        ) : (
          <div className="grid h-[210px] place-items-center bg-[color:var(--ice-bg-canvas)] p-4 text-center text-xs text-ice-muted">
            No individual MIDI items were returned. The whole ZIP is still available above.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] bg-black/[0.2] px-4 py-3">
          <div className="flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.06em] text-ice-muted">
            <span>
              <strong className="text-ice-secondary">{activeItem?.noteCount ?? "n/a"}</strong> notes
            </span>
            <span>
              <strong className="text-ice-secondary">{activeItem?.trackCount ?? "n/a"}</strong> tracks
            </span>
            <span>
              duration{" "}
              <strong className="text-ice-secondary">
                {formatDuration(activeItem?.durationSeconds ?? null)}
              </strong>
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={!activeItem}
              onClick={togglePreview}
              size="sm"
              type="button"
              variant={isThisPlaying ? "primary" : "secondary"}
            >
              {isThisLoading ? (
                "Loading..."
              ) : (
                <>
                  <span aria-hidden="true">{isThisPlaying ? "■ " : "▶ "}</span>
                  {isThisPlaying ? "Stop" : "Preview"}
                </>
              )}
            </Button>
            <a
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] px-4 text-xs font-medium text-ice-primary transition-colors duration-150 ease-out hover:bg-white/[0.08] ${
                activeItem ? "" : "pointer-events-none opacity-50"
              }`}
              download={activeItem ? `${(activeItem.fileName ?? "midi").replace(/\.mid$/i, "").replace(/\s+/g, "_")}_by_icepunk.mid` : undefined}
              href={activeItem?.downloadUrl ?? "#download"}
              rel="noreferrer"
              target="_blank"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download
            </a>
          </div>
        </div>
      </div>

      <MidiThumbnailCarousel
        activeIndex={activeIndex}
        items={items}
        onSelect={selectItem}
      />

      <p className="min-h-[18px] text-center text-xs text-ice-muted" role="status">
        {isThisSource ? playback.message : ""}
      </p>
    </div>
  );
}
