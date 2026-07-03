"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ToneModule = typeof import("tone");
type MidiClass = typeof import("@tonejs/midi").Midi;
type ToneSampler = InstanceType<ToneModule["Sampler"]>;
type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "stopped" | "error";

const SAMPLE_ROOT_NOTE = "C4";

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useBrowserMidiPlayback() {
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [message, setMessage] = useState("");
  const samplerRef = useRef<ToneSampler | null>(null);
  const sampleUrlRef = useRef<string | null>(null);
  const activeToneRef = useRef<ToneModule | null>(null);

  const cleanup = useCallback(() => {
    const Tone = activeToneRef.current;

    if (Tone) {
      Tone.Transport.stop();
      Tone.Transport.cancel(0);
    }

    samplerRef.current?.releaseAll();
    samplerRef.current?.dispose();
    samplerRef.current = null;

    if (sampleUrlRef.current) {
      URL.revokeObjectURL(sampleUrlRef.current);
      sampleUrlRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    cleanup();
    setStatus("stopped");
    setMessage("Playback stopped.");
  }, [cleanup]);

  const pause = useCallback(() => {
    const Tone = activeToneRef.current;

    if (!Tone || status !== "playing") return;

    Tone.Transport.pause();
    samplerRef.current?.releaseAll();
    setStatus("paused");
    setMessage("Playback paused.");
  }, [status]);

  const play = useCallback(
    async (midiFile: File | null, sampleFile: File | null) => {
      if (status === "paused" && activeToneRef.current && samplerRef.current) {
        await activeToneRef.current.start();
        activeToneRef.current.Transport.start();
        setStatus("playing");
        setMessage("Playback resumed.");
        return;
      }

      if (!midiFile) {
        setStatus("error");
        setMessage("Choose a MIDI file before playback.");
        return;
      }

      if (!sampleFile) {
        setStatus("error");
        setMessage("Choose a one-shot sample before playback.");
        return;
      }

      try {
        setStatus("loading");
        setMessage("Preparing browser playback...");
        cleanup();

        const [{ Midi }, Tone] = await Promise.all([
          import("@tonejs/midi") as Promise<{ Midi: MidiClass }>,
          import("tone") as Promise<ToneModule>,
        ]);

        activeToneRef.current = Tone;
        await Tone.start();

        const midi = new Midi(await midiFile.arrayBuffer());
        const notes = midi.tracks.flatMap((track) => track.notes);

        if (notes.length === 0) {
          setStatus("error");
          setMessage("This MIDI file does not contain playable notes.");
          return;
        }

        const sampleUrl = URL.createObjectURL(sampleFile);
        sampleUrlRef.current = sampleUrl;

        const sampler = new Tone.Sampler({
          urls: {
            [SAMPLE_ROOT_NOTE]: sampleUrl,
          },
          onload: () => {
            Tone.Transport.stop();
            Tone.Transport.cancel(0);
            Tone.Transport.seconds = 0;

            for (const note of notes) {
              Tone.Transport.schedule((time) => {
                sampler.triggerAttackRelease(
                  note.name,
                  note.duration,
                  time,
                  note.velocity,
                );
              }, note.time);
            }

            const endTime = Math.max(...notes.map((note) => note.time + note.duration));
            Tone.Transport.scheduleOnce(() => {
              cleanup();
              setStatus("stopped");
              setMessage("Playback finished.");
            }, endTime + 0.1);

            Tone.Transport.start();
            setStatus("playing");
            setMessage(`Playing ${midiFile.name} with ${sampleFile.name}.`);
          },
          onerror: (error) => {
            if (isAbortError(error)) return;
            setStatus("error");
            setMessage("Could not load the one-shot sample.");
          },
        }).toDestination();

        samplerRef.current = sampler;
      } catch {
        cleanup();
        setStatus("error");
        setMessage("Browser MIDI playback failed.");
      }
    },
    [cleanup, status],
  );

  return {
    isLoading: status === "loading",
    isPlaying: status === "playing",
    isPaused: status === "paused",
    message,
    pause,
    play,
    status,
    stop,
  };
}
