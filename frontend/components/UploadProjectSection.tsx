"use client";

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import { TOKEN_KEY, uploadMidiProject, UploadVisibility } from "@/lib/api";
import { notifyFeedRefresh } from "@/lib/events";
import { Badge, Button, LoadingBar } from "@/components/ui";

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
    <section id="upload" className="relative z-10 px-6 pb-12 pt-8 md:pb-16 md:pt-10">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div className="lg:pt-6">
          <Badge className="mb-4" tone="accent">Project vault</Badge>
          <h2 className="max-w-xl bg-gradient-to-b from-white via-cyan-50 to-cyan-300 bg-clip-text text-4xl font-extrabold leading-tight text-transparent md:text-5xl">
            Upload MIDI Projects
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300/80">
            Store a MIDI idea with a one-shot sample, then keep it ready for the
            next IcePunk workflow.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="relative overflow-hidden rounded-[2rem] border border-cyan-100/15 bg-slate-950/50 p-5 shadow-[0_24px_90px_rgba(8,47,73,0.28)] backdrop-blur-2xl md:p-7"
          aria-live="polite"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(125,211,252,0.13),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(2,6,23,0.06))]" />

          <div className="relative grid gap-4">
            <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr]">
              <label className="grid gap-2 text-sm font-semibold text-cyan-50/85">
                Project Title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Frozen lead sketch"
                  disabled={isUploading}
                  className="h-14 rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-base font-medium text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/55 focus:ring-2 focus:ring-cyan-200/15 disabled:opacity-60"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-cyan-50/85">
                Visibility
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as UploadVisibility)}
                  disabled={isUploading}
                  className="h-14 rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-base font-medium text-white outline-none transition focus:border-cyan-200/55 focus:ring-2 focus:ring-cyan-200/15 disabled:opacity-60"
                >
                  {visibilityOptions.map((option) => (
                    <option key={option} value={option} className="bg-slate-950">
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <input
                  ref={midiInputRef}
                  type="file"
                  accept=".mid,audio/midi,audio/x-midi,application/x-midi"
                  className="sr-only"
                  onChange={(event) => handleInputChange("midi", event)}
                  disabled={isUploading}
                  aria-label="Choose MIDI file"
                />
                <button
                  type="button"
                  onClick={() => midiInputRef.current?.click()}
                  onDragOver={(event) => handleDragOver("midi", event)}
                  onDragLeave={() => setDragSlot(null)}
                  onDrop={(event) => handleDrop("midi", event)}
                  disabled={isUploading}
                  className={`min-h-40 rounded-2xl border border-dashed p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    dragSlot === "midi"
                      ? "border-cyan-200/80 bg-cyan-200/12"
                      : "border-cyan-100/20 bg-white/[0.045] hover:border-cyan-200/45 hover:bg-white/[0.065]"
                  }`}
                >
                  <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-100/20 bg-cyan-100/10 text-lg text-cyan-100">
                    +
                  </span>
                  <span className="block text-sm font-bold text-cyan-50">MIDI File</span>
                  <span className="mt-2 block break-words text-sm leading-6 text-slate-300/75">
                    {fileLabel(midiFile, "Drop .mid here or click to choose")}
                  </span>
                </button>
              </div>

              <div className="grid gap-2">
                <input
                  ref={sampleInputRef}
                  type="file"
                  accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
                  className="sr-only"
                  onChange={(event) => handleInputChange("sample", event)}
                  disabled={isUploading}
                  aria-label="Choose sample file"
                />
                <button
                  type="button"
                  onClick={() => sampleInputRef.current?.click()}
                  onDragOver={(event) => handleDragOver("sample", event)}
                  onDragLeave={() => setDragSlot(null)}
                  onDrop={(event) => handleDrop("sample", event)}
                  disabled={isUploading}
                  className={`min-h-40 rounded-2xl border border-dashed p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    dragSlot === "sample"
                      ? "border-cyan-200/80 bg-cyan-200/12"
                      : "border-cyan-100/20 bg-white/[0.045] hover:border-cyan-200/45 hover:bg-white/[0.065]"
                  }`}
                >
                  <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-100/20 bg-cyan-100/10 text-lg text-cyan-100">
                    +
                  </span>
                  <span className="block text-sm font-bold text-cyan-50">One-Shot Sample</span>
                  <span className="mt-2 block break-words text-sm leading-6 text-slate-300/75">
                    {fileLabel(sampleFile, "Drop .mp3 or .wav here or click to choose")}
                  </span>
                </button>
              </div>
            </div>

            {isUploading && (
              <div className="rounded-2xl border border-cyan-100/15 bg-black/15 p-3">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/70">
                  <span>Uploading</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <LoadingBar value={progress} className="h-full" />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={isUploading}
              variant="primary"
              size="lg"
              className="mt-2 w-full overflow-hidden font-black"
            >
              {isUploading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/25 border-t-slate-950" />
              )}
              {isUploading ? "Uploading..." : "Upload Project"}
            </Button>

            {status === "success" && (
              <p className="rounded-2xl border border-cyan-200/20 bg-cyan-200/10 px-4 py-3 text-center text-sm font-semibold text-cyan-50">
                {message}
              </p>
            )}

            {status === "error" && (
              <p className="rounded-2xl border border-rose-200/20 bg-rose-300/10 px-4 py-3 text-center text-sm font-semibold text-rose-100">
                {message}
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
