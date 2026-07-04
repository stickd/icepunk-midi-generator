"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { Select } from "@/components/ui";
import { SoundEnginePreset, SoundEngineSettings } from "@/hooks/useBrowserMidiPlayback";

const soundOptions: SoundEnginePreset[] = ["Soft Piano", "Bell", "Pluck", "Pad", "808"];
const supportedSampleExtensions = [".wav", ".mp3", ".ogg", ".m4a", ".aac", ".flac"];
const supportedSampleTypes = [
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/flac",
  "audio/x-flac",
];

type SoundEngineCardProps = {
  settings: SoundEngineSettings;
  onChange: (settings: SoundEngineSettings) => void;
  isPlaying?: boolean;
  onPlayToggle?: () => void;
  onStop?: () => void;
};

function isSupportedSampleFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return supportedSampleTypes.includes(file.type) || supportedSampleExtensions.some((extension) => lowerName.endsWith(extension));
}

export default function SoundEngineCard({
  settings,
  onChange,
  isPlaying: externalIsPlaying,
  onPlayToggle,
  onStop,
}: SoundEngineCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const [soundMode, setSoundMode] = useState<"stock" | "upload">(
    settings.sampleFile ? "upload" : "stock",
  );
  const [isUploadDragging, setIsUploadDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const isPlaying = externalIsPlaying ?? localIsPlaying;

  const currentBpm = settings.bpm ?? 146;
  const currentPitch = settings.pitch ?? 0;
  const currentOctaves = settings.octaves ?? 0;
  const isLooping = Boolean(settings.isLooping);

  function updatePreset(value: SoundEnginePreset) {
    setUploadStatus("");
    onChange({ ...settings, preset: value, sampleFile: null });
  }

  function updateVolume(value: number) {
    onChange({ ...settings, volume: value });
  }

  function chooseSampleFile(file: File | null) {
    if (file) {
      if (!isSupportedSampleFile(file)) {
        setUploadStatus("Unsupported sample file. Use WAV, MP3, OGG, M4A, AAC, or FLAC.");
        onChange({ ...settings, sampleFile: null });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setSoundMode("upload");
      setUploadStatus(`Selected ${file.name}`);
      onChange({ ...settings, sampleFile: file });
      return;
    }

    setUploadStatus("");
    onChange({ ...settings, sampleFile: null });
  }

  function updateUpload(event: ChangeEvent<HTMLInputElement>) {
    chooseSampleFile(event.target.files?.[0] ?? null);
  }

  function removeSample() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setSoundMode("stock");
    setUploadStatus("");
    onChange({ ...settings, sampleFile: null });
  }

  function updateBpm(delta: number) {
    const nextBpm = Math.max(40, Math.min(300, currentBpm + delta));
    onChange({ ...settings, bpm: nextBpm });
  }

  function updatePitch(delta: number) {
    const nextPitch = Math.max(-12, Math.min(12, currentPitch + delta));
    onChange({ ...settings, pitch: nextPitch });
  }

  function updateOctaves(delta: number) {
    const nextOct = Math.max(-4, Math.min(4, currentOctaves + delta));
    onChange({ ...settings, octaves: nextOct });
  }

  function toggleLoop() {
    onChange({ ...settings, isLooping: !isLooping });
  }

  function handleUploadDragEnter(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsUploadDragging(true);
  }

  function handleUploadDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsUploadDragging(true);
  }

  function handleUploadDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setIsUploadDragging(false);
  }

  function handleUploadDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsUploadDragging(false);
    chooseSampleFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div
      className={`fixed bottom-0 left-1/2 z-50 w-[95%] max-w-[1150px] -translate-x-1/2 transition-transform duration-300 ease-out ${
        isCollapsed ? "translate-y-[calc(100%-26px)]" : "translate-y-0"
      }`}
    >
      {/* Collapse / Expand Tab (Top Handle) */}
      <button
        aria-label={isCollapsed ? "Expand Playback Controls" : "Collapse Playback Controls"}
        className="absolute -top-6 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-t-xl border border-b-0 border-white/15 bg-[rgba(10,14,24,0.92)] px-4 py-1 text-[11px] font-bold tracking-[0.06em] text-ice-muted shadow-[0_-4px_12px_rgba(0,0,0,0.4)] backdrop-blur-xl transition duration-150 ease-out hover:text-ice-primary hover:border-white/30"
        onClick={() => setIsCollapsed((prev) => !prev)}
        type="button"
      >
        <svg
          className={`h-3 w-3 transition-transform duration-300 ${isCollapsed ? "" : "rotate-180"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="uppercase">Playback Controls</span>
      </button>

      {/* Main Floating Master Dock Container */}
      <div className="rounded-t-2xl border border-white/10 bg-[rgba(10,14,24,0.95)] p-3 shadow-[0_-12px_40px_rgba(0,0,0,0.6),0_0_30px_rgba(132,146,255,0.12)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Section 1: Sound Source Switch & Selector */}
          <div className="flex items-center gap-2.5">
            <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5 text-xs">
              <button
                className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                  soundMode === "stock"
                    ? "bg-[color:var(--ice-accent)] text-white shadow"
                    : "text-ice-muted hover:text-ice-primary"
                }`}
                onClick={() => {
                  setSoundMode("stock");
                  removeSample();
                }}
                type="button"
              >
                Stock
              </button>
              <button
                className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                  soundMode === "upload"
                    ? "bg-[color:var(--ice-accent)] text-white shadow"
                    : "text-ice-muted hover:text-ice-primary"
                }`}
                onClick={() => setSoundMode("upload")}
                type="button"
              >
                Upload
              </button>
            </div>

            {soundMode === "stock" ? (
              <Select
                aria-label="Stock Sound Preset"
                className="h-8 min-w-[120px] rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs text-ice-primary hover:border-white/[0.15]"
                onChange={(e) => updatePreset(e.target.value as SoundEnginePreset)}
                value={settings.preset}
              >
                {soundOptions.map((sound) => (
                  <option key={sound} value={sound}>
                    {sound}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  accept="audio/*,.wav,.mp3,.ogg,.m4a,.aac,.flac"
                  className="hidden"
                  onChange={updateUpload}
                  type="file"
                />
                <button
                  className={`flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium text-ice-primary transition hover:bg-white/[0.08] ${
                    isUploadDragging
                      ? "border-[color:var(--ice-accent-border)] bg-[color:var(--ice-accent-soft)]"
                      : "border-white/[0.08] bg-white/[0.04]"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={handleUploadDragEnter}
                  onDragLeave={handleUploadDragLeave}
                  onDragOver={handleUploadDragOver}
                  onDrop={handleUploadDrop}
                  type="button"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {settings.sampleFile ? settings.sampleFile.name : "Choose audio..."}
                </button>
                {settings.sampleFile ? (
                  <button
                    aria-label="Clear uploaded sample"
                    className="grid h-8 w-8 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs text-ice-muted transition hover:border-white/20 hover:text-ice-primary"
                    onClick={removeSample}
                    type="button"
                  >
                    x
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {/* Section 2: Volume & Global Parameters (BPM, Pitch, Octaves) */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Volume */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-ice-muted font-medium">🔊</span>
              <input
                aria-label="Volume"
                className="h-1.5 w-20 cursor-pointer rounded-lg accent-[color:var(--ice-accent)]"
                max={1}
                min={0}
                onChange={(e) => updateVolume(Number(e.target.value))}
                onInput={(e) => updateVolume(Number(e.currentTarget.value))}
                step={0.05}
                type="range"
                value={settings.volume}
              />
              <span className="w-8 font-mono text-[11px] font-semibold text-ice-secondary">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>

            {/* Global BPM */}
            <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ice-muted">BPM</span>
              <button
                className="grid h-5 w-5 place-items-center rounded bg-white/[0.06] text-xs font-bold text-ice-primary hover:bg-white/[0.12]"
                onClick={() => updateBpm(-1)}
                type="button"
              >
                -
              </button>
              <span className="w-8 text-center font-mono font-bold text-white">{currentBpm}</span>
              <button
                className="grid h-5 w-5 place-items-center rounded bg-white/[0.06] text-xs font-bold text-ice-primary hover:bg-white/[0.12]"
                onClick={() => updateBpm(1)}
                type="button"
              >
                +
              </button>
            </div>

            {/* Global Pitch */}
            <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ice-muted">PITCH</span>
              <button
                className="grid h-5 w-5 place-items-center rounded bg-white/[0.06] text-xs font-bold text-ice-primary hover:bg-white/[0.12]"
                onClick={() => updatePitch(-1)}
                type="button"
              >
                -
              </button>
              <span className="w-5 text-center font-mono font-bold text-white">{currentPitch}</span>
              <button
                className="grid h-5 w-5 place-items-center rounded bg-white/[0.06] text-xs font-bold text-ice-primary hover:bg-white/[0.12]"
                onClick={() => updatePitch(1)}
                type="button"
              >
                +
              </button>
            </div>

            {/* Global Octaves */}
            <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ice-muted">OCT</span>
              <button
                className="grid h-5 w-5 place-items-center rounded bg-white/[0.06] text-xs font-bold text-ice-primary hover:bg-white/[0.12]"
                onClick={() => updateOctaves(-1)}
                type="button"
              >
                -
              </button>
              <span className="w-4 text-center font-mono font-bold text-white">{currentOctaves}</span>
              <button
                className="grid h-5 w-5 place-items-center rounded bg-white/[0.06] text-xs font-bold text-ice-primary hover:bg-white/[0.12]"
                onClick={() => updateOctaves(1)}
                type="button"
              >
                +
              </button>
            </div>
          </div>

          {/* Section 3: Master Play, Stop & Loop Transport Controls */}
          <div className="flex items-center gap-1.5">
            <button
              aria-label={isPlaying ? "Stop playback" : "Start playback"}
              className={`flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition duration-150 ease-out ${
                isPlaying
                  ? "border-[color:var(--ice-accent-border)] bg-[color:var(--ice-accent-soft)] text-[color:var(--ice-accent-text)] shadow-[0_0_12px_rgba(132,146,255,0.35)]"
                  : "border-white/[0.08] bg-white/[0.04] text-ice-muted hover:border-white/20 hover:text-ice-primary"
              }`}
              onClick={() => {
                if (onPlayToggle) {
                  onPlayToggle();
                } else {
                  setLocalIsPlaying((prev) => !prev);
                }
              }}
              title={isPlaying ? "Stop master playback" : "Play master playback"}
              type="button"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                {isPlaying ? (
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                ) : (
                  <path d="M8 5v14l11-7z" />
                )}
              </svg>
              <span>{isPlaying ? "Pause" : "Play"}</span>
            </button>

            <button
              aria-label="Stop playback"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-ice-muted transition duration-150 ease-out hover:border-white/20 hover:text-ice-primary"
              onClick={() => {
                if (onStop) {
                  onStop();
                }
                setLocalIsPlaying(false);
              }}
              title="Stop playback"
              type="button"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>

            <button
              aria-label={isLooping ? "Disable MIDI loop" : "Enable infinite MIDI loop"}
              className={`flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition duration-150 ease-out ${
                isLooping
                  ? "border-[color:var(--ice-accent-border)] bg-[color:var(--ice-accent-soft)] text-[color:var(--ice-accent-text)] shadow-[0_0_12px_rgba(132,146,255,0.35)]"
                  : "border-white/[0.08] bg-white/[0.04] text-ice-muted hover:border-white/20 hover:text-ice-primary"
              }`}
              onClick={toggleLoop}
              title={isLooping ? "Loop Active: MIDI previews cycle continuously" : "Enable infinite MIDI loop"}
              type="button"
            >
              <svg className="h-3.5 w-3.5 stroke-current" fill="none" viewBox="0 0 24 24">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
              </svg>
              <span>Loop</span>
            </button>
          </div>
        </div>
        {soundMode === "upload" && uploadStatus ? (
          <p
            className={`mt-2 min-h-[16px] text-center text-[11px] ${
              uploadStatus.startsWith("Unsupported") ? "text-red-300" : "text-ice-muted"
            }`}
            role="status"
          >
            {uploadStatus}
          </p>
        ) : null}
      </div>
    </div>
  );
}
