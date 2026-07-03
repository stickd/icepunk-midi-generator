"use client";

import MidiDropZone from "./MidiDropZone";
import SketchButton from "./SketchButton";
import styles from "./sketchTheme.module.css";

type RandomGeneratePanelProps = {
  onOpenCreatePack: () => void;
  onStubStatus: (message: string) => void;
  status: string;
};

export default function RandomGeneratePanel({
  onOpenCreatePack,
  onStubStatus,
  status,
}: RandomGeneratePanelProps) {
  return (
    <section className={styles.heroCenter} aria-label="MIDI creation controls">
      <MidiDropZone onStubStatus={onStubStatus} />
      <div className={styles.orText}>OR</div>
      <SketchButton type="button" onClick={onOpenCreatePack}>
        Generate random
      </SketchButton>
      <div className={styles.sourceSelector} aria-label="Generation source">
        {/* TODO: Connect source filters when public/favorite datasets are exposed by the API. */}
        <label>
          <input name="source" type="radio" defaultChecked /> site
        </label>
        <label>
          <input name="source" type="radio" /> database
        </label>
        <label>
          <input name="source" type="radio" /> favorites
        </label>
      </div>
      <p className={styles.statusLine} role="status">
        {status}
      </p>
    </section>
  );
}
