"use client";

import { DragEvent, useRef, useState } from "react";
import { Button, ToastNotification } from "@/components/ui";
import { analyzeTempMidiFiles } from "@/lib/api";

type MidiDropZoneProps = {
  onAnalysisComplete: (tempAnalysisId: string, accessToken: string) => void;
  onAnalysisReset: () => void;
  onStubStatus: (message: string) => void;
  onUnauthorized: () => void;
  token: string | null;
};

const MAX_CUSTOM_MIDI_FILES = 100;

function isMidiFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".mid") || name.endsWith(".midi");
}

export default function MidiDropZone({
  onAnalysisComplete,
  onAnalysisReset,
  onStubStatus,
  onUnauthorized,
  token,
}: MidiDropZoneProps) {
  const midiInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [midiFiles, setMidiFiles] = useState<File[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState<
    "idle" | "analyzing" | "success" | "error"
  >("idle");
  const [analysisMessage, setAnalysisMessage] = useState("");

  function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);

    if (files.length === 0) {
      setAnalysisStatus("error");
      setAnalysisMessage("Choose 1-100 .mid/.midi files.");
      onAnalysisReset();
      return;
    }

    if (files.length > MAX_CUSTOM_MIDI_FILES) {
      setAnalysisStatus("error");
      setAnalysisMessage("Upload no more than 100 MIDI files.");
      setMidiFiles([]);
      onAnalysisReset();
      return;
    }

    if (files.some((file) => !isMidiFile(file))) {
      setAnalysisStatus("error");
      setAnalysisMessage("Only .mid and .midi files are supported.");
      setMidiFiles([]);
      onAnalysisReset();
      return;
    }

    setMidiFiles(files);
    setAnalysisStatus("idle");
    setAnalysisMessage(`${files.length} MIDI file${files.length === 1 ? "" : "s"} ready to analyze.`);
    onAnalysisReset();
    onStubStatus("Custom MIDI files uploaded. Click Analyze to prepare generation.");
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  async function analyzeFiles(files: File[]) {
    if (files.length === 0 || analysisStatus === "analyzing") return;

    try {
      setAnalysisStatus("analyzing");
      setAnalysisMessage("Analyzing uploaded MIDI structure...");
      const response = await analyzeTempMidiFiles(files, token);
      setAnalysisStatus("success");
      setAnalysisMessage(
        `${response.fileCount} MIDI file${response.fileCount === 1 ? "" : "s"} analyzed. Custom generation is ready.`,
      );
      onAnalysisComplete(response.tempAnalysisId, response.accessToken);
    } catch (error) {
      setAnalysisStatus("error");
      if (error instanceof Error && error.message.includes("HTTP_401")) {
        setAnalysisMessage("Your session expired. Please log in again before analyzing MIDI files.");
        onUnauthorized();
      } else {
        setAnalysisMessage("Custom analysis failed. Check the MIDI files and try again.");
      }
      onAnalysisReset();
    }
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
          accept=".mid,.midi,audio/midi,audio/x-midi,application/x-midi"
          className="sr-only"
          multiple
          onChange={(event) => handleFiles(event.currentTarget.files)}
          type="file"
        />
        <span
          aria-hidden="true"
          className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.1] bg-white/[0.05] text-ice-secondary"
        >
          ↧
        </span>
        <span className="text-sm font-medium text-ice-primary">Upload your MIDIs</span>
        <span className="text-xs text-ice-muted">1-100 .mid/.midi files</span>
      </label>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          className="max-w-[220px] truncate rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1 text-xs text-ice-secondary transition-colors duration-150 ease-out hover:bg-white/[0.08] hover:text-ice-primary"
          disabled={analysisStatus === "analyzing"}
          onClick={() => midiInputRef.current?.click()}
          type="button"
        >
          {analysisStatus === "analyzing"
            ? "Analyzing..."
            : midiFiles.length > 0
              ? `${midiFiles.length} MIDI selected`
              : "Choose MIDIs"}
        </button>
        <Button
          disabled={midiFiles.length === 0 || analysisStatus === "analyzing"}
          onClick={() => analyzeFiles(midiFiles)}
          size="sm"
          type="button"
          variant="primary"
        >
          {analysisStatus === "analyzing" ? "Analyzing..." : "Analyze"}
        </Button>
      </div>

      {midiFiles.length > 0 ? (
        <ul
          aria-label="Selected custom MIDI files"
          className="mx-auto grid w-full max-w-md gap-1 text-xs text-ice-muted"
        >
          {midiFiles.map((file) => (
            <li
              className="truncate rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1"
              key={`${file.name}-${file.size}`}
            >
              {file.name}
            </li>
          ))}
        </ul>
      ) : null}

      {analysisMessage ? (
        <ToastNotification
          message={analysisMessage}
          onClose={() => setAnalysisMessage("")}
          type={analysisStatus === "error" ? "error" : analysisStatus === "success" ? "success" : "info"}
        />
      ) : null}
    </div>
  );
}
