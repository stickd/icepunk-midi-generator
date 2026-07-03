"use client";

import { Button, CreditBadge } from "@/components/ui";
import { GenerateMidiResponse } from "@/lib/api";
import { CreatePackDraft } from "./CreatePackModal";

type GeneratedMidisModalProps = {
  draft: CreatePackDraft;
  isGenerating: boolean;
  lastGeneration: GenerateMidiResponse | null;
  onClose: () => void;
  onGenerateRealPack: () => void;
  onStubStatus: (message: string) => void;
};

export default function GeneratedMidisModal({
  draft,
  isGenerating,
  lastGeneration,
  onClose,
  onGenerateRealPack,
  onStubStatus,
}: GeneratedMidisModalProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-xl">
      <section
        aria-labelledby="generated-midis-title"
        aria-modal="true"
        className="w-full max-w-3xl rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-[#0c0c16] shadow-[var(--ice-shadow-card)] backdrop-blur-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] p-6">
          <h2 className="text-xl font-semibold text-ice-primary" id="generated-midis-title">
            Generated Midis
          </h2>
          <button
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-ice-secondary transition-colors duration-150 ease-out hover:bg-white/[0.08] hover:text-ice-primary"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="grid gap-6 p-6">
          <div className="grid gap-5 sm:grid-cols-[90px_minmax(0,1fr)_220px]">
            <div className="grid content-start gap-3">
              <button
                aria-label="Play generated MIDI preview"
                className="grid h-14 w-14 place-items-center rounded-full border border-white/[0.09] bg-white/[0.04] text-lg text-ice-secondary disabled:opacity-40"
                disabled
                onClick={() => onStubStatus("Generated MIDI preview playback is coming soon.")}
                title="Generated MIDI preview playback is coming soon."
                type="button"
              >
                ▶
              </button>
              <label className="grid gap-1 text-xs text-ice-muted">
                BPM
                <input
                  className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] text-center text-sm text-ice-primary"
                  defaultValue={140}
                  disabled
                  type="number"
                />
              </label>
              <label className="grid gap-1 text-xs text-ice-muted">
                Pitch
                <input
                  className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] text-center text-sm text-ice-primary"
                  defaultValue={0}
                  disabled
                  type="number"
                />
              </label>
              <label className="grid gap-1 text-xs text-ice-muted">
                Octaves
                <input
                  className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] text-center text-sm text-ice-primary"
                  defaultValue={1}
                  disabled
                  type="number"
                />
              </label>
            </div>

            <div className="grid content-start gap-3">
              <div className="grid min-h-[140px] place-items-center rounded-xl border border-white/[0.06] bg-[color:var(--ice-bg-canvas)] p-4 text-center text-sm text-ice-secondary">
                {lastGeneration
                  ? "ZIP generated. Individual MIDI piano-roll preview needs backend MIDI file URLs."
                  : "Generate a real pack to receive a ZIP download. Individual MIDI preview is coming soon."}
              </div>
              <div className="flex justify-center gap-2">
                <button
                  aria-label="Thumbs up"
                  className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.09] bg-white/[0.04] text-ice-secondary disabled:opacity-40"
                  disabled
                  onClick={() => onStubStatus("Generated MIDI rating is coming soon.")}
                  title="Generated MIDI rating is coming soon."
                  type="button"
                >
                  ♡
                </button>
                <button
                  aria-label="Thumbs down"
                  className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.09] bg-white/[0.04] text-ice-secondary disabled:opacity-40"
                  disabled
                  onClick={() => onStubStatus("Generated MIDI rating is coming soon.")}
                  title="Generated MIDI rating is coming soon."
                  type="button"
                >
                  ♧
                </button>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  aria-label="Previous MIDI"
                  className="text-2xl text-ice-muted disabled:opacity-40"
                  disabled
                  type="button"
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(3, draft.amount) }, (_, index) => (
                  <span
                    aria-label={`MIDI ${index + 1} preview coming soon`}
                    className="h-7 w-11 rounded-md border border-white/[0.08] bg-white/[0.04]"
                    key={index}
                  />
                ))}
                <button
                  aria-label="Next MIDI"
                  className="text-2xl text-ice-muted disabled:opacity-40"
                  disabled
                  type="button"
                >
                  ›
                </button>
              </div>
              <div className="text-center text-xs text-ice-muted">Preview coming soon</div>
            </div>

            <div className="grid content-start gap-3 text-center">
              <p className="text-sm text-ice-secondary">
                Keep this midi to yourself and download exclusive for
              </p>
              <CreditBadge className="mx-auto" credits={2} />
              <strong className="text-xs uppercase tracking-[0.08em] text-ice-muted">OR</strong>
              <Button
                disabled={isGenerating}
                onClick={onGenerateRealPack}
                type="button"
                variant="primary"
              >
                {isGenerating ? "Generating..." : "Download and publish ↓"}
              </Button>
              <small className="text-xs text-ice-muted">Learn more</small>
              {lastGeneration ? (
                <a
                  className="text-sm text-[color:var(--ice-accent-text)] underline underline-offset-2"
                  href={lastGeneration.downloadUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Latest ZIP ready
                </a>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 border-t border-white/[0.06] pt-6 sm:grid-cols-[minmax(170px,1fr)_auto_minmax(220px,1fr)] sm:items-center">
            <div>
              <h3 className="mb-2 text-lg font-semibold text-ice-primary">Pack</h3>
              <label className="flex items-center gap-2 text-sm text-ice-secondary">
                <input className="accent-[color:var(--ice-accent)]" defaultChecked type="checkbox" />
                Include downloaded
              </label>
              <label className="flex items-center gap-2 text-sm text-ice-secondary">
                <input className="accent-[color:var(--ice-accent)]" defaultChecked type="checkbox" />
                Include non-rated
              </label>
              <div className="mt-3 text-sm text-ice-secondary">
                Total: <strong className="block text-2xl text-ice-primary">{draft.amount} midis</strong>
              </div>
            </div>

            <div aria-hidden="true" className="hidden text-3xl text-ice-muted sm:block">
              &gt;&gt;&gt;
            </div>

            <div className="grid content-start gap-3 text-center">
              <p className="text-sm text-ice-secondary">
                Download whole pack exclusively and keep it private for
              </p>
              <CreditBadge className="mx-auto" credits={34} />
              <strong className="text-xs uppercase tracking-[0.08em] text-ice-muted">OR</strong>
              <Button
                disabled={isGenerating}
                onClick={onGenerateRealPack}
                type="button"
                variant="primary"
              >
                {isGenerating ? "Generating..." : `${draft.packName}-Midis.zip ↓`}
              </Button>
              {lastGeneration ? (
                <a
                  className="text-sm text-[color:var(--ice-accent-text)] underline underline-offset-2"
                  href={lastGeneration.downloadUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open download URL
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
