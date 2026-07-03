"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ToneModule = typeof import("tone");
type MidiClass = typeof import("@tonejs/midi").Midi;
type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "stopped" | "error";
export type SoundEnginePreset = "Soft Piano" | "Bell" | "Pluck" | "Pad" | "808";
export type SoundEngineSettings = {
  preset: SoundEnginePreset;
  sampleFile: File | null;
  volume: number;
};

type Instrument = {
  triggerAttackRelease: (note: string, duration: number, time: number, velocity: number) => void;
  releaseAll: () => void;
  dispose: () => void;
};

const SAMPLE_ROOT_NOTE = "C4";
const POSITION_FRAME_MS = 33;

export type BrowserMidiSource = File | string | null;

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function readMidiSource(source: Exclude<BrowserMidiSource, null>) {
  if (source instanceof File) {
    return source.arrayBuffer();
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`HTTP_${response.status}`);
  }

  return response.arrayBuffer();
}

function midiSourceLabel(source: Exclude<BrowserMidiSource, null>) {
  if (source instanceof File) {
    return source.name;
  }

  try {
    const segment = new URL(source).pathname.split("/").filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : "this MIDI";
  } catch {
    return "this MIDI";
  }
}

function synthSettingsForPreset(preset: SoundEnginePreset) {
  switch (preset) {
    case "Bell":
      return {
        envelope: { attack: 0.003, decay: 0.9, release: 1.2, sustain: 0.05 },
        oscillator: { type: "sine" },
      };
    case "Pluck":
      return {
        envelope: { attack: 0.002, decay: 0.18, release: 0.35, sustain: 0.02 },
        oscillator: { type: "triangle" },
      };
    case "Pad":
      return {
        envelope: { attack: 0.35, decay: 0.8, release: 1.8, sustain: 0.55 },
        oscillator: { type: "sawtooth" },
      };
    case "808":
      return {
        envelope: { attack: 0.01, decay: 0.5, release: 0.9, sustain: 0.25 },
        oscillator: { type: "sine" },
      };
    case "Soft Piano":
    default:
      return {
        envelope: { attack: 0.005, decay: 0.3, release: 1, sustain: 0.2 },
        oscillator: { type: "triangle" },
      };
  }
}

export function useBrowserMidiPlayback() {
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [message, setMessage] = useState("");
  const [positionSeconds, setPositionSeconds] = useState(0);
  const instrumentRef = useRef<Instrument | null>(null);
  const sampleUrlRef = useRef<string | null>(null);
  const activeToneRef = useRef<ToneModule | null>(null);
  const positionFrameRef = useRef<number | null>(null);
  const lastPositionUpdateRef = useRef(0);

  const stopPositionLoop = useCallback(() => {
    if (positionFrameRef.current !== null) {
      cancelAnimationFrame(positionFrameRef.current);
      positionFrameRef.current = null;
    }
  }, []);

  const startPositionLoop = useCallback((Tone: ToneModule) => {
    stopPositionLoop();
    lastPositionUpdateRef.current = 0;

    function tick(timestamp: number) {
      if (timestamp - lastPositionUpdateRef.current >= POSITION_FRAME_MS) {
        setPositionSeconds(Tone.Transport.seconds);
        lastPositionUpdateRef.current = timestamp;
      }

      positionFrameRef.current = requestAnimationFrame(tick);
    }

    positionFrameRef.current = requestAnimationFrame(tick);
  }, [stopPositionLoop]);

  const cleanup = useCallback(() => {
    stopPositionLoop();
    const Tone = activeToneRef.current;

    if (Tone) {
      Tone.Transport.stop();
      Tone.Transport.cancel(0);
    }

    instrumentRef.current?.releaseAll();
    instrumentRef.current?.dispose();
    instrumentRef.current = null;

    if (sampleUrlRef.current) {
      URL.revokeObjectURL(sampleUrlRef.current);
      sampleUrlRef.current = null;
    }
  }, [stopPositionLoop]);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    cleanup();
    setPositionSeconds(0);
    setStatus("stopped");
    setMessage("Playback stopped.");
  }, [cleanup]);

  const pause = useCallback(() => {
    const Tone = activeToneRef.current;

    if (!Tone || status !== "playing") return;

    stopPositionLoop();
    setPositionSeconds(Tone.Transport.seconds);
    Tone.Transport.pause();
    instrumentRef.current?.releaseAll();
    setStatus("paused");
    setMessage("Playback paused.");
  }, [status, stopPositionLoop]);

  const play = useCallback(
    async (midiSource: BrowserMidiSource, soundEngine: SoundEngineSettings | null = null) => {
      if (status === "paused" && activeToneRef.current && instrumentRef.current) {
        await activeToneRef.current.start();
        activeToneRef.current.Transport.start();
        startPositionLoop(activeToneRef.current);
        setStatus("playing");
        setMessage("Playback resumed.");
        return;
      }

      if (!midiSource) {
        setStatus("error");
        setMessage("Choose a MIDI file before playback.");
        return;
      }

      try {
        setStatus("loading");
        setMessage("Preparing browser playback...");
        cleanup();
        setPositionSeconds(0);

        const [{ Midi }, Tone] = await Promise.all([
          import("@tonejs/midi") as Promise<{ Midi: MidiClass }>,
          import("tone") as Promise<ToneModule>,
        ]);

        activeToneRef.current = Tone;
        await Tone.start();

        const midi = new Midi(await readMidiSource(midiSource));
        const notes = midi.tracks.flatMap((track) => track.notes);
        const sourceName = midiSourceLabel(midiSource);

        if (notes.length === 0) {
          setStatus("error");
          setMessage("This MIDI file does not contain playable notes.");
          return;
        }

        const volume = Math.min(1, Math.max(0, soundEngine?.volume ?? 1));
        const startPlayback = (instrument: Instrument, sourceLabel: string) => {
          instrumentRef.current = instrument;
          Tone.Transport.stop();
          Tone.Transport.cancel(0);
          Tone.Transport.seconds = 0;
          setPositionSeconds(0);

          for (const note of notes) {
            Tone.Transport.schedule((time) => {
              instrument.triggerAttackRelease(note.name, note.duration, time, note.velocity * volume);
            }, note.time);
          }

          const endTime = Math.max(...notes.map((note) => note.time + note.duration));
          Tone.Transport.scheduleOnce(() => {
            setPositionSeconds(endTime);
            cleanup();
            setStatus("stopped");
            setMessage("Playback finished.");
          }, endTime + 0.1);

          Tone.Transport.start();
          startPositionLoop(Tone);
          setStatus("playing");
          setMessage(`Playing ${sourceName}${sourceLabel}.`);
        };

        const sampleFile = soundEngine?.sampleFile ?? null;

        if (sampleFile) {
          const sampleUrl = URL.createObjectURL(sampleFile);
          sampleUrlRef.current = sampleUrl;

          const sampler: Instrument = new Tone.Sampler({
            urls: {
              [SAMPLE_ROOT_NOTE]: sampleUrl,
            },
            onload: () => {
              startPlayback(sampler, ` with ${sampleFile.name}`);
            },
            onerror: (error) => {
              if (isAbortError(error)) return;
              setStatus("error");
              setMessage("Could not load the one-shot sample.");
            },
          }).toDestination();
        } else {
          const preset = soundEngine?.preset ?? "Soft Piano";
          const synth = new Tone.PolySynth(Tone.Synth, synthSettingsForPreset(preset)).toDestination();

          startPlayback(synth, ` with ${preset}`);
        }
      } catch {
        cleanup();
        setStatus("error");
        setMessage("Browser MIDI playback failed.");
      }
    },
    [cleanup, startPositionLoop, status],
  );

  return {
    isLoading: status === "loading",
    isPlaying: status === "playing",
    isPaused: status === "paused",
    message,
    pause,
    play,
    positionSeconds,
    status,
    stop,
  };
}
