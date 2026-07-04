"use client";

import { useEffect, useRef, useState } from "react";
import { GeneratedMidiItem } from "@/lib/api";
import BrowserPianoRoll from "./BrowserPianoRoll";
import PianoRollPreview from "./PianoRollPreview";

type MidiThumbnailCarouselProps = {
  items: GeneratedMidiItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  label?: string;
};

export default function MidiThumbnailCarousel({
  items,
  activeIndex,
  onSelect,
  label = "Pack MIDIs",
}: MidiThumbnailCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [startIndex, setStartIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    function updateVisibleCount() {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth;
      const itemWidth = width < 640 ? 104 : 120;
      const count = Math.max(1, Math.floor((width + 8) / itemWidth));
      setVisibleCount(count);
    }

    updateVisibleCount();
    window.addEventListener("resize", updateVisibleCount);
    return () => window.removeEventListener("resize", updateVisibleCount);
  }, []);

  const maxStartIndex = Math.max(0, items.length - visibleCount);
  const clampedStartIndex = Math.max(0, Math.min(startIndex, maxStartIndex));

  useEffect(() => {
    setStartIndex((currentStart) => {
      const maxStart = Math.max(0, items.length - visibleCount);
      if (activeIndex < currentStart) {
        return activeIndex;
      }
      if (activeIndex >= currentStart + visibleCount) {
        return Math.min(maxStart, activeIndex - visibleCount + 1);
      }
      return Math.min(currentStart, maxStart);
    });
  }, [activeIndex, visibleCount, items.length]);

  function handlePrev() {
    setStartIndex((current) => Math.max(0, current - 1));
  }

  function handleNext() {
    setStartIndex((current) => Math.min(maxStartIndex, current + 1));
  }

  if (!items || items.length <= 1) return null;

  const itemStep = typeof window !== "undefined" && window.innerWidth < 640 ? 104 : 120;
  const translateX = -(clampedStartIndex * itemStep);

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

      <div className="relative w-full overflow-hidden" ref={containerRef}>
        <div
          className="flex items-center gap-2 py-1 transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${translateX}px)` }}
        >
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            const hasPreviewNotes = Boolean(item.preview?.notes && item.preview.notes.length > 0);

            return (
              <button
                aria-current={isActive}
                aria-label={`Select ${item.fileName ?? `MIDI ${index + 1}`}`}
                className={`group relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border transition-all duration-150 focus:outline-none sm:h-18 sm:w-28 ${
                  isActive
                    ? "scale-[1.02] border-[color:var(--ice-accent-border)] bg-white/[0.04] ring-2 ring-[color:var(--ice-accent-border)] shadow-[0_0_12px_rgba(120,150,255,0.25)]"
                    : "border-white/[0.08] bg-black/20 hover:scale-[1.02] hover:border-white/[0.2]"
                }`}
                key={item.id ?? index}
                onClick={() => onSelect(index)}
                title={item.fileName ?? `MIDI ${index + 1}`}
                type="button"
              >
                {hasPreviewNotes ? (
                  <PianoRollPreview
                    compact
                    durationSeconds={item.durationSeconds ?? item.preview?.durationSeconds}
                    maxPitch={item.maxPitch ?? item.preview?.maxPitch}
                    minPitch={item.minPitch ?? item.preview?.minPitch}
                    notes={item.preview?.notes}
                  />
                ) : (
                  <BrowserPianoRoll
                    isPlaying={false}
                    midiFile={null}
                    midiUrl={item.downloadUrl}
                    playbackPositionSeconds={0}
                    size="compact"
                  />
                )}

                <span className="pointer-events-none absolute left-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white/90 shadow-sm backdrop-blur-sm">
                  {index + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
