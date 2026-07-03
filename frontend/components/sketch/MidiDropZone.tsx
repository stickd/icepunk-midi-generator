"use client";

import { DragEvent, useRef, useState } from "react";
import { useBrowserMidiPlayback } from "@/hooks/useBrowserMidiPlayback";
import { analyzeTempMidiFiles } from "@/lib/api";
import BrowserPianoRoll from "./BrowserPianoRoll";
import SketchButton from "./SketchButton";
import styles from "./sketchTheme.module.css";

type MidiDropZoneProps = {
  onAnalysisComplete: (tempAnalysisId: string) => void;
  onAnalysisReset: () => void;
  onStubStatus: (message: string) => void;
};

const MAX_CUSTOM_MIDI_FILES = 8;

export default function MidiDropZone({
  onAnalysisComplete,
  onAnalysisReset,
  onStubStatus,
}: MidiDropZoneProps) {
  const midiInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [midiFiles, setMidiFiles] = useState<File[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "analyzing" | "success" | "error">("idle");
  const [analysisMessage, setAnalysisMessage] = useState("");
  const playback = useBrowserMidiPlayback();
  const previewFile = midiFiles[0] ?? null;

  function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).filter(isMidiFile).slice(0, MAX_CUSTOM_MIDI_FILES);

    if (files.length === 0) {
      setAnalysisStatus("error");
      setAnalysisMessage("Drop 1-8 .mid/.midi files.");
      onAnalysisReset();
      return;
    }

    setMidiFiles(files);
    setAnalysisStatus("idle");
    setAnalysisMessage(`${files.length} MIDI file${files.length === 1 ? "" : "s"} staged for custom analysis.`);
    onAnalysisReset();
    onStubStatus("Custom MIDI files are staged. Analyze them before generating.");
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

  async function analyzeFiles() {
    if (midiFiles.length === 0) {
      setAnalysisStatus("error");
      setAnalysisMessage("Choose at least one MIDI file first.");
      return;
    }

    try {
      setAnalysisStatus("analyzing");
      setAnalysisMessage("Analyzing uploaded MIDI structure...");
      const response = await analyzeTempMidiFiles(midiFiles);
      setAnalysisStatus("success");
      setAnalysisMessage(`${response.fileCount} MIDI file${response.fileCount === 1 ? "" : "s"} analyzed. Custom generation is ready.`);
      onAnalysisComplete(response.tempAnalysisId);
    } catch (error) {
      setAnalysisStatus("error");
      setAnalysisMessage(error instanceof Error ? "Custom analysis failed. Check the MIDI files and try again." : "Custom analysis failed.");
      onAnalysisReset();
    }
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
          multiple
          accept=".mid,.midi,audio/midi,audio/x-midi,application/x-midi"
          onChange={(event) => handleFiles(event.currentTarget.files)}
        />
        <span>Upload your midis</span>
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
          {midiFiles.length > 0 ? `${midiFiles.length} MIDI selected` : "Choose 1-8 MIDIs"}
        </button>
        <SketchButton
          disabled={analysisStatus === "analyzing" || midiFiles.length === 0}
          size="small"
          type="button"
          onClick={analyzeFiles}
        >
          {analysisStatus === "analyzing" ? "Analyzing..." : "Analyze MIDIs"}
        </SketchButton>
      </div>

      {midiFiles.length > 0 ? (
        <ul className={styles.customMidiList} aria-label="Selected custom MIDI files">
          {midiFiles.map((file) => (
            <li key={`${file.name}-${file.size}`}>{file.name}</li>
          ))}
        </ul>
      ) : null}

      <div className={styles.playbackControls} aria-label="Browser MIDI playback controls">
        <SketchButton
          disabled={playback.isLoading || playback.isPlaying}
          size="small"
          type="button"
          onClick={() => playback.play(previewFile, null)}
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
        {analysisMessage || playback.message}
      </p>

      <BrowserPianoRoll
        isPlaying={playback.isPlaying}
        midiFile={previewFile}
        playbackPositionSeconds={playback.positionSeconds}
      />
    </div>
  );
}
