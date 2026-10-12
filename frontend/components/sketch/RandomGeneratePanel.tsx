"use client";

import dynamic from "next/dynamic";
import { Button, SegmentedControl, ToastNotification } from "@/components/ui";
import { GenerationSource } from "@/lib/api";
const CustomDatasetControls = dynamic(() => import("./CustomDatasetControls"));

export type GenerationSourceState = {
  source: GenerationSource;
  tempAnalysisId?: string;
  tempAnalysisAccessToken?: string;
  datasetIds?: string[];
  includeFactoryPool?: boolean;
};

type RandomGeneratePanelProps = {
  sourceState: GenerationSourceState;
  onSourceStateChange: (state: GenerationSourceState) => void;
  onOpenCreatePack: () => void;
  onStubStatus: (message: string) => void;
  onUnauthorized: () => void;
  status: string;
  token: string | null;
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
    </div>
  ),
});

export default function RandomGeneratePanel({
  sourceState,
  onSourceStateChange,
  onOpenCreatePack,
  onStubStatus,
  onUnauthorized,
  status,
  token,
}: RandomGeneratePanelProps) {
  const isCustom = sourceState.source === "CUSTOM_UPLOAD";
  const hasDatasetSelection =
    Boolean(sourceState.datasetIds?.length) || Boolean(sourceState.includeFactoryPool);
  const canGenerate = !isCustom || Boolean(sourceState.tempAnalysisId) || hasDatasetSelection;

  return (
    <div className="studio-source-panel">
      {/* Top Switch Bar */}
      <div className="studio-source-header"><span className="studio-eyebrow">01 / SELECT YOUR SOURCE</span>
        <SegmentedControl
          onChange={(source) => onSourceStateChange({ source })}
          options={sourceOptions}
          value={sourceState.source}
        />
      </div>

      {!isCustom && (
        <div className="studio-signal" aria-hidden="true">
          <div className="studio-signal-ring" /><span className="studio-signal-star">✳</span>
          <span className="studio-signal-tag">FACTORY / ORIGINAL DNA</span>
        </div>
      )}
      {/* Source description */}
      <div className="text-center">
        <h3 className="studio-source-title">{isCustom ? "Your sound. Reimagined." : "Start with a little ice."}</h3>
        <p className="mt-0.5 text-xs text-ice-secondary">
          {isCustom ? "Upload your MIDI references or choose a saved dataset." : "Fresh melodies. Frozen textures. A new direction, every time."}
        </p>
      </div>

      {isCustom ? (
        <div className="grid gap-4 transition-all duration-300 ease-out animate-fade-in">
          <MidiDropZone
            onAnalysisComplete={(tempAnalysisId, tempAnalysisAccessToken) =>
              onSourceStateChange({ source: "CUSTOM_UPLOAD", tempAnalysisId, tempAnalysisAccessToken })
            }
            onAnalysisReset={() => onSourceStateChange({ source: "CUSTOM_UPLOAD" })}
            onStubStatus={onStubStatus}
            onUnauthorized={onUnauthorized}
            token={token}
          />
          <CustomDatasetControls
            includeFactoryPool={Boolean(sourceState.includeFactoryPool)}
            onSelectionChange={(datasetIds, includeFactoryPool) =>
              onSourceStateChange({
                ...sourceState,
                datasetIds,
                includeFactoryPool,
              })
            }
            onStubStatus={onStubStatus}
            selectedDatasetIds={sourceState.datasetIds ?? []}
            token={token}
          />
        </div>
      ) : null}

      {/* Hero Generate Trigger CTA Area */}
      <div className="relative flex flex-col items-center justify-center pt-2">
        <Button
          className="studio-generate-button"
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

      <div className="studio-generator-footnote"><span>EXPORT .MID</span><span>MADE FOR YOUR DAW ↗</span></div>
      {isCustom && !canGenerate ? (
        <ToastNotification
          message="Upload and analyze MIDI files, or pick a saved dataset, before generating from Custom."
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
