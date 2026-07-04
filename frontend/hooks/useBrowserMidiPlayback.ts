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
  bpm?: number;
  pitch?: number;
  octaves?: number;
  isLooping?: boolean;
};

type Instrument = {
  triggerAttackRelease: (note: string, duration: number, time: number, velocity: number) => void;
  releaseAll: () => void;
  connect: (destination: import("tone").InputNode, outputNum?: number, inputNum?: number) => unknown;
  dispose: () => void;
};

type NormalizedSoundEngineSettings = Required<SoundEngineSettings>;

const SAMPLE_ROOT_NOTE = "C4";
const POSITION_FRAME_MS = 33;
const DEFAULT_BPM = 146;

export type BrowserMidiSource = File | string | null;

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function readMidiSource(source: Exclude<BrowserMidiSource, null>, signal?: AbortSignal) {
  if (source instanceof File) {
    return source.arrayBuffer();
  }

  const response = await fetch(source, { signal });
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
      } as const;
    case "Pluck":
      return {
        envelope: { attack: 0.002, decay: 0.18, release: 0.35, sustain: 0.02 },
        oscillator: { type: "triangle" },
      } as const;
    case "Pad":
      return {
        envelope: { attack: 0.35, decay: 0.8, release: 1.8, sustain: 0.55 },
        oscillator: { type: "sawtooth" },
      } as const;
    case "808":
      return {
        envelope: { attack: 0.01, decay: 0.5, release: 0.9, sustain: 0.25 },
        oscillator: { type: "sine" },
      } as const;
    case "Soft Piano":
    default:
      return {
        envelope: { attack: 0.005, decay: 0.3, release: 1, sustain: 0.2 },
        oscillator: { type: "triangle" },
      } as const;
  }
}

function normalizeSettings(settings: SoundEngineSettings | null | undefined): NormalizedSoundEngineSettings {
  return {
    preset: settings?.preset ?? "Soft Piano",
    sampleFile: settings?.sampleFile ?? null,
    volume: Math.min(1, Math.max(0, settings?.volume ?? 1)),
    bpm: Math.max(40, Math.min(300, settings?.bpm ?? DEFAULT_BPM)),
    pitch: Math.max(-12, Math.min(12, settings?.pitch ?? 0)),
    octaves: Math.max(-4, Math.min(4, settings?.octaves ?? 0)),
    isLooping: Boolean(settings?.isLooping),
  };
}

function soundSourceKey(settings: NormalizedSoundEngineSettings) {
  return settings.sampleFile ? `sample:${settings.sampleFile.name}:${settings.sampleFile.size}:${settings.sampleFile.lastModified}` : `preset:${settings.preset}`;
}

export function useBrowserMidiPlayback() {
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [message, setMessage] = useState("");
  const [positionSeconds, setPositionSeconds] = useState(0);
  const instrumentRef = useRef<Instrument | null>(null);
  const pendingInstrumentRef = useRef<Instrument | null>(null);
  const gainRef = useRef<import("tone").Gain | null>(null);
  const sampleUrlRef = useRef<string | null>(null);
  const activeToneRef = useRef<ToneModule | null>(null);
  const activeSettingsRef = useRef<NormalizedSoundEngineSettings>(normalizeSettings(null));
  const soundSourceKeyRef = useRef(soundSourceKey(normalizeSettings(null)));
  const playbackIdRef = useRef(0);
  const instrumentSwapIdRef = useRef(0);
  const loopEndRef = useRef<string | null>(null);
  const positionFrameRef = useRef<number | null>(null);
  const playAbortControllerRef = useRef<AbortController | null>(null);
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
    playbackIdRef.current += 1;
    instrumentSwapIdRef.current += 1;
    playAbortControllerRef.current?.abort();
    playAbortControllerRef.current = null;
    stopPositionLoop();
    const Tone = activeToneRef.current;

    if (Tone) {
      Tone.Transport.stop();
      Tone.Transport.cancel(0);
    }

    instrumentRef.current?.releaseAll();
    instrumentRef.current?.dispose();
    instrumentRef.current = null;
    pendingInstrumentRef.current?.dispose();
    pendingInstrumentRef.current = null;
    gainRef.current?.dispose();
    gainRef.current = null;
    loopEndRef.current = null;

    if (sampleUrlRef.current) {
      URL.revokeObjectURL(sampleUrlRef.current);
      sampleUrlRef.current = null;
    }
  }, [stopPositionLoop]);

  const replaceInstrument = useCallback((Tone: ToneModule, settings: NormalizedSoundEngineSettings) => {
    const gain = gainRef.current;
    if (!gain) return;

    const swapId = instrumentSwapIdRef.current + 1;
    instrumentSwapIdRef.current = swapId;
    const previousInstrument = instrumentRef.current;
    const previousSampleUrl = sampleUrlRef.current;

    function finishSwap(nextInstrument: Instrument, nextSampleUrl: string | null) {
      if (instrumentSwapIdRef.current !== swapId) {
        nextInstrument.dispose();
        if (nextSampleUrl) URL.revokeObjectURL(nextSampleUrl);
        return;
      }

      if (pendingInstrumentRef.current === nextInstrument) {
        pendingInstrumentRef.current = null;
      }
      previousInstrument?.releaseAll();
      previousInstrument?.dispose();
      if (previousSampleUrl && previousSampleUrl !== nextSampleUrl) {
        URL.revokeObjectURL(previousSampleUrl);
      }

      const currentGain = gainRef.current;
      if (!currentGain) return;

      nextInstrument.connect(currentGain);
      instrumentRef.current = nextInstrument;
      sampleUrlRef.current = nextSampleUrl;
      soundSourceKeyRef.current = soundSourceKey(settings);
    }

    if (settings.sampleFile) {
      const sampleUrl = URL.createObjectURL(settings.sampleFile);
      const sampler: Instrument = new Tone.Sampler({
        urls: {
          [SAMPLE_ROOT_NOTE]: sampleUrl,
        },
        onload: () => {
          finishSwap(sampler, sampleUrl);
        },
        onerror: (error) => {
          if (isAbortError(error)) return;
          if (pendingInstrumentRef.current === sampler) {
            pendingInstrumentRef.current = null;
          }
          sampler.dispose();
          URL.revokeObjectURL(sampleUrl);
          if (instrumentSwapIdRef.current !== swapId) return;
          setStatus("error");
          setMessage("Could not load the one-shot sample.");
        },
      });
      pendingInstrumentRef.current = sampler;
      return;
    }

    const synth = new Tone.PolySynth(Tone.Synth, synthSettingsForPreset(settings.preset));
    finishSwap(synth, null);
  }, []);

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

  const updateSettings = useCallback((settings: SoundEngineSettings | null) => {
    const nextSettings = normalizeSettings(settings);
    activeSettingsRef.current = nextSettings;

    const Tone = activeToneRef.current;
    if (!Tone) return;

    const now = Tone.now();
    Tone.Transport.bpm.cancelScheduledValues(now);
    Tone.Transport.bpm.setValueAtTime(nextSettings.bpm, now);
    Tone.Transport.loop = nextSettings.isLooping;
    Tone.Transport.loopStart = 0;
    if (loopEndRef.current) {
      Tone.Transport.loopEnd = loopEndRef.current;
    }

    const gain = gainRef.current;
    if (gain) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(nextSettings.volume, now);
    }

    if (instrumentRef.current && soundSourceKeyRef.current !== soundSourceKey(nextSettings)) {
      replaceInstrument(Tone, nextSettings);
    }
  }, [replaceInstrument]);

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
        const playbackId = playbackIdRef.current + 1;
        playbackIdRef.current = playbackId;
        const controller = new AbortController();
        playAbortControllerRef.current = controller;
        const isCurrentPlayback = () => playbackIdRef.current === playbackId && !controller.signal.aborted;
        setPositionSeconds(0);

        const [{ Midi }, Tone] = await Promise.all([
          import("@tonejs/midi") as Promise<{ Midi: MidiClass }>,
          import("tone") as Promise<ToneModule>,
        ]);

        if (!isCurrentPlayback()) return;

        activeToneRef.current = Tone;
        await Tone.start();
        if (!isCurrentPlayback()) return;

        const midiBuffer = await readMidiSource(midiSource, controller.signal);
        if (!isCurrentPlayback()) return;

        const midi = new Midi(midiBuffer);
        if (!isCurrentPlayback()) return;
        const notes = midi.tracks.flatMap((track) => track.notes);
        const sourceName = midiSourceLabel(midiSource);
        const playbackSettings = normalizeSettings(soundEngine);
        const initialSoundSourceKey = soundSourceKey(playbackSettings);
        const sourceBpm = midi.header.tempos[0]?.bpm ?? playbackSettings.bpm;

        if (notes.length === 0) {
          setStatus("error");
          setMessage("This MIDI file does not contain playable notes.");
          return;
        }

        activeSettingsRef.current = playbackSettings;
        soundSourceKeyRef.current = initialSoundSourceKey;
        Tone.Transport.bpm.value = playbackSettings.bpm;

        const startPlayback = (instrument: Instrument, sourceLabel: string) => {
          if (playbackIdRef.current !== playbackId) {
            if (pendingInstrumentRef.current === instrument) {
              pendingInstrumentRef.current = null;
            }
            instrument.dispose();
            return;
          }

          if (pendingInstrumentRef.current === instrument) {
            pendingInstrumentRef.current = null;
          }
          const gain = new Tone.Gain(playbackSettings.volume).toDestination();
          instrument.connect(gain);
          instrumentRef.current = instrument;
          gainRef.current = gain;
          Tone.Transport.stop();
          Tone.Transport.cancel(0);
          Tone.Transport.seconds = 0;
          setPositionSeconds(0);

          for (const note of notes) {
            const startBeats = note.time * sourceBpm / 60;
            const durationBeats = Math.max(0.02, note.duration * sourceBpm / 60);
            Tone.Transport.schedule((time) => {
              const settings = activeSettingsRef.current;
              const instrument = instrumentRef.current;
              if (!instrument) return;

              const transpose = settings.pitch + settings.octaves * 12;
              const midiNote = Math.max(0, Math.min(127, note.midi + transpose));
              const noteName = Tone.Frequency(midiNote, "midi").toNote();
              const durationSeconds = durationBeats * 60 / settings.bpm;
              instrument.triggerAttackRelease(noteName, durationSeconds, time, note.velocity);
            }, `${Math.round(startBeats * Tone.Transport.PPQ)}i`);
          }

          const endTime = Math.max(...notes.map((note) => note.time + note.duration));
          const endTicks = Math.max(1, Math.ceil((endTime * sourceBpm / 60) * Tone.Transport.PPQ));
          loopEndRef.current = `${endTicks + Math.round(Tone.Transport.PPQ / 6)}i`;
          Tone.Transport.loop = playbackSettings.isLooping;
          Tone.Transport.loopStart = 0;
          Tone.Transport.loopEnd = loopEndRef.current;
          Tone.Transport.schedule((time) => {
            if (activeSettingsRef.current.isLooping) return;
            Tone.Transport.stop(time);
            setPositionSeconds(endTime);
            setStatus("stopped");
            setMessage("Playback finished.");
            window.setTimeout(() => {
              if (!activeSettingsRef.current.isLooping) {
                cleanup();
              }
            }, 0);
          }, `${endTicks}i`);

          Tone.Transport.start();
          startPositionLoop(Tone);
          setStatus("playing");
          setMessage(`Playing ${sourceName}${sourceLabel}.`);
        };

        if (playAbortControllerRef.current === controller) {
          playAbortControllerRef.current = null;
        }

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
              if (pendingInstrumentRef.current === sampler) {
                pendingInstrumentRef.current = null;
              }
              sampler.dispose();
              URL.revokeObjectURL(sampleUrl);
              if (playbackIdRef.current !== playbackId) return;
              setStatus("error");
              setMessage("Could not load the one-shot sample.");
            },
          });
          pendingInstrumentRef.current = sampler;
        } else {
          const preset = soundEngine?.preset ?? "Soft Piano";
          const synth = new Tone.PolySynth(Tone.Synth, synthSettingsForPreset(preset));

          startPlayback(synth, ` with ${preset}`);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (playAbortControllerRef.current?.signal.aborted) return;
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
    updateSettings,
  };
}
