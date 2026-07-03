"use client";

import { Button, SegmentedControl } from "@/components/ui";
import { GenerationSource } from "@/lib/api";
import MidiDropZone from "./MidiDropZone";

export type GenerationSourceState = {
  source: GenerationSource;
  tempAnalysisId?: string;
};

type RandomGeneratePanelProps = {
  sourceState: GenerationSourceState;
  onSourceStateChange: (state: GenerationSourceState) => void;
  onOpenCreatePack: () => void;
  onStubStatus: (message: string) => void;
  status: string;
};

const sourceOptions: Array<{ label: string; value: GenerationSource }> = [
  { label: "Factory", value: "FACTORY" },
  { label: "Custom", value: "CUSTOM_UPLOAD" },
];

export default function RandomGeneratePanel({
  sourceState,
  onSourceStateChange,
  onOpenCreatePack,
  onStubStatus,
  status,
}: RandomGeneratePanelProps) {
  const isCustom = sourceState.source === "CUSTOM_UPLOAD";
  const canGenerate = !isCustom || Boolean(sourceState.tempAnalysisId);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ice-primary">Create from source</h2>
          <p className="mt-1 text-sm leading-6 text-ice-secondary">
            Choose the factory dataset or analyze your own MIDI files first.
          </p>
        </div>
        <SegmentedControl
          onChange={(source) => onSourceStateChange({ source })}
          options={sourceOptions}
          value={sourceState.source}
        />
      </div>

      {isCustom ? (
        <MidiDropZone
          onAnalysisComplete={(tempAnalysisId) =>
            onSourceStateChange({ source: "CUSTOM_UPLOAD", tempAnalysisId })
          }
          onAnalysisReset={() => onSourceStateChange({ source: "CUSTOM_UPLOAD" })}
          onStubStatus={onStubStatus}
        />
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5">
          <p className="text-sm font-medium text-ice-primary">Factory dataset selected.</p>
          <p className="mt-2 text-sm leading-6 text-ice-secondary">
            Generation will use the bundled IcePunk analysis dataset.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button disabled={!canGenerate} onClick={onOpenCreatePack} type="button" variant="primary">
          Generate random
        </Button>
      </div>

      <p className="min-h-[20px] text-center text-sm text-ice-muted" role="status">
        {isCustom && !sourceState.tempAnalysisId
          ? "Upload and analyze 1-8 MIDI files before generating from Custom."
          : status}
      </p>
    </div>
  );
}
