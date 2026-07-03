"use client";

import { DragEvent, useRef, useState } from "react";
import { useBrowserMidiPlayback } from "@/hooks/useBrowserMidiPlayback";
import { Button } from "@/components/ui";
import BrowserPianoRoll from "./BrowserPianoRoll";

type MidiDropZoneProps = {
  onStubStatus: (message: string) => void;
};

function isMidiFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".mid") || name.endsWith(".midi");
}

function isSampleFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".wav") || name.endsWith(".mp3");
}

export default function MidiDropZone({ onStubStatus }: MidiDropZoneProps) {
  const midiInputRef = useRef<HTMLInputElement>(null);
  const sampleInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [midiFile, setMidiFile] = useState<File | null>(null);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const playback = useBrowserMidiPlayback();

  function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    const midi = files.find((file) => isMidiFile(file));
    const sample = files.find((file) => isSampleFile(file));

    if (midi) {
      setMidiFile(midi);
    }

    if (sample) {
      setSampleFile(sample);
    }

    if (!midi && !sample) {
      onStubStatus("Drop a .mid file and a .wav/.mp3 one-shot sample.");
      return;
    }

    onStubStatus("Browser playback files are staged locally.");
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <div className="grid gap-3">
      <label
        className={`flex min-h-[92px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-6 text-center transition-[background-color,border-color] duration-150 ease-out ${
          isDragging
            ? "border-[color:var(--ice-accent-border)] bg-[color:var(--ice-accent-soft)]"
            : "border-white/[0.12] bg-white/[0.03] hover:border-white/[0.2] hover:bg-white/[0.05]"
        }`}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          ref={midiInputRef}
          className="sr-only"
          type="file"
          accept=".mid,.midi,audio/midi,audio/x-midi,application/x-midi"
          onChange={(event) => handleFiles(event.currentTarget.files)}
        />
        <input
          ref={sampleInputRef}
          className="sr-only"
          type="file"
          accept=".wav,.mp3,audio/wav,audio/mpeg"
          onChange={(event) => handleFiles(event.currentTarget.files)}
        />
        <span
          aria-hidden="true"
          className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.1] bg-white/[0.05] text-ice-secondary"
        >
          ↧
        </span>
        <span className="text-sm font-medium text-ice-primary">Drop your midis here</span>
      </label>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          className="max-w-[220px] truncate rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1 text-xs text-ice-secondary transition-colors duration-150 ease-out hover:bg-white/[0.08] hover:text-ice-primary"
          onClick={() => midiInputRef.current?.click()}
          type="button"
        >
          {midiFile ? midiFile.name : "Choose MIDI"}
        </button>
        <button
          className="max-w-[220px] truncate rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1 text-xs text-ice-secondary transition-colors duration-150 ease-out hover:bg-white/[0.08] hover:text-ice-primary"
          onClick={() => sampleInputRef.current?.click()}
          type="button"
        >
          {sampleFile ? sampleFile.name : "Choose one-shot"}
        </button>
      </div>

      <div
        aria-label="Browser MIDI playback controls"
        className="flex flex-wrap justify-center gap-2"
      >
        <Button
          disabled={playback.isLoading || playback.isPlaying}
          size="sm"
          type="button"
          onClick={() => playback.play(midiFile, sampleFile)}
        >
          {playback.isLoading ? "Loading..." : playback.isPaused ? "Resume" : "Play"}
        </Button>
        <Button disabled={!playback.isPlaying} size="sm" type="button" onClick={playback.pause}>
          Pause
        </Button>
        <Button
          disabled={playback.status === "idle"}
          size="sm"
          type="button"
          onClick={playback.stop}
        >
          Stop
        </Button>
      </div>

      <p className="min-h-[18px] text-center text-xs text-ice-muted" role="status">
        {playback.message}
      </p>

      <BrowserPianoRoll
        isPlaying={playback.isPlaying}
        midiFile={midiFile}
        playbackPositionSeconds={playback.positionSeconds}
      />
    </div>
  );
}
