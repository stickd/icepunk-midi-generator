"use client";

import { useState } from "react";
import { Button, FieldLabel, Input } from "@/components/ui";
import { generateRandomPackName } from "@/lib/randomNames";

export type CreatePackDraft = {
  amount: number;
  packName: string;
  type: "melody" | "drums";
};

type CreatePackModalProps = {
  onClose: () => void;
  onNext: (draft: CreatePackDraft) => void;
};

export default function CreatePackModal({ onClose, onNext }: CreatePackModalProps) {
  const [amount, setAmount] = useState(17);
  const [packName, setPackName] = useState(() => generateRandomPackName());
  const [type, setType] = useState<CreatePackDraft["type"]>("melody");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-xl">
      <section
        aria-labelledby="create-pack-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-[#0c0c16] shadow-[var(--ice-shadow-card)] backdrop-blur-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] p-6">
          <h2 className="text-xl font-semibold text-ice-primary" id="create-pack-title">
            Create pack
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
          <div className="grid gap-2 text-center">
            <label className="text-sm text-ice-secondary" htmlFor="midi-amount">
              Amount of midis
            </label>
            <input
              className="w-full accent-[color:var(--ice-accent)]"
              id="midi-amount"
              max={34}
              min={1}
              onChange={(event) => setAmount(Number(event.currentTarget.value))}
              type="range"
              value={amount}
            />
            <strong className="text-2xl font-semibold text-ice-primary">{amount}</strong>
          </div>

          <div className="grid gap-4">
            <FieldLabel htmlFor="pack-name">
              <div className="flex items-center justify-between">
                <span>Pack Name</span>
                <button
                  aria-label="Generate random 2-word name"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--ice-accent-text)] hover:text-ice-primary transition"
                  onClick={() => setPackName(generateRandomPackName())}
                  type="button"
                >
                  <span>🎲 Randomize</span>
                </button>
              </div>
              <div className="flex gap-2">
                <Input
                  className="w-full"
                  id="pack-name"
                  onChange={(event) => setPackName(event.currentTarget.value)}
                  value={packName}
                />
                <button
                  aria-label="Reroll name"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/[0.1] bg-white/[0.04] text-sm text-ice-secondary transition hover:bg-white/[0.08] hover:text-ice-primary"
                  onClick={() => setPackName(generateRandomPackName())}
                  title="Generate new 2-word name"
                  type="button"
                >
                  🎲
                </button>
              </div>
            </FieldLabel>

            <fieldset>
              <legend className="mb-2 text-sm text-ice-secondary">Type</legend>
              <div className="flex justify-center gap-8">
                <label className="inline-flex items-center gap-2 text-sm text-ice-primary">
                  <input
                    checked={type === "melody"}
                    className="accent-[color:var(--ice-accent)]"
                    name="pack-type"
                    onChange={() => setType("melody")}
                    type="radio"
                  />
                  Melody
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-ice-primary">
                  <input
                    checked={type === "drums"}
                    className="accent-[color:var(--ice-accent)]"
                    name="pack-type"
                    onChange={() => setType("drums")}
                    type="radio"
                  />
                  Drums
                </label>
              </div>
            </fieldset>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => onNext({ amount, packName, type })}
              type="button"
              variant="primary"
            >
              Next →
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
