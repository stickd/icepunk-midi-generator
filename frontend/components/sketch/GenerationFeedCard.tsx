"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, UserAvatar } from "@/components/ui";
import { SoundEngineSettings, useBrowserMidiPlayback } from "@/hooks/useBrowserMidiPlayback";
import MidiThumbnailCarousel from "./MidiThumbnailCarousel";
import PianoRollPreview from "./PianoRollPreview";
import { FeedGeneration } from "./feedTypes";

type GenerationFeedCardProps = {
  generation: FeedGeneration;
  onStubStatus: (message: string) => void;
  soundEngine: SoundEngineSettings;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
};

function formatUploadedAt(value?: string | null) {
  if (!value) return "new";

  try {
    return new Date(value).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "new";
  }
}

function formatDuration(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}s`;
}

function GenerationFeedCard({
  generation,
  onStubStatus,
  soundEngine,
  isLoggedIn = false,
  onRequireLogin,
}: GenerationFeedCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const playback = useBrowserMidiPlayback();
  const updatePlaybackSettings = playback.updateSettings;
  const items = useMemo(() => generation.items ?? [], [generation.items]);
  const activeItem = items[activeIndex] ?? null;
  const midiUrl = activeItem?.downloadUrl ?? generation.midiUrl ?? null;
  const hasMultipleItems = items.length > 1;
  const previewNotes = activeItem?.preview?.notes ?? null;
  const hasPreviewNotes = Boolean(previewNotes && previewNotes.length > 0);

  useEffect(() => {
    updatePlaybackSettings(soundEngine);
  }, [soundEngine, updatePlaybackSettings]);

  const togglePreview = useCallback(() => {
    if (!midiUrl) return;

    if (playback.isPlaying) {
      playback.stop();
      return;
    }

    playback.play(midiUrl, soundEngine);
  }, [midiUrl, playback, soundEngine]);

  const handleMidiDownload = useCallback(() => {
    if (!isLoggedIn) {
      onRequireLogin?.();
      onStubStatus("Sign up or log in to keep creating and downloading free of charge!");
      return;
    }
    if (!midiUrl) return;

    const rawName = activeItem?.fileName ?? generation.title;
    const cleanName = rawName.replace(/\.mid$/i, "").replace(/\s+/g, "_");
    const downloadFilename = `${cleanName}_by_${generation.username}.mid`;

    const link = document.createElement("a");
    link.href = midiUrl;
    link.download = downloadFilename;
    link.target = "_blank";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onStubStatus(`Downloading ${downloadFilename}`);
  }, [activeItem?.fileName, generation.title, generation.username, isLoggedIn, midiUrl, onRequireLogin, onStubStatus]);

  const handleSelectItem = useCallback(
    (index: number) => {
      playback.stop();
      setActiveIndex(index);
    },
    [playback],
  );

  const handleDetailsToggle = useCallback(() => {
    setShowDetails((current) => !current);
  }, []);

  return (
    <Card className="group overflow-hidden p-0 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.035] hover:shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
      {/* Feed Card User & Title Header */}
      <div className="border-b border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <Link
            className="group/user flex min-w-0 items-center gap-2.5 outline-none"
            href={`/u/${encodeURIComponent(generation.username)}`}
            title={`View ${generation.username}'s profile`}
          >
            <UserAvatar
              sizeClassName="h-8 w-8 text-xs transition-transform duration-150 group-hover/user:scale-105"
              username={generation.username}
            />

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ice-primary transition-colors duration-150 group-hover/user:text-ice-accent">
                {generation.username}
              </p>
              <p className="text-[11px] text-ice-muted">{generation.timeAgo}</p>
            </div>
          </Link>
        </div>

        <h3 className="mt-2 line-clamp-1 text-base font-bold leading-tight tracking-[-0.01em] text-ice-primary">
          {generation.title}
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ice-muted">
          <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5">
            {generation.midiCount} MIDI
          </span>
          {generation.bpm !== null && generation.bpm !== undefined ? (
            <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5">
              {generation.bpm} BPM
            </span>
          ) : null}
          <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5">
            {generation.downloads} downloads
          </span>
          <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5">
            {generation.sound}
          </span>
        </div>
      </div>

      {/* Piano Roll Window matching Generator Visualizer Style */}
      <div className="p-3">
        <div className="overflow-hidden rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-white/[0.04] shadow-[var(--ice-shadow-card)] backdrop-blur-2xl">
          {/* Top Window Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-black/[0.25] px-3.5 py-2.5">
            <span className="truncate text-xs font-medium tracking-[0.02em] text-ice-primary/90">
              {activeItem?.fileName ?? generation.title}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="accent">
                {generation.type === "DRUMS" ? "Drums" : "Melody"}
              </Badge>
              {generation.bpm !== null && generation.bpm !== undefined ? (
                <Badge>{generation.bpm} BPM</Badge>
              ) : null}
              {generation.pitch !== null && generation.pitch !== undefined ? (
                <Badge>pitch {generation.pitch}</Badge>
              ) : null}
              {generation.octaves !== null && generation.octaves !== undefined ? (
                <Badge>{generation.octaves} oct</Badge>
              ) : null}
            </div>
          </div>

          {/* Piano Roll Visualizer */}
          {hasPreviewNotes ? (
            <PianoRollPreview
              durationSeconds={activeItem?.durationSeconds}
              heightClassName="h-[210px]"
              label={`${activeItem?.fileName ?? generation.title} preview`}
              maxPitch={activeItem?.maxPitch}
              minPitch={activeItem?.minPitch}
              notes={previewNotes}
            />
          ) : (
            <div className="grid h-[210px] place-items-center bg-[color:var(--ice-bg-canvas)] p-3 text-center text-xs text-ice-muted">
              Preview unavailable
            </div>
          )}

          {/* Bottom Window Metadata & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] bg-black/[0.2] px-3.5 py-2.5">
            <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.06em] text-ice-muted">
              <span>
                <strong className="text-ice-secondary">
                  {activeItem?.noteCount ?? "n/a"}
                </strong>{" "}
                notes
              </span>
              <span>
                <strong className="text-ice-secondary">
                  {activeItem?.trackCount ?? "n/a"}
                </strong>{" "}
                tracks
              </span>
              <span>
                duration{" "}
                <strong className="text-ice-secondary">
                  {formatDuration(activeItem?.durationSeconds ?? null)}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                disabled={!midiUrl}
                onClick={togglePreview}
                size="sm"
                type="button"
                variant={playback.isPlaying ? "primary" : "secondary"}
              >
                {playback.isLoading ? (
                  "Loading..."
                ) : (
                  <>
                    <span aria-hidden="true">{playback.isPlaying ? "■ " : "▶ "}</span>
                    {playback.isPlaying ? "Stop" : "Preview"}
                  </>
                )}
              </Button>

              <button
                aria-label={`Download ${activeItem?.fileName ?? generation.title}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 text-xs font-medium text-ice-primary transition-colors duration-150 ease-out hover:bg-white/[0.08] disabled:pointer-events-none disabled:opacity-40"
                disabled={!midiUrl}
                onClick={handleMidiDownload}
                title={isLoggedIn ? (midiUrl ? "Download MIDI" : "MIDI download unavailable") : "Log in to download MIDI"}
                type="button"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download
              </button>
            </div>
          </div>
        </div>

        {/* Thumbnail Carousel for Pack Items */}
        {hasMultipleItems ? (
          <div className="mt-2.5">
            <MidiThumbnailCarousel
              activeIndex={activeIndex}
              items={items}
              label="Pack MIDIs"
              onSelect={handleSelectItem}
            />
          </div>
        ) : null}

        {playback.message ? (
          <p className="mt-1 text-center text-[11px] text-ice-muted" role="status">
            {playback.message}
          </p>
        ) : null}

        {/* Details Toggle & Pack ZIP Download */}
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-2.5">
          <button
            aria-expanded={showDetails}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-ice-muted transition-colors duration-150 ease-out hover:bg-white/[0.04] hover:text-ice-primary"
            onClick={handleDetailsToggle}
            type="button"
          >
            <span>Details</span>
            <svg
              aria-hidden="true"
              className={`h-3 w-3 transition-transform duration-200 ease-out ${
                showDetails ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <a
            className={`inline-flex items-center gap-2 rounded-full border border-[rgba(110,231,255,0.3)] bg-[rgba(110,231,255,0.1)] px-3.5 py-1.5 text-xs font-bold text-[#6ee7ff] shadow-[0_0_16px_rgba(110,231,255,0.2)] backdrop-blur-md transition duration-150 ease-out hover:bg-[rgba(110,231,255,0.2)] hover:shadow-[0_0_24px_rgba(110,231,255,0.35)] hover:text-white ${
              generation.packDownloadUrl
                ? ""
                : "pointer-events-none opacity-50"
            }`}
            download={`${generation.title.replace(/\s+/g, "_")}_by_${generation.username}.zip`}
            href={isLoggedIn ? (generation.packDownloadUrl ?? "#download") : "#login-required"}
            onClick={(event) => {
              if (!generation.packDownloadUrl) {
                event.preventDefault();
                return;
              }
              if (!isLoggedIn) {
                event.preventDefault();
                onRequireLogin?.();
                onStubStatus("Sign up or log in to keep creating and downloading free of charge!");
              }
            }}
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Download ZIP</span>
          </a>
        </div>

        {showDetails ? (
          <div className="mt-2 grid gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-xs text-ice-muted">
            <div className="flex items-center justify-between gap-3">
              <span>Generated</span>
              <span className="truncate text-right text-ice-secondary">
                {formatUploadedAt(generation.uploadedAt)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span>Visibility</span>
              <span className="text-ice-secondary">Public</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span>Notes</span>
              <span className="text-ice-secondary">{activeItem?.noteCount ?? "n/a"}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span>Duration</span>
              <span className="text-ice-secondary">{formatDuration(activeItem?.durationSeconds)}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span>Item BPM</span>
              <span className="text-ice-secondary">{activeItem?.bpm ?? "n/a"}</span>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export default memo(GenerationFeedCard);
