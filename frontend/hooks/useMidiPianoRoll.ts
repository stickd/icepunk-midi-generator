"use client";

import { useEffect, useState } from "react";

type MidiClass = typeof import("@tonejs/midi").Midi;

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

export function useMidiPianoRoll(midiFile: File | null) {
  const [state, setState] = useState<ParseState>(createEmptyState);

  useEffect(() => {
    let isCancelled = false;

    async function parseMidi() {
      if (!midiFile) {
        setState(createEmptyState());
        return;
      }

      setState({ data: null, message: "Reading MIDI for piano roll...", status: "loading" });

      try {
        const { Midi } = (await import("@tonejs/midi")) as { Midi: MidiClass };
        const midi = new Midi(await midiFile.arrayBuffer());
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

        if (isCancelled) return;

        if (notes.length === 0) {
          setState({
            data: null,
            message: "No notes found in this MIDI file.",
            status: "error",
          });
          return;
        }

        const { max, min } = noteRange(notes);
        const duration = Math.max(...notes.map((note) => note.time + note.duration));

        setState({
          data: {
            duration,
            fileName: midiFile.name,
            maxMidi: max,
            minMidi: min,
            notes,
          },
          message: `${notes.length.toLocaleString()} notes visualized.`,
          status: "ready",
        });
      } catch {
        if (isCancelled) return;

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
    };
  }, [midiFile]);

  return state;
}
