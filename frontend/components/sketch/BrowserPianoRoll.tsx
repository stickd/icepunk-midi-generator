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

function noteColor(midi: number, alpha: number) {
  if (midi < BASS_CEILING) return `rgba(80, 200, 180, ${alpha})`;
  if (midi < MELODY_CEILING) return `rgba(120, 150, 255, ${alpha})`;
  return `rgba(200, 140, 255, ${alpha})`;
}

function isBlackKey(midi: number) {
  return [1, 3, 6, 8, 10].includes(midi % 12);
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function noteBox(data: PianoRollData, note: PianoRollNote, width: number, height: number) {
  const pitchRange = Math.max(1, data.maxMidi - data.minMidi);
  const rowHeight = height / (pitchRange + 1);
  const duration = Math.max(0.1, data.duration);

  return {
    height: Math.max(2.5, rowHeight - 1),
    width: Math.max(3, (note.duration / duration) * width - 1),
    x: (note.time / duration) * width,
    y: height - (note.midi - data.minMidi + 1) * rowHeight,
  };
}

function draw(
  canvas: HTMLCanvasElement,
  data: PianoRollData,
  playbackPositionSeconds: number,
  showPlayhead: boolean,
  shimmerT: number,
) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === 0 || height === 0) return;

  const targetWidth = Math.floor(width * dpr);
  const targetHeight = Math.floor(height * dpr);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  context.fillStyle = "#07070e";
  context.fillRect(0, 0, width, height);

  const pitchRange = Math.max(1, data.maxMidi - data.minMidi);
  const rowHeight = height / (pitchRange + 1);

  for (let midi = data.minMidi; midi <= data.maxMidi; midi += 1) {
    const y = height - (midi - data.minMidi + 1) * rowHeight;
    context.fillStyle = isBlackKey(midi) ? "rgba(0, 0, 0, 0.25)" : "rgba(255, 255, 255, 0.02)";
    context.fillRect(0, y, width, rowHeight);

    if (midi % 12 === 0) {
      context.strokeStyle = "rgba(255, 255, 255, 0.07)";
      context.lineWidth = 0.5;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  }

  const markCount = Math.max(1, Math.ceil(data.duration));
  for (let mark = 0; mark <= markCount; mark += 1) {
    const x = (mark / markCount) * width;
    const isHeavy = mark % 4 === 0;
    context.strokeStyle = isHeavy ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.04)";
    context.lineWidth = isHeavy ? 1 : 0.5;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  for (const note of data.notes) {
    const box = noteBox(data, note, width, height);
    const isCurrentNote =
      showPlayhead &&
      playbackPositionSeconds >= note.time &&
      playbackPositionSeconds <= note.time + note.duration;
    const alpha = 0.4 + note.velocity * 0.6;

    context.fillStyle = noteColor(note.midi, isCurrentNote ? Math.min(1, alpha + 0.3) : alpha);
    context.beginPath();
    context.roundRect(box.x, box.y + 0.5, box.width, box.height, 2);
    context.fill();

    const gloss = context.createLinearGradient(box.x, box.y, box.x, box.y + box.height / 2);
    gloss.addColorStop(0, "rgba(255, 255, 255, 0.18)");
    gloss.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gloss;
    context.fill();

    if (isCurrentNote) {
      context.strokeStyle = "rgba(255, 255, 255, 0.85)";
      context.lineWidth = 1.5;
      context.beginPath();
      context.roundRect(box.x, box.y + 0.5, box.width, box.height, 2);
      context.stroke();
    }
  }

  if (showPlayhead) {
    const playheadX = (Math.min(data.duration, playbackPositionSeconds) / Math.max(0.1, data.duration)) * width;
    context.strokeStyle = "rgb(100, 120, 255)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(playheadX, 0);
    context.lineTo(playheadX, height);
    context.stroke();
  }

  if (!prefersReducedMotion()) {
    const shimX = (shimmerT % 1) * (width + 80) - 40;
    const shimmer = context.createLinearGradient(shimX, 0, shimX + 40, 0);
    shimmer.addColorStop(0, "rgba(255, 255, 255, 0)");
    shimmer.addColorStop(0.5, "rgba(255, 255, 255, 0.025)");
    shimmer.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = shimmer;
    context.fillRect(0, 0, width, height);
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
  const playbackPositionRef = useRef(playbackPositionSeconds);
  const renderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    playbackPositionRef.current = playbackPositionSeconds;
    if (!isPlaying || prefersReducedMotion()) {
      renderRef.current?.();
    }
  }, [isPlaying, playbackPositionSeconds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pianoRoll.data) return;

    const data = pianoRoll.data;
    let frame: number | null = null;
    let shimmerT = 0;
    const shouldAnimate = !compact && isPlaying && !prefersReducedMotion();

    function render() {
      if (!canvas) return;
      draw(canvas, data, playbackPositionRef.current, showPlayhead, shimmerT);
    }

    renderRef.current = render;
    render();

    if (shouldAnimate) {
      const tick = () => {
        shimmerT += 0.004;
        render();
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    const observer = new ResizeObserver(render);
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      if (renderRef.current === render) {
        renderRef.current = null;
      }
    };
  }, [pianoRoll.data, showPlayhead, compact, isPlaying]);

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
          x: mx + 10,
          y: my - 28,
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
    <section aria-label="MIDI piano roll visualization" className="grid gap-2">
      <div
        className={`relative overflow-hidden rounded-xl border border-white/[0.06] ${
          compact ? "h-[88px] border-0" : "h-[210px]"
        }`}
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
