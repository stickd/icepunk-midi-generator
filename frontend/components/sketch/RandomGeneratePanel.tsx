"use client";

import dynamic from "next/dynamic";
import { Button, SegmentedControl, ToastNotification } from "@/components/ui";
import { GenerationSource } from "@/lib/api";

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

const MidiDropZone = dynamic(() => import("./MidiDropZone"), {
  loading: () => (
    <div className="grid gap-3">
      <div className="grid min-h-[92px] place-items-center rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.03] p-6 text-center text-xs text-ice-muted">
        Loading custom MIDI upload...
      </div>
      <div className="mx-auto h-7 w-[120px] rounded-full border border-white/[0.08] bg-white/[0.05]" />
      <div className="h-[210px] rounded-xl border border-white/[0.06] bg-[color:var(--ice-bg-canvas)]" />
    </div>
  ),
});

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
      {/* Top Switch Bar */}
      <div className="flex justify-center pt-1">
        <SegmentedControl
          onChange={(source) => onSourceStateChange({ source })}
          options={sourceOptions}
          value={sourceState.source}
        />
      </div>

      {/* Prominent 3D Orbital Loader Ring */}
      {!isCustom && (
        <div className="flex items-center justify-center py-4">
          <div className="loader">
            <div className="dot" />
            <div className="dot" />
            <div className="dot" />
          </div>
        </div>
      )}

      {/* Section Title & Subtitle */}
      <div className="text-center">
        <h2 className="text-lg font-semibold text-ice-primary">Create from Source</h2>
        <p className="mt-0.5 text-xs text-ice-secondary">
          Choose the factory dataset or analyze your own MIDI files first.
        </p>
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
        null
      )}

      {/* Hero Generate Trigger CTA Area */}
      <div className="relative flex flex-col items-center justify-center pt-2">
        <Button
          className="relative px-8 py-3 text-base shadow-[0_0_25px_rgba(132,146,255,0.25)] hover:shadow-[0_0_35px_rgba(132,146,255,0.4)] active:scale-95"
          disabled={!canGenerate}
          onClick={onOpenCreatePack}
          size="lg"
          type="button"
          variant="primary"
        >
          <svg
            className="h-5 w-5 fill-none stroke-current"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 3V21M3 12H21M7.5 7.5L16.5 16.5M16.5 7.5L7.5 16.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span>Generate</span>
        </Button>
      </div>

      {isCustom && !sourceState.tempAnalysisId ? (
        <ToastNotification
          message="Upload and analyze 1-100 MIDI files before generating from Custom."
          type="info"
        />
      ) : status ? (
        <ToastNotification
          message={status}
          type={status.toLowerCase().includes("failed") || status.toLowerCase().includes("error") ? "error" : "success"}
        />
      ) : null}
    </div>
  );
}
