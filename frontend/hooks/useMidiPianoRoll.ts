"use client";

import { useEffect, useState } from "react";

type MidiClass = typeof import("@tonejs/midi").Midi;
export type MidiPianoRollSource = File | string | null;

let midiModulePromise: Promise<{ Midi: MidiClass }> | null = null;

export type PianoRollNote = {
  duration: number;
  midi: number;
  name: string;
  time: number;
  velocity: number;
};

export type PianoRollData = {
  duration: number;
  fileName: string;
  maxMidi: number;
  minMidi: number;
  notes: PianoRollNote[];
  trackCount: number;
};

type ParseState =
  | { data: null; message: ""; status: "idle" }
  | { data: null; message: string; status: "loading" | "error" }
  | { data: PianoRollData; message: string; status: "ready" };

function createEmptyState(): ParseState {
  return { data: null, message: "", status: "idle" };
}

function noteRange(notes: PianoRollNote[]) {
  const values = notes.map((note) => note.midi);
  const min = Math.max(0, Math.min(...values) - 2);
  const max = Math.min(127, Math.max(...values) + 2);

  return { max, min };
}

function sourceLabel(source: Exclude<MidiPianoRollSource, null>) {
  if (source instanceof File) {
    return source.name;
  }

  try {
    const url = new URL(source);
    const segment = url.pathname.split("/").filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : "remote MIDI";
  } catch {
    return "remote MIDI";
  }
}

export async function parseMidiArrayBuffer(
  arrayBuffer: ArrayBuffer,
  fileName: string,
): Promise<PianoRollData> {
  midiModulePromise ??= import("@tonejs/midi") as Promise<{ Midi: MidiClass }>;
  const { Midi } = await midiModulePromise;
  const midi = new Midi(arrayBuffer);
  const notes = midi.tracks
    .flatMap((track) => track.notes)
    .map((note) => ({
      duration: Math.max(0.02, note.duration),
      midi: note.midi,
      name: note.name,
      time: note.time,
      velocity: note.velocity,
    }))
    .sort((a, b) => a.time - b.time || a.midi - b.midi);

  if (notes.length === 0) {
    throw new Error("NO_MIDI_NOTES");
  }

  const { max, min } = noteRange(notes);

  return {
    duration: Math.max(...notes.map((note) => note.time + note.duration)),
    fileName,
    maxMidi: max,
    minMidi: min,
    notes,
    trackCount: midi.tracks.length,
  };
}

async function readMidiSource(
  source: Exclude<MidiPianoRollSource, null>,
  signal: AbortSignal,
) {
  if (source instanceof File) {
    return source.arrayBuffer();
  }

  const response = await fetch(source, { signal });
  if (!response.ok) {
    throw new Error(`HTTP_${response.status}`);
  }

  return response.arrayBuffer();
}

export function useMidiPianoRoll(midiSource: MidiPianoRollSource) {
  const [state, setState] = useState<ParseState>(createEmptyState);

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    async function parseMidi() {
      if (!midiSource) {
        setState(createEmptyState());
        return;
      }

      setState({ data: null, message: "Reading MIDI for piano roll...", status: "loading" });

      try {
        const data = await parseMidiArrayBuffer(
          await readMidiSource(midiSource, controller.signal),
          sourceLabel(midiSource),
        );

        if (isCancelled) return;

        setState({
          data,
          message: `${data.notes.length.toLocaleString()} notes visualized.`,
          status: "ready",
        });
      } catch (error) {
        if (isCancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;

        if (error instanceof Error && error.message === "NO_MIDI_NOTES") {
          setState({
            data: null,
            message: "No notes found in this MIDI file.",
            status: "error",
          });
          return;
        }

        setState({
          data: null,
          message: "Could not visualize this MIDI file.",
          status: "error",
        });
      }
    }

    void parseMidi();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [midiSource]);

  return state;
}
