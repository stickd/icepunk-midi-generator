import { memo, useMemo } from "react";
import { MidiPreviewNote } from "@/lib/api";

type GradientStop = { from: string; to: string };

type PianoRollPreviewProps = {
  notes?: MidiPreviewNote[] | null;
  minPitch?: number | null;
  maxPitch?: number | null;
  durationSeconds?: number | null;
  compact?: boolean;
  heightClassName?: string;
  label?: string;
  paletteId?: number;
  palette?: string[];
  playbackPositionSeconds?: number | null;
};

const VIEWBOX_WIDTH = 640;
const VIEWBOX_HEIGHT = 180;

const GRADIENT_PALETTES: GradientStop[][] = [
  // Deep Cobalt & Bright Ice Cyan
  [
    { from: "#0284c7", to: "#38bdf8" },
    { from: "#0369a1", to: "#60a5fa" },
    { from: "#1d4ed8", to: "#818cf8" },
    { from: "#0f766e", to: "#6ee7ff" },
  ],
  // Dark Emerald & Cyber Mint
  [
    { from: "#047857", to: "#34d399" },
    { from: "#0f766e", to: "#2dd4bf" },
    { from: "#059669", to: "#6ee7ff" },
    { from: "#065f46", to: "#10b981" },
  ],
  // Deep Violet & Electric Purple
  [
    { from: "#6b21a8", to: "#c084fc" },
    { from: "#4338ca", to: "#a855f7" },
    { from: "#4c1d95", to: "#818cf8" },
    { from: "#581c87", to: "#e879f9" },
  ],
  // Dark Crimson & Neon Pink
  [
    { from: "#9f1239", to: "#f472b6" },
    { from: "#881337", to: "#ec4899" },
    { from: "#a21caf", to: "#c084fc" },
    { from: "#701a75", to: "#f472b6" },
  ],
  // Dark Burnt Amber & Solar Gold
  [
    { from: "#b45309", to: "#fbbf24" },
    { from: "#92400e", to: "#f59e0b" },
    { from: "#78350f", to: "#fcd34d" },
    { from: "#b45309", to: "#38bdf8" },
  ],
  // Midnight Indigo & Ice Periwinkle
  [
    { from: "#3730a3", to: "#a5b4fc" },
    { from: "#1e3a8a", to: "#60a5fa" },
    { from: "#312e81", to: "#818cf8" },
    { from: "#1e1b4b", to: "#93c5fd" },
  ],
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function PianoRollPreview({
  notes,
  minPitch,
  maxPitch,
  durationSeconds,
  compact = false,
  heightClassName,
  label,
  paletteId,
  palette: customPalette,
  playbackPositionSeconds,
}: PianoRollPreviewProps) {
  const heightStyle = heightClassName ?? (compact ? "h-[135px]" : "h-[180px]");
  const selectedPaletteId = useMemo(() => {
    if (typeof paletteId === "number") return Math.abs(paletteId);
    const seed = label ?? (notes && notes.length > 0 ? `${notes.length}-${notes[0].pitch}-${notes[0].start}` : "def");
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }, [paletteId, label, notes]);

  const notePalette = useMemo(() => {
    if (customPalette && customPalette.length > 0) {
      return customPalette.map((c) => ({ from: c, to: c }));
    }
    return GRADIENT_PALETTES[selectedPaletteId % GRADIENT_PALETTES.length];
  }, [customPalette, selectedPaletteId]);

  const preview = useMemo(() => {
    const safeNotes = (notes ?? []).filter(
      (note) =>
        Number.isFinite(note.pitch) &&
        Number.isFinite(note.start) &&
        Number.isFinite(note.duration) &&
        note.duration > 0,
    );

    if (safeNotes.length === 0) {
      return { safeNotes };
    }

    const derivedMinPitch = Math.min(...safeNotes.map((note) => note.pitch));
    const derivedMaxPitch = Math.max(...safeNotes.map((note) => note.pitch));
    const lowPitch = minPitch ?? derivedMinPitch;
    const highPitch = maxPitch ?? derivedMaxPitch;
    const pitchRange = Math.max(1, highPitch - lowPitch);
    const maxNoteEnd = Math.max(...safeNotes.map((note) => note.start + note.duration));
    const timeline = Math.max(durationSeconds ?? 0, maxNoteEnd, 1);

    return {
      lowPitch,
      pitchRange,
      safeNotes,
      timeline,
    };
  }, [durationSeconds, maxPitch, minPitch, notes]);

  const lowPitch = preview.lowPitch ?? 0;
  const pitchRange = preview.pitchRange ?? 1;
  const timeline = preview.timeline ?? 1;
  const laneHeight = VIEWBOX_HEIGHT / 12;

  const playheadX = useMemo(() => {
    if (!Number.isFinite(playbackPositionSeconds) || (playbackPositionSeconds as number) < 0 || timeline <= 0) {
      return null;
    }
    const pos = clamp(playbackPositionSeconds as number, 0, timeline);
    return clamp((pos / timeline) * VIEWBOX_WIDTH, 0, VIEWBOX_WIDTH);
  }, [playbackPositionSeconds, timeline]);

  const renderedNotes = useMemo(() => {
    return preview.safeNotes.map((note, index) => {
      const x = clamp((note.start / timeline) * VIEWBOX_WIDTH, 0, VIEWBOX_WIDTH - 3);
      const width = clamp((note.duration / timeline) * VIEWBOX_WIDTH, 3, VIEWBOX_WIDTH - x);
      const pitchPosition = (note.pitch - lowPitch) / pitchRange;
      const y = clamp((1 - pitchPosition) * (VIEWBOX_HEIGHT - 14), 4, VIEWBOX_HEIGHT - 16);
      const opacity = clamp((note.velocity / 127) * 0.3 + 0.65, 0.65, 0.95);
      const gradIndex = Math.abs(note.pitch + index) % notePalette.length;
      const fillUrl = `url(#note-grad-${selectedPaletteId}-${gradIndex})`;

      return (
        <rect
          aria-hidden="true"
          fill={fillUrl}
          height="10"
          key={`${note.pitch}-${note.start}-${index}`}
          opacity={opacity}
          rx="5"
          width={width}
          x={x}
          y={y}
        />
      );
    });
  }, [lowPitch, notePalette.length, selectedPaletteId, pitchRange, preview.safeNotes, timeline]);

  if (preview.safeNotes.length === 0) {
    return (
      <div
        aria-label={label ?? "Preview unavailable"}
        className={`grid place-items-center rounded-xl border border-white/[0.06] bg-[color:var(--ice-bg-canvas)] p-3 text-center text-xs text-ice-muted ${heightStyle}`}
        role="img"
      >
        Preview unavailable
      </div>
    );
  }

  return (
    <svg
      aria-label={label ?? "Generated MIDI piano roll preview"}
      className={`w-full rounded-xl border border-white/[0.06] bg-[color:var(--ice-bg-canvas)] ${heightStyle}`}
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
    >
      <defs>
        {notePalette.map((g, i) => (
          <linearGradient id={`note-grad-${selectedPaletteId}-${i}`} key={i} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={g.from} />
            <stop offset="100%" stopColor={g.to} />
          </linearGradient>
        ))}
      </defs>
      {Array.from({ length: 12 }, (_, index) => (
        <line
          aria-hidden="true"
          className="stroke-white/[0.06]"
          key={index}
          x1="0"
          x2={VIEWBOX_WIDTH}
          y1={index * laneHeight}
          y2={index * laneHeight}
        />
      ))}
      {renderedNotes}
      {playheadX !== null ? (
        <g aria-hidden="true">
          <line
            className="stroke-[#6ee7ff] stroke-[2.5]"
            style={{ filter: "drop-shadow(0 0 6px rgba(110,231,255,0.85))" }}
            x1={playheadX}
            x2={playheadX}
            y1="0"
            y2={VIEWBOX_HEIGHT}
          />
          <circle
            className="fill-[#6ee7ff]"
            cx={playheadX}
            cy="5"
            r="4"
            style={{ filter: "drop-shadow(0 0 8px rgba(110,231,255,0.95))" }}
          />
        </g>
      ) : null}
    </svg>
  );
}

export default memo(PianoRollPreview);
