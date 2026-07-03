"use client";

import { DragEvent, useRef, useState } from "react";
import { useBrowserMidiPlayback } from "@/hooks/useBrowserMidiPlayback";
import SketchButton from "./SketchButton";
import styles from "./sketchTheme.module.css";

type MidiDropZoneProps = {
  onStubStatus: (message: string) => void;
};

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

  function isMidiFile(file: File) {
    const name = file.name.toLowerCase();
    return name.endsWith(".mid") || name.endsWith(".midi");
  }

  function isSampleFile(file: File) {
    const name = file.name.toLowerCase();
    return name.endsWith(".wav") || name.endsWith(".mp3");
  }

  return (
    <div className={styles.dropZoneStack}>
      <label
        className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ""}`}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          ref={midiInputRef}
          className={styles.visuallyHidden}
          type="file"
          accept=".mid,.midi,audio/midi,audio/x-midi,application/x-midi"
          onChange={(event) => handleFiles(event.currentTarget.files)}
        />
        <input
          ref={sampleInputRef}
          className={styles.visuallyHidden}
          type="file"
          accept=".wav,.mp3,audio/wav,audio/mpeg"
          onChange={(event) => handleFiles(event.currentTarget.files)}
        />
        <span>Drop your midis here</span>
        <span className={styles.uploadGlyph} aria-hidden="true">
          ↧
        </span>
      </label>

      <div className={styles.dropZoneMeta}>
        <button
          className={styles.fileChip}
          type="button"
          onClick={() => midiInputRef.current?.click()}
        >
          {midiFile ? midiFile.name : "Choose MIDI"}
        </button>
        <button
          className={styles.fileChip}
          type="button"
          onClick={() => sampleInputRef.current?.click()}
        >
          {sampleFile ? sampleFile.name : "Choose one-shot"}
        </button>
      </div>

      <div className={styles.playbackControls} aria-label="Browser MIDI playback controls">
        <SketchButton
          disabled={playback.isLoading || playback.isPlaying}
          size="small"
          type="button"
          onClick={() => playback.play(midiFile, sampleFile)}
        >
          {playback.isLoading ? "Loading..." : playback.isPaused ? "Resume" : "Play"}
        </SketchButton>
        <SketchButton
          disabled={!playback.isPlaying}
          size="small"
          type="button"
          onClick={playback.pause}
        >
          Pause
        </SketchButton>
        <SketchButton
          disabled={playback.status === "idle"}
          size="small"
          type="button"
          onClick={playback.stop}
        >
          Stop
        </SketchButton>
      </div>

      <p className={styles.statusLine} role="status">
        {playback.message}
      </p>
    </div>
  );
}
