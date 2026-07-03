"use client";

import { useEffect, useRef, useState } from "react";
import { PianoRollData, useMidiPianoRoll } from "@/hooks/useMidiPianoRoll";
import styles from "./sketchTheme.module.css";

const KEYBOARD_WIDTH = 58;
const TIMELINE_HEIGHT = 24;
const NOTE_HEIGHT = 12;
const MIN_CANVAS_WIDTH = 520;
const MAX_CANVAS_WIDTH = 16000;

type BrowserPianoRollProps = {
  midiFile: File | null;
};

function isBlackKey(midi: number) {
  return [1, 3, 6, 8, 10].includes(midi % 12);
}

function drawPianoRoll(
  canvas: HTMLCanvasElement,
  data: PianoRollData,
  zoom: number,
) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const dpr = window.devicePixelRatio || 1;
  const noteCount = data.maxMidi - data.minMidi + 1;
  const width = Math.min(
    MAX_CANVAS_WIDTH,
    Math.max(MIN_CANVAS_WIDTH, KEYBOARD_WIDTH + data.duration * zoom + 80),
  );
  const height = TIMELINE_HEIGHT + noteCount * NOTE_HEIGHT;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  context.fillStyle = "#9a88de";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#8673cf";
  context.fillRect(0, 0, KEYBOARD_WIDTH, height);
  context.fillRect(KEYBOARD_WIDTH, 0, width - KEYBOARD_WIDTH, TIMELINE_HEIGHT);

  context.strokeStyle = "#07040c";
  context.lineWidth = 2;
  context.strokeRect(0, 0, width, height);
  context.beginPath();
  context.moveTo(KEYBOARD_WIDTH, 0);
  context.lineTo(KEYBOARD_WIDTH, height);
  context.moveTo(0, TIMELINE_HEIGHT);
  context.lineTo(width, TIMELINE_HEIGHT);
  context.stroke();

  context.font = "11px Comic Sans MS, Comic Sans, cursive";
  context.textBaseline = "middle";

  for (let midi = data.maxMidi; midi >= data.minMidi; midi -= 1) {
    const row = data.maxMidi - midi;
    const y = TIMELINE_HEIGHT + row * NOTE_HEIGHT;

    context.fillStyle = isBlackKey(midi) ? "rgba(7, 4, 12, 0.16)" : "rgba(255, 255, 255, 0.08)";
    context.fillRect(0, y, width, NOTE_HEIGHT);
    context.strokeStyle = "rgba(7, 4, 12, 0.18)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();

    if (midi % 12 === 0 || midi === data.minMidi || midi === data.maxMidi) {
      context.fillStyle = "#08050f";
      context.fillText(`C${Math.floor(midi / 12) - 1}`, 8, y + NOTE_HEIGHT / 2);
    }
  }

  const secondsStep = zoom < 35 ? 4 : zoom < 70 ? 2 : 1;
  context.fillStyle = "#08050f";
  context.strokeStyle = "rgba(7, 4, 12, 0.32)";

  for (let second = 0; second <= Math.ceil(data.duration); second += secondsStep) {
    const x = KEYBOARD_WIDTH + second * zoom;
    context.beginPath();
    context.moveTo(x, TIMELINE_HEIGHT);
    context.lineTo(x, height);
    context.stroke();
    context.fillText(`${second}s`, x + 4, TIMELINE_HEIGHT / 2);
  }

  for (const note of data.notes) {
    const x = KEYBOARD_WIDTH + note.time * zoom;
    const row = data.maxMidi - note.midi;
    const y = TIMELINE_HEIGHT + row * NOTE_HEIGHT + 2;
    const noteWidth = Math.max(3, note.duration * zoom);

    context.fillStyle = `rgba(57, 32, 100, ${0.52 + note.velocity * 0.42})`;
    context.strokeStyle = "#07040c";
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(x, y, noteWidth, NOTE_HEIGHT - 4, 4);
    context.fill();
    context.stroke();
  }
}

export default function BrowserPianoRoll({ midiFile }: BrowserPianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(54);
  const pianoRoll = useMidiPianoRoll(midiFile);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !pianoRoll.data) return;

    drawPianoRoll(canvas, pianoRoll.data, zoom);
  }, [pianoRoll.data, zoom]);

  if (!midiFile) {
    return (
      <div className={styles.pianoRollEmpty}>
        Choose a MIDI file to render a real piano roll.
      </div>
    );
  }

  return (
    <section className={styles.browserPianoRoll} aria-label="Uploaded MIDI piano roll">
      <div className={styles.pianoRollToolbar}>
        <span>{pianoRoll.status === "ready" ? pianoRoll.data.fileName : pianoRoll.message}</span>
        <label>
          Zoom
          <input
            aria-label="Piano roll zoom"
            max={150}
            min={24}
            onChange={(event) => setZoom(Number(event.currentTarget.value))}
            type="range"
            value={zoom}
          />
        </label>
      </div>

      <div className={styles.pianoRollScroller}>
        {pianoRoll.status === "ready" ? (
          <canvas
            className={styles.pianoRollCanvas}
            ref={canvasRef}
            role="img"
            aria-label={`${pianoRoll.data.notes.length} MIDI notes across ${pianoRoll.data.duration.toFixed(1)} seconds`}
          />
        ) : (
          <div className={styles.pianoRollEmpty}>{pianoRoll.message}</div>
        )}
      </div>

      <p className={styles.statusLine} role="status">
        {pianoRoll.message}
      </p>
    </section>
  );
}
