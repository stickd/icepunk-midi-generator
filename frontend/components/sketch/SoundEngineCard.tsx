"use client";

import { ChangeEvent } from "react";
import { Card, FieldLabel, Select } from "@/components/ui";
import { SoundEnginePreset, SoundEngineSettings } from "@/hooks/useBrowserMidiPlayback";

const soundOptions: SoundEnginePreset[] = ["Soft Piano", "Bell", "Pluck", "Pad", "808"];

type SoundEngineCardProps = {
  settings: SoundEngineSettings;
  onChange: (settings: SoundEngineSettings) => void;
};

export default function SoundEngineCard({ settings, onChange }: SoundEngineCardProps) {
  const currentSound = settings.sampleFile?.name ?? settings.preset;

  function updatePreset(value: SoundEnginePreset) {
    onChange({ ...settings, preset: value });
  }

  function updateVolume(value: number) {
    onChange({ ...settings, volume: value });
  }

  function updateUpload(event: ChangeEvent<HTMLInputElement>) {
    onChange({ ...settings, sampleFile: event.target.files?.[0] ?? null });
  }

  return (
    <Card className="grid gap-4 p-4 lg:w-[240px]">
      <div className="relative">
        <h2 className="text-base font-semibold tracking-[-0.01em] text-ice-primary">
          Sound Engine
        </h2>
        <p className="mt-1 truncate text-xs text-ice-muted" title={currentSound}>
          {currentSound}
        </p>
      </div>

      <FieldLabel className="relative text-xs">
        Built-in sound
        <Select
          aria-label="Built-in sound"
          className="h-9 rounded-xl px-3 text-xs"
          onChange={(event) => updatePreset(event.target.value as SoundEnginePreset)}
          value={settings.preset}
        >
          {soundOptions.map((sound) => (
            <option key={sound} value={sound}>
              {sound}
            </option>
          ))}
        </Select>
      </FieldLabel>

      <FieldLabel className="relative text-xs">
        <span className="flex items-center justify-between gap-3">
          Volume
          <span className="text-ice-muted">{Math.round(settings.volume * 100)}%</span>
        </span>
        <input
          aria-label="Sound engine volume"
          className="h-2 w-full cursor-pointer accent-[color:var(--ice-accent)]"
          max={1}
          min={0}
          onChange={(event) => updateVolume(Number(event.target.value))}
          step={0.01}
          type="range"
          value={settings.volume}
        />
      </FieldLabel>

      <FieldLabel className="relative text-xs">
        Upload one-shot
        <input
          accept=".wav,.mp3,.ogg,audio/wav,audio/mpeg,audio/ogg"
          className="block w-full rounded-xl border border-dashed border-[color:var(--ice-border)] bg-white/[0.04] px-3 py-3 text-xs text-ice-secondary file:mr-3 file:rounded-full file:border-0 file:bg-[color:var(--ice-accent-soft)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[color:var(--ice-accent-text)]"
          onChange={updateUpload}
          type="file"
        />
      </FieldLabel>
    </Card>
  );
}
