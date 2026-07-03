import { MidiPreviewNote } from "@/lib/api";

type PianoRollPreviewProps = {
  notes?: MidiPreviewNote[] | null;
  minPitch?: number | null;
  maxPitch?: number | null;
  durationSeconds?: number | null;
  compact?: boolean;
  label?: string;
};

const VIEWBOX_WIDTH = 640;
const VIEWBOX_HEIGHT = 180;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function PianoRollPreview({
  notes,
  minPitch,
  maxPitch,
  durationSeconds,
  compact = false,
  label,
}: PianoRollPreviewProps) {
  const safeNotes = (notes ?? []).filter(
    (note) =>
      Number.isFinite(note.pitch) &&
      Number.isFinite(note.start) &&
      Number.isFinite(note.duration) &&
      note.duration > 0,
  );

  if (safeNotes.length === 0) {
    return (
      <div
        aria-label={label ?? "Preview unavailable"}
        className={`grid place-items-center rounded-xl border border-white/[0.06] bg-[color:var(--ice-bg-canvas)] text-center text-xs text-ice-muted ${
          compact ? "h-[88px]" : "h-[180px]"
        }`}
        role="img"
      >
        Preview unavailable
      </div>
    );
  }

  const derivedMinPitch = Math.min(...safeNotes.map((note) => note.pitch));
  const derivedMaxPitch = Math.max(...safeNotes.map((note) => note.pitch));
  const lowPitch = minPitch ?? derivedMinPitch;
  const highPitch = maxPitch ?? derivedMaxPitch;
  const pitchRange = Math.max(1, highPitch - lowPitch);
  const maxNoteEnd = Math.max(...safeNotes.map((note) => note.start + note.duration));
  const timeline = Math.max(durationSeconds ?? 0, maxNoteEnd, 1);
  const laneHeight = VIEWBOX_HEIGHT / 12;

  return (
    <svg
      aria-label={label ?? "Generated MIDI piano roll preview"}
      className={`w-full rounded-xl border border-white/[0.06] bg-[color:var(--ice-bg-canvas)] ${
        compact ? "h-[88px]" : "h-[180px]"
      }`}
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
    >
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
      {safeNotes.map((note, index) => {
        const x = clamp((note.start / timeline) * VIEWBOX_WIDTH, 0, VIEWBOX_WIDTH - 3);
        const width = clamp((note.duration / timeline) * VIEWBOX_WIDTH, 3, VIEWBOX_WIDTH - x);
        const pitchPosition = (note.pitch - lowPitch) / pitchRange;
        const y = clamp((1 - pitchPosition) * (VIEWBOX_HEIGHT - 14), 4, VIEWBOX_HEIGHT - 16);
        const opacity = clamp(note.velocity / 127, 0.35, 1);

        return (
          <rect
            aria-hidden="true"
            className="fill-[rgb(120,150,255)]"
            height="10"
            key={`${note.pitch}-${note.start}-${index}`}
            opacity={opacity}
            rx="5"
            width={width}
            x={x}
            y={y}
          />
        );
      })}
    </svg>
  );
}
