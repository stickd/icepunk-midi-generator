"use client";
import { memo, useMemo } from "react";
import { MidiPreviewNote } from "@/lib/api";
import BrowserPianoRoll from "./BrowserPianoRoll";
type Props = {
  notes?: MidiPreviewNote[] | null; minPitch?: number | null; maxPitch?: number | null;
  durationSeconds?: number | null; compact?: boolean; heightClassName?: string;
  label?: string; playbackPositionSeconds?: number | null;
};
function PianoRollPreview({ notes, minPitch, maxPitch, durationSeconds, compact = false, heightClassName, label, playbackPositionSeconds }: Props) {
  const data = useMemo(() => {
    const valid = (notes ?? []).filter(n => Number.isFinite(n.pitch) && Number.isFinite(n.start) && Number.isFinite(n.duration) && n.duration > 0);
    if (!valid.length) return null;
    return {
      fileName: label ?? "MIDI preview", trackCount: 1,
      minMidi: minPitch ?? Math.min(...valid.map(n => n.pitch)) - 2,
      maxMidi: maxPitch ?? Math.max(...valid.map(n => n.pitch)) + 2,
      duration: Math.max(durationSeconds ?? 0, ...valid.map(n => n.start + n.duration)),
      notes: valid.map(n => ({ midi: n.pitch, name: "", time: n.start, duration: n.duration, velocity: n.velocity / 127 })),
    };
  }, [notes, minPitch, maxPitch, durationSeconds, label]);
  return <div className={heightClassName ?? (compact ? "h-full" : undefined)} aria-label={label}>
    <BrowserPianoRoll isPlaying={false} midiData={data} midiFile={null} midiStatus={data ? "ready" : "idle"} midiMessage={data ? undefined : "Preview unavailable"} playbackPositionSeconds={playbackPositionSeconds ?? 0} size={compact ? "compact" : "normal"} />
  </div>;
}
export default memo(PianoRollPreview);
