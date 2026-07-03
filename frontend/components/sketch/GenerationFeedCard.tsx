"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import PianoRollPreview from "./PianoRollPreview";
import { FeedGeneration } from "./feedTypes";

type GenerationFeedCardProps = {
  generation: FeedGeneration;
  onStubStatus: (message: string) => void;
};

function formatUploadedAt(value?: string | null) {
  if (!value) return "new";

  try {
    return new Date(value).toLocaleDateString(undefined, {
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

export default function GenerationFeedCard({
  generation,
  onStubStatus,
}: GenerationFeedCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const items = generation.items ?? [];
  const activeItem = items[activeIndex] ?? null;
  const midiUrl = activeItem?.downloadUrl ?? generation.midiUrl ?? null;
  const avatarLetter = generation.username.slice(0, 1).toUpperCase();
  const hasMultipleItems = items.length > 1;

  function selectItem(offset: number) {
    if (!hasMultipleItems) return;
    setActiveIndex((currentIndex) => (currentIndex + offset + items.length) % items.length);
  }

  return (
    <Card className="group overflow-hidden p-0 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.035] hover:shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/[0.06] bg-[linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--ice-accent-soft)] text-xs font-black text-[color:var(--ice-accent-text)] ring-1 ring-[color:var(--ice-accent-border)]"
            >
              {avatarLetter}
            </span>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ice-primary">
                {generation.username}
              </p>
              <p className="text-xs text-ice-muted">{generation.timeAgo}</p>
            </div>
          </div>

          <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ice-muted">
            Public
          </span>
        </div>

        <h3 className="mt-4 line-clamp-2 text-lg font-black leading-tight tracking-[-0.03em] text-ice-primary">
          {generation.title}
        </h3>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ice-muted">
          <span className="rounded-full bg-black/20 px-2.5 py-1">
            {generation.midiCount} MIDI
          </span>
          {generation.bpm !== null && generation.bpm !== undefined ? (
            <span className="rounded-full bg-black/20 px-2.5 py-1">
              {generation.bpm} BPM
            </span>
          ) : null}
          <span className="rounded-full bg-black/20 px-2.5 py-1">
            {generation.downloads} downloads
          </span>
          <span className="rounded-full bg-black/20 px-2.5 py-1">
            {generation.sound}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-black/20 shadow-inner">
          <PianoRollPreview
            compact
            durationSeconds={activeItem?.durationSeconds}
            label={activeItem ? `${activeItem.fileName} piano roll preview` : `${generation.title} piano roll preview`}
            maxPitch={activeItem?.maxPitch}
            minPitch={activeItem?.minPitch}
            notes={activeItem?.preview.notes}
          />
        </div>

        <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <button
            aria-label={`Previous MIDI in ${generation.title}`}
            className="grid h-11 w-11 place-items-center rounded-full border border-white/[0.1] bg-white/[0.05] text-sm text-ice-secondary transition duration-150 ease-out hover:bg-white/[0.09] hover:text-ice-primary disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!hasMultipleItems}
            onClick={() => selectItem(-1)}
            title={hasMultipleItems ? "Previous MIDI" : "Only one MIDI in this pack"}
            type="button"
          >
            ←
          </button>

          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-ice-muted">
              {activeItem ? `${activeIndex + 1} / ${items.length}` : "No MIDI items"}
            </p>
            <p className="truncate text-sm font-semibold text-ice-secondary">
              {activeItem?.fileName ?? "Preview unavailable"}
            </p>
          </div>

          <div className="flex gap-1.5">
            <button
              aria-label={`Next MIDI in ${generation.title}`}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.1] bg-white/[0.04] text-ice-secondary transition duration-150 ease-out hover:bg-white/[0.08] hover:text-ice-primary disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!hasMultipleItems}
              onClick={() => selectItem(1)}
              title={hasMultipleItems ? "Next MIDI" : "Only one MIDI in this pack"}
              type="button"
            >
              →
            </button>

            <button
              aria-label={`Download ${activeItem?.fileName ?? generation.title}`}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.1] bg-[color:var(--ice-accent-soft)] text-[color:var(--ice-accent-text)] transition duration-150 ease-out hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!midiUrl}
              onClick={() => {
                if (midiUrl) {
                  window.open(midiUrl, "_blank", "noreferrer");
                  onStubStatus(`Opening ${activeItem?.fileName ?? generation.title} MIDI download.`);
                }
              }}
              title={midiUrl ? "Download MIDI" : "MIDI download unavailable"}
              type="button"
            >
              ↓
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-xs text-ice-muted">
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

        <a
          className={`mt-4 flex h-10 items-center justify-center rounded-xl border text-sm font-bold transition duration-150 ease-out ${
            generation.packDownloadUrl
              ? "border-white/[0.09] bg-white/[0.05] text-ice-primary hover:bg-white/[0.08]"
              : "pointer-events-none border-white/[0.05] bg-white/[0.025] text-ice-muted opacity-50"
          }`}
          href={generation.packDownloadUrl ?? "#download"}
          onClick={(event) => {
            if (!generation.packDownloadUrl) event.preventDefault();
          }}
        >
          Download ZIP
        </a>
      </div>
    </Card>
  );
}
