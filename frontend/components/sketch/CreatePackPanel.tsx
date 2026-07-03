"use client";

import { Button, FieldLabel, Input, Select } from "@/components/ui";
import MidiDropZone from "./MidiDropZone";

type CreatePackPanelProps = {
  onOpenCreatePack: () => void;
  onStubStatus: (message: string) => void;
  status: string;
};

const SOURCES = [
  { label: "site", value: "site" },
  { label: "database", value: "database" },
  { label: "favorites", value: "favorites" },
] as const;

export default function CreatePackPanel({
  onOpenCreatePack,
  onStubStatus,
  status,
}: CreatePackPanelProps) {
  return (
    <aside className="grid content-start gap-6 rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-[color:var(--ice-surface)] p-5 shadow-[var(--ice-shadow-card)] backdrop-blur-xl lg:sticky lg:top-6">
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-ice-primary">Create pack</h2>

      <section aria-label="MIDI creation controls" className="grid gap-4">
        <MidiDropZone onStubStatus={onStubStatus} />

        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.08em] text-ice-muted">
          <span className="h-px flex-1 bg-white/[0.08]" />
          or
          <span className="h-px flex-1 bg-white/[0.08]" />
        </div>

        <Button onClick={onOpenCreatePack} type="button" variant="primary">
          Generate random
        </Button>

        <fieldset aria-label="Generation source" className="flex flex-wrap justify-center gap-4">
          <legend className="sr-only">Generation source</legend>
          {SOURCES.map((source, index) => (
            <label
              className="inline-flex items-center gap-1.5 text-xs text-ice-secondary"
              key={source.value}
            >
              <input
                className="accent-[color:var(--ice-accent)]"
                defaultChecked={index === 0}
                name="source"
                type="radio"
                value={source.value}
              />
              {source.label}
            </label>
          ))}
        </fieldset>

        <p className="min-h-[20px] text-center text-sm text-ice-secondary" role="status">
          {status}
        </p>
      </section>

      <div className="h-px bg-white/[0.06]" />

      <div className="grid gap-4">
        <FieldLabel htmlFor="preview-sound">
          Choose preview sound
          <Select defaultValue="PAD" id="preview-sound">
            <option>PAD</option>
            <option>PLUCK</option>
            <option>BASS</option>
            <option>KEYS</option>
          </Select>
        </FieldLabel>

        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.08em] text-ice-muted">
          <span className="h-px flex-1 bg-white/[0.08]" />
          or
          <span className="h-px flex-1 bg-white/[0.08]" />
        </div>

        <button
          className="grid min-h-[56px] place-items-center rounded-xl border border-dashed border-white/[0.12] bg-white/[0.03] px-4 text-center text-sm text-ice-secondary transition-[background-color,border-color] duration-150 ease-out hover:border-white/[0.2] hover:bg-white/[0.05]"
          onClick={() => onStubStatus("One-shot upload is a visual placeholder.")}
          type="button"
        >
          🔊 Upload your one-shot
        </button>

        <div className="grid grid-cols-3 gap-2">
          <FieldLabel className="gap-1 text-xs">
            BPM
            <Input className="h-9 px-2 text-sm" defaultValue={140} max={240} min={40} type="number" />
          </FieldLabel>
          <FieldLabel className="gap-1 text-xs">
            Pitch
            <Input className="h-9 px-2 text-sm" defaultValue={0} max={12} min={-12} type="number" />
          </FieldLabel>
          <FieldLabel className="gap-1 text-xs">
            Octaves
            <Input className="h-9 px-2 text-sm" defaultValue={1} max={4} min={1} type="number" />
          </FieldLabel>
        </div>

        <Button
          onClick={() => onStubStatus("Advanced options are frontend-only in this sketch.")}
          type="button"
        >
          Options
        </Button>
      </div>

      <p className="text-xs text-ice-muted">
        Tips: use the pack modal to preview this rough product direction. Real downloads still use
        the existing generator.
      </p>
    </aside>
  );
}
