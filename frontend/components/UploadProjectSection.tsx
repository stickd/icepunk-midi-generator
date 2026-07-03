"use client";

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import { TOKEN_KEY, uploadMidiProject, UploadVisibility } from "@/lib/api";
import { notifyFeedRefresh } from "@/lib/events";
import { Badge, Button, FieldLabel, Input, LoadingBar, Select } from "@/components/ui";

type UploadStatus = "idle" | "uploading" | "success" | "error";
type UploadSlot = "midi" | "sample";

const MAX_MIDI_SIZE = 2 * 1024 * 1024;
const MAX_SAMPLE_SIZE = 20 * 1024 * 1024;
const visibilityOptions: UploadVisibility[] = ["PRIVATE", "UNLISTED", "PUBLIC"];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileLabel(file: File | null, fallback: string) {
  if (!file) return fallback;

  return `${file.name} · ${formatBytes(file.size)}`;
}

function validateMidiFile(file: File | null) {
  if (!file) return "Choose a .mid file.";
  if (!file.name.toLowerCase().endsWith(".mid")) return "MIDI file must use .mid extension.";
  if (file.size > MAX_MIDI_SIZE) return "MIDI file must be 2 MB or smaller.";

  return "";
}

function validateSampleFile(file: File | null) {
  if (!file) return "Choose a .mp3 or .wav sample.";

  const name = file.name.toLowerCase();
  if (!name.endsWith(".mp3") && !name.endsWith(".wav")) {
    return "Sample must use .mp3 or .wav extension.";
  }

  if (file.size > MAX_SAMPLE_SIZE) return "Sample must be 20 MB or smaller.";

  return "";
}

function statusFromError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("HTTP_401") || message.includes("HTTP_403")) {
    return "Please log in again before uploading.";
  }

  if (message.includes("HTTP_400")) {
    return "Check the files and title, then try again.";
  }

  if (message.includes("HTTP_504")) {
    return "Storage timed out. Try again in a moment.";
  }

  return "Upload failed. Please try again.";
}

export default function UploadProjectSection() {
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<UploadVisibility>("PRIVATE");
  const [midiFile, setMidiFile] = useState<File | null>(null);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [dragSlot, setDragSlot] = useState<UploadSlot | null>(null);

  const midiInputRef = useRef<HTMLInputElement>(null);
  const sampleInputRef = useRef<HTMLInputElement>(null);

  const isUploading = status === "uploading";

  function setFile(slot: UploadSlot, file: File | null) {
    if (slot === "midi") {
      setMidiFile(file);
    } else {
      setSampleFile(file);
    }

    setStatus("idle");
    setMessage("");
  }

  function handleInputChange(slot: UploadSlot, event: ChangeEvent<HTMLInputElement>) {
    setFile(slot, event.target.files?.[0] ?? null);
  }

  function handleDragOver(slot: UploadSlot, event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!isUploading) setDragSlot(slot);
  }

  function handleDrop(slot: UploadSlot, event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragSlot(null);
    if (isUploading) return;

    setFile(slot, event.dataTransfer.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUploading) return;

    const token = localStorage.getItem(TOKEN_KEY);
    const normalizedTitle = title.trim();
    const midiError = validateMidiFile(midiFile);
    const sampleError = validateSampleFile(sampleFile);

    setStatus("idle");
    setMessage("");

    if (!token) {
      setStatus("error");
      setMessage("Log in to upload MIDI projects.");
      return;
    }

    if (!normalizedTitle) {
      setStatus("error");
      setMessage("Project title is required.");
      return;
    }

    if (normalizedTitle.length > 120) {
      setStatus("error");
      setMessage("Project title must be 120 characters or less.");
      return;
    }

    if (midiError || sampleError || !midiFile || !sampleFile) {
      setStatus("error");
      setMessage(midiError || sampleError);
      return;
    }

    setStatus("uploading");
    setProgress(0);

    try {
      const response = await uploadMidiProject({
        title: normalizedTitle,
        visibility,
        midiFile,
        sampleFile,
        token,
        onProgress: setProgress,
      });

      setStatus("success");
      setMessage(`Uploaded "${response.title}" successfully.`);
      notifyFeedRefresh();
      setTitle("");
      setMidiFile(null);
      setSampleFile(null);
      setProgress(100);

      if (midiInputRef.current) midiInputRef.current.value = "";
      if (sampleInputRef.current) sampleInputRef.current.value = "";
    } catch (error) {
      setStatus("error");
      setMessage(statusFromError(error));
    }
  }

  return (
    <section className="relative z-10 px-6 pb-12 pt-8 md:pb-16 md:pt-10" id="upload">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div className="lg:pt-6">
          <Badge className="mb-4" tone="accent">Project vault</Badge>
          <h2 className="max-w-xl text-4xl font-medium leading-tight tracking-[-0.01em] text-ice-primary md:text-5xl">
            Upload MIDI Projects
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-ice-secondary">
            Store a MIDI idea with a one-shot sample, then keep it ready for the
            next IcePunk workflow.
          </p>
        </div>

        <form
          aria-live="polite"
          className="relative overflow-hidden rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-[color:var(--ice-surface)] p-5 shadow-[var(--ice-shadow-card)] backdrop-blur-2xl md:p-7"
          onSubmit={handleSubmit}
        >
          <div className="relative grid gap-4">
            <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr]">
              <FieldLabel>
                Project Title
                <Input
                  className="h-14 text-base"
                  disabled={isUploading}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Frozen lead sketch"
                  value={title}
                />
              </FieldLabel>

              <FieldLabel>
                Visibility
                <Select
                  className="h-14 text-base"
                  disabled={isUploading}
                  onChange={(event) => setVisibility(event.target.value as UploadVisibility)}
                  value={visibility}
                >
                  {visibilityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </FieldLabel>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <input
                  accept=".mid,audio/midi,audio/x-midi,application/x-midi"
                  aria-label="Choose MIDI file"
                  className="sr-only"
                  disabled={isUploading}
                  onChange={(event) => handleInputChange("midi", event)}
                  ref={midiInputRef}
                  type="file"
                />
                <button
                  className={`min-h-40 rounded-[var(--ice-radius-card)] border border-dashed p-5 text-left transition-[background-color,border-color] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60 ${
                    dragSlot === "midi"
                      ? "border-[color:var(--ice-accent)] bg-[color:var(--ice-accent-soft)]"
                      : "border-white/[0.12] bg-white/[0.03] hover:border-white/[0.2] hover:bg-white/[0.05]"
                  }`}
                  disabled={isUploading}
                  onClick={() => midiInputRef.current?.click()}
                  onDragLeave={() => setDragSlot(null)}
                  onDragOver={(event) => handleDragOver("midi", event)}
                  onDrop={(event) => handleDrop("midi", event)}
                  type="button"
                >
                  <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--ice-accent-border)] bg-[color:var(--ice-accent-soft)] text-lg text-[color:var(--ice-accent-text)]">
                    +
                  </span>
                  <span className="block text-sm font-semibold text-ice-primary">MIDI File</span>
                  <span className="mt-2 block break-words text-sm leading-6 text-ice-secondary">
                    {fileLabel(midiFile, "Drop .mid here or click to choose")}
                  </span>
                </button>
              </div>

              <div className="grid gap-2">
                <input
                  accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
                  aria-label="Choose sample file"
                  className="sr-only"
                  disabled={isUploading}
                  onChange={(event) => handleInputChange("sample", event)}
                  ref={sampleInputRef}
                  type="file"
                />
                <button
                  className={`min-h-40 rounded-[var(--ice-radius-card)] border border-dashed p-5 text-left transition-[background-color,border-color] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60 ${
                    dragSlot === "sample"
                      ? "border-[color:var(--ice-accent)] bg-[color:var(--ice-accent-soft)]"
                      : "border-white/[0.12] bg-white/[0.03] hover:border-white/[0.2] hover:bg-white/[0.05]"
                  }`}
                  disabled={isUploading}
                  onClick={() => sampleInputRef.current?.click()}
                  onDragLeave={() => setDragSlot(null)}
                  onDragOver={(event) => handleDragOver("sample", event)}
                  onDrop={(event) => handleDrop("sample", event)}
                  type="button"
                >
                  <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--ice-accent-border)] bg-[color:var(--ice-accent-soft)] text-lg text-[color:var(--ice-accent-text)]">
                    +
                  </span>
                  <span className="block text-sm font-semibold text-ice-primary">One-Shot Sample</span>
                  <span className="mt-2 block break-words text-sm leading-6 text-ice-secondary">
                    {fileLabel(sampleFile, "Drop .mp3 or .wav here or click to choose")}
                  </span>
                </button>
              </div>
            </div>

            {isUploading && (
              <div className="rounded-xl border border-white/[0.08] bg-black/15 p-3">
                <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-[0.08em] text-ice-muted">
                  <span>Uploading</span>
                  <span>{progress}%</span>
                </div>
                <LoadingBar value={progress} />
              </div>
            )}

            <Button
              className="mt-2 w-full"
              disabled={isUploading}
              size="lg"
              type="submit"
              variant="primary"
            >
              {isUploading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
              )}
              {isUploading ? "Uploading..." : "Upload Project"}
            </Button>

            {status === "success" && (
              <p className="rounded-xl border border-[color:var(--ice-success)]/25 bg-[color:var(--ice-success)]/10 px-4 py-3 text-center text-sm font-medium text-[color:var(--ice-success)]">
                {message}
              </p>
            )}

            {status === "error" && (
              <p className="rounded-xl border border-[color:var(--ice-error)]/25 bg-[color:var(--ice-error)]/10 px-4 py-3 text-center text-sm font-medium text-[color:var(--ice-error)]">
                {message}
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
