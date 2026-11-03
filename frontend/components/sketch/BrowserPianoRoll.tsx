"use client";

import { memo, useEffect, useRef, useState } from "react";
import { PianoRollData, PianoRollNote, useMidiPianoRoll } from "@/hooks/useMidiPianoRoll";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const BASS_CEILING = 48;
const MELODY_CEILING = 72;

type BrowserPianoRollProps = {
  isPlaying: boolean;
  midiData?: PianoRollData | null;
  midiFile: File | null;
  midiMessage?: string;
  midiStatus?: "idle" | "loading" | "ready" | "error";
  midiUrl?: string | null;
  playbackPositionSeconds: number;
  size?: "normal" | "compact";
};

function pitchName(midi: number) {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function registerName(midi: number) {
  if (midi < BASS_CEILING) return "Bass";
  if (midi < MELODY_CEILING) return "Melody";
  return "Pad";
}

// Shared geometry for the bitmap, hover hit testing and transport overlay.
function geometry(data: PianoRollData, width: number, height: number, compact = false) {
  const center = (data.minMidi + data.maxMidi) / 2;
  const low = Math.max(0, Math.floor(Math.min(data.minMidi, center - 11)));
  const high = Math.min(127, Math.ceil(Math.max(data.maxMidi, low + 23)));
  const left = compact ? 5 : 38;
  const top = compact ? 5 : 26;
  return { low, high, left, top, width: Math.max(1, width - left - (compact ? 5 : 12)), height: Math.max(1, height - top - (compact ? 5 : 14)), duration: Math.max(.1, data.duration) };
}

function noteBox(data: PianoRollData, note: PianoRollNote, width: number, height: number, compact = false) {
  const g = geometry(data, width, height, compact);
  const row = g.height / (g.high - g.low + 1);
  const noteHeight = Math.max(2, Math.min(compact ? 4 : 8, row * .76));
  return {
    height: noteHeight,
    width: Math.max(2, Math.min(g.width - note.time / g.duration * g.width, note.duration / g.duration * g.width - 1)),
    x: g.left + note.time / g.duration * g.width,
    y: g.top + (g.high - note.midi) * row + (row - noteHeight) / 2,
  };
}

function draw(canvas: HTMLCanvasElement, data: PianoRollData, compact: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (!width || !height) return;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const g = geometry(data, width, height, compact);
  const row = g.height / (g.high - g.low + 1);
  ctx.font = '9px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  for (let pitch = g.low; pitch <= g.high; pitch++) {
    const y = g.top + (g.high - pitch) * row;
    const black = [1, 3, 6, 8, 10].includes(pitch % 12);
    ctx.fillStyle = black ? '#07131d' : '#0d1c28';
    ctx.fillRect(g.left, y, g.width, row);
    if (!compact) {
      ctx.fillStyle = black ? '#152a39' : '#315064';
      ctx.fillRect(black ? 23 : 18, y + .5, black ? 11 : 16, Math.max(1, row - 1));
      if (pitch % 12 === 0) {
        ctx.fillStyle = '#8faabd';
        ctx.fillText(pitchName(pitch), 2, y + row / 2);
      }
    }
    if (pitch % 12 === 0) {
      ctx.fillStyle = '#8acbfa16';
      ctx.fillRect(g.left, y + row - 1, g.width, 1);
    }
  }
  const divisions = compact ? 4 : width < 400 ? 4 : 8;
  for (let i = 0; i <= divisions; i++) {
    const x = g.left + g.width * i / divisions;
    ctx.fillStyle = i % 2 === 0 ? '#87c8f025' : '#87c8f012';
    ctx.fillRect(Math.round(x), g.top, 1, g.height);
    if (!compact && i < divisions) {
      ctx.fillStyle = '#799bb3';
      ctx.fillText((g.duration * i / divisions).toFixed(1) + 's', x + 3, 12);
    }
  }
  for (const note of data.notes) {
    const box = noteBox(data, note, width, height, compact);
    ctx.fillStyle = 'rgba(110, 195, 250, ' + (.65 + Math.max(0, Math.min(1, note.velocity)) * .35) + ')';
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.width, box.height, Math.min(2, box.height / 2));
    ctx.fill();
    if (!compact && box.width > 4) {
      ctx.fillStyle = '#d4f2ffb3';
      ctx.fillRect(box.x + 1, box.y + 1, 2, Math.max(1, box.height - 2));
    }
  }
}

function BrowserPianoRoll({
  isPlaying,
  midiData = null,
  midiFile,
  midiMessage,
  midiStatus,
  midiUrl = null,
  playbackPositionSeconds,
  size = "normal",
}: BrowserPianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const parsedSource = useMidiPianoRoll(midiData || midiStatus ? null : midiFile ?? midiUrl);
  const pianoRoll = midiData
    ? { data: midiData, message: midiMessage ?? `${midiData.notes.length.toLocaleString()} notes visualized.`, status: "ready" as const }
    : midiStatus
      ? { data: null, message: midiMessage ?? "Loading MIDI preview...", status: midiStatus }
      : parsedSource;
  const compact = size === "compact";
  const showPlayhead = !compact && (isPlaying || playbackPositionSeconds > 0);
  const playheadRef = useRef<HTMLDivElement>(null);
  // Playback only moves a composited overlay; the note bitmap stays unchanged.
  useEffect(() => {
    if (!playheadRef.current || !pianoRoll.data) return;
    const progress = Math.max(0, Math.min(1, playbackPositionSeconds / Math.max(.1, pianoRoll.data.duration)));
    playheadRef.current.style.transform = `translateX(${progress * 100}%)`;
  }, [playbackPositionSeconds, pianoRoll.data, showPlayhead]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const data = pianoRoll.data;
    if (!canvas || !data) return;
    const render = () => draw(canvas, data, compact);
    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [pianoRoll.data, compact]);

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (compact || !pianoRoll.data) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const data = pianoRoll.data;

    for (const note of data.notes) {
      const box = noteBox(data, note, rect.width, rect.height);
      if (mx >= box.x && mx <= box.x + box.width && my >= box.y && my <= box.y + box.height) {
        setTooltip({
          text: `${pitchName(note.midi)} · vel ${Math.round(note.velocity * 127)} · ${registerName(note.midi)}`,
          x: Math.min(mx + 10, Math.max(0, rect.width - 190)),
          y: Math.max(0, my - 28),
        });
        return;
      }
    }

    setTooltip(null);
  }

  if (!midiFile && !midiUrl && !midiData && !midiStatus) {
    return (
      <div
        className={`grid place-items-center rounded-xl border border-white/[0.06] bg-[color:var(--ice-bg-canvas)] text-center text-xs text-ice-muted ${
          compact ? "h-[88px]" : "h-[210px]"
        }`}
      >
        Choose a MIDI file to render a real piano roll.
      </div>
    );
  }

  return (
    <section aria-label="MIDI piano roll visualization" className={compact ? "midi-roll midi-roll-compact" : "midi-roll"}>
      <div
        className="midi-roll-surface"
        onMouseLeave={() => setTooltip(null)}
        onMouseMove={handleMouseMove}
        ref={wrapRef}
      >
        {pianoRoll.data ? (
          <canvas
            aria-label={`${pianoRoll.data.notes.length} MIDI notes across ${pianoRoll.data.duration.toFixed(1)} seconds`}
            className="h-full w-full"
            ref={canvasRef}
            role="img"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[color:var(--ice-bg-canvas)] p-3 text-center text-xs text-ice-muted">
            {pianoRoll.message}
          </div>
        )}

        {pianoRoll.data && showPlayhead ? (
          <div aria-hidden="true" className="midi-playhead-viewport"><div className="midi-playhead-track" ref={playheadRef}><span /></div></div>
        ) : null}

        {tooltip ? (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-white/10 bg-[rgba(10,10,20,0.92)] px-2.5 py-1.5 text-[10px] tracking-[0.06em] text-[rgba(200,210,255,0.9)] backdrop-blur-sm"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.text}
          </div>
        ) : null}
      </div>

      {!compact ? (
        <p className="min-h-[18px] text-xs text-ice-muted" role="status">
          {pianoRoll.message}
        </p>
      ) : null}
    </section>
  );
}

export default memo(BrowserPianoRoll);
