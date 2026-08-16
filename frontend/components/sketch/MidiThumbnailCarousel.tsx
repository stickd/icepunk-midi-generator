"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeneratedMidiItem } from "@/lib/api";
import { useGeneratedMidiPreview } from "@/hooks/useGeneratedMidiPreview";
import PianoRollPreview from "./PianoRollPreview";

const MAX_RENDERED_THUMBNAILS = 6;
// A thumbnail is 96–112px wide. This margin starts loading the next card before
// carousel navigation exposes it, without mounting or fetching an entire pack.
const THUMBNAIL_PRELOAD_MARGIN = "0px 160px";

type MidiThumbnailCarouselProps = {
  items: GeneratedMidiItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  label?: string;
  packId?: string;
  token?: string | null;
};

type GeneratedMidiThumbnailProps = {
  index: number;
  isActive: boolean;
  item: GeneratedMidiItem;
  onSelect: (index: number) => void;
  packId?: string;
  token?: string | null;
  visibilityRoot: HTMLDivElement | null;
};

function toPreviewNotes(notes: NonNullable<ReturnType<typeof useGeneratedMidiPreview>["preview"]>["data"]["notes"]) {
  return notes.map((note) => ({
    duration: note.duration,
    pitch: note.midi,
    start: note.time,
    velocity: Math.round(note.velocity * 127),
  }));
}

function GeneratedMidiThumbnail({
  index,
  isActive,
  item,
  onSelect,
  packId,
  token,
  visibilityRoot,
}: GeneratedMidiThumbnailProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [hasBeenVisible, setHasBeenVisible] = useState(isActive);
  const observerIsUnavailable = typeof window !== "undefined" && typeof IntersectionObserver === "undefined";
  const preview = useGeneratedMidiPreview(
    packId
      ? { fileName: item.fileName, itemId: item.id, packId, token }
      : null,
    Boolean(packId) && (isActive || hasBeenVisible || observerIsUnavailable),
  );

  useEffect(() => {
    if (!packId || hasBeenVisible || !visibilityRoot) return;

    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const button = buttonRef.current;
    if (!button) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setHasBeenVisible(true);
        observer.disconnect();
      },
      { root: visibilityRoot, rootMargin: THUMBNAIL_PRELOAD_MARGIN },
    );

    observer.observe(button);
    return () => observer.disconnect();
  }, [hasBeenVisible, packId, visibilityRoot]);

  const previewNotes = preview.preview ? toPreviewNotes(preview.preview.data.notes) : item.preview?.notes;
  const hasPreviewNotes = Boolean(previewNotes && previewNotes.length > 0);
  const statusLabel = preview.status === "error"
    ? "Preview failed. Select to retry."
    : preview.status === "loading"
      ? "Loading preview..."
      : "Preview loads when visible.";

  return (
    <button
      aria-current={isActive}
      aria-label={`Select ${item.fileName ?? `MIDI ${index + 1}`}`}
      className={`group relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none sm:h-18 sm:w-28 ${
        isActive
          ? "scale-[1.04] border-[color:var(--ice-accent-border)] bg-white/[0.04] ring-2 ring-[color:var(--ice-accent-border)] shadow-[0_0_16px_rgba(120,150,255,0.35)]"
          : "border-white/[0.08] bg-black/20 hover:scale-[1.02] hover:border-white/[0.2]"
      }`}
      onClick={() => onSelect(index)}
      ref={buttonRef}
      title={item.fileName ?? `MIDI ${index + 1}`}
      type="button"
    >
      {hasPreviewNotes ? (
        <PianoRollPreview
          compact
          durationSeconds={preview.preview?.data.duration ?? item.durationSeconds}
          label={item.fileName ?? item.id ?? `item-${index}`}
          maxPitch={preview.preview?.data.maxMidi ?? item.maxPitch}
          minPitch={preview.preview?.data.minMidi ?? item.minPitch}
          notes={previewNotes}
        />
      ) : (
        <span
          className="grid h-full w-full place-items-center bg-[color:var(--ice-bg-canvas)] px-2 text-center text-[10px] font-medium text-ice-muted"
          data-testid={`midi-preview-${item.id}-${preview.status}`}
        >
          {statusLabel}
        </span>
      )}

      <span className="pointer-events-none absolute left-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white/90 shadow-sm backdrop-blur-sm">
        {index + 1}
      </span>
    </button>
  );
}

function MidiThumbnailCarousel({
  items,
  activeIndex,
  onSelect,
  label = "Pack MIDIs",
  packId,
  token,
}: MidiThumbnailCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [startIndex, setStartIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(5);
  const [visibilityRoot, setVisibilityRoot] = useState<HTMLDivElement | null>(null);
  const setContainerRefs = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element;
    setVisibilityRoot((current) => current === element ? current : element);
  }, []);

  useEffect(() => {
    function updateVisibleCount() {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth;
      if (width === 0) return;
      const itemWidth = width < 640 ? 104 : 120;
      const count = Math.min(MAX_RENDERED_THUMBNAILS, Math.max(1, Math.floor((width + 8) / itemWidth)));
      setVisibleCount(count);
    }

    updateVisibleCount();
    window.addEventListener("resize", updateVisibleCount);
    return () => window.removeEventListener("resize", updateVisibleCount);
  }, []);

  const maxStartIndex = Math.max(0, items.length - visibleCount);
  const clampedStartIndex = Math.max(0, Math.min(startIndex, maxStartIndex));

  const visibleItems = useMemo(
    () =>
      items
        .slice(clampedStartIndex, clampedStartIndex + visibleCount)
        .map((item, visibleIndex) => ({
          item,
          index: clampedStartIndex + visibleIndex,
        })),
    [clampedStartIndex, items, visibleCount],
  );

  const handlePrev = useCallback(() => {
    setStartIndex((current) => Math.max(0, current - 1));
  }, []);

  const handleNext = useCallback(() => {
    setStartIndex((current) => Math.min(maxStartIndex, current + 1));
  }, [maxStartIndex]);

  if (!items || items.length <= 1) return null;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ice-muted">
          {label} <span className="text-ice-secondary">({items.length})</span>
        </span>

        <div className="flex items-center gap-1">
          <button
            aria-label="Previous items"
            className="grid h-7 w-7 place-items-center rounded-lg border border-white/[0.12] bg-white/[0.06] text-ice-primary transition-all duration-150 hover:bg-white/[0.12] hover:border-white/[0.25] disabled:pointer-events-none disabled:opacity-30"
            disabled={clampedStartIndex <= 0}
            onClick={handlePrev}
            type="button"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            aria-label="Next items"
            className="grid h-7 w-7 place-items-center rounded-lg border border-white/[0.12] bg-white/[0.06] text-ice-primary transition-all duration-150 hover:bg-white/[0.12] hover:border-white/[0.25] disabled:pointer-events-none disabled:opacity-30"
            disabled={clampedStartIndex >= maxStartIndex}
            onClick={handleNext}
            type="button"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className="relative w-full overflow-hidden"
        ref={setContainerRefs}
      >
        <div
          className="flex items-center gap-2 py-1"
        >
          {visibleItems.map(({ item, index }) => (
            <GeneratedMidiThumbnail
              index={index}
              isActive={index === activeIndex}
              item={item}
              key={item.id ?? index}
              onSelect={onSelect}
              packId={packId}
              token={token}
              visibilityRoot={visibilityRoot}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(MidiThumbnailCarousel);
