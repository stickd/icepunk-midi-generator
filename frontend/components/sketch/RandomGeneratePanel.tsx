"use client";

import { GenerationSource } from "@/lib/api";
import MidiDropZone from "./MidiDropZone";
import SketchButton from "./SketchButton";
import styles from "./sketchTheme.module.css";

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
    <section className={styles.heroCenter} aria-label="MIDI creation controls">
      <div className={styles.sourceSelector} aria-label="Generation source">
        <label>
          <input
            checked={sourceState.source === "FACTORY"}
            name="source"
            onChange={() => onSourceStateChange({ source: "FACTORY" })}
            type="radio"
          />{" "}
          Factory
        </label>
        <label>
          <input
            checked={isCustom}
            name="source"
            onChange={() => onSourceStateChange({ source: "CUSTOM_UPLOAD" })}
            type="radio"
          />{" "}
          Custom
        </label>
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
        <div className={styles.feedStatePanel}>
          <strong>Factory dataset selected.</strong>
          <span>Generation will use the bundled IcePunk analysis dataset.</span>
        </div>
      )}

      <div className={styles.orText}>THEN</div>
      <SketchButton disabled={!canGenerate} type="button" onClick={onOpenCreatePack}>
        Generate random
      </SketchButton>
      <p className={styles.statusLine} role="status">
        {isCustom && !sourceState.tempAnalysisId
          ? "Upload and analyze 1-8 MIDI files before generating from Custom."
          : status}
      </p>
    </section>
  );
}
