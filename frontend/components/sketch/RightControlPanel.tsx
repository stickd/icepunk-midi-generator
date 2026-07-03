"use client";

import SketchButton from "./SketchButton";
import styles from "./sketchTheme.module.css";

type RightControlPanelProps = {
  onStubStatus: (message: string) => void;
};

export default function RightControlPanel({ onStubStatus }: RightControlPanelProps) {
  return (
    <aside className={styles.rightPanel} aria-label="Preview and generation options">
      <div className={styles.rightCell}>
        <label className={styles.controlLabel} htmlFor="preview-sound">
          Choose preview sound
        </label>
        <select className={styles.roughSelect} id="preview-sound" defaultValue="PAD">
          <option>PAD</option>
          <option>PLUCK</option>
          <option>BASS</option>
          <option>KEYS</option>
        </select>
      </div>

      <div className={styles.rightCell}>
        <div className={styles.orText}>OR</div>
        <button
          className={styles.oneShot}
          type="button"
          onClick={() => onStubStatus("One-shot upload is a visual placeholder.")}
        >
          🔊 Upload your one-shot
        </button>
      </div>

      <div className={styles.optionPanel}>
        <label className={styles.controlLabel}>
          BPM
          <input className={styles.tinyControl} type="number" defaultValue={140} min={40} max={240} />
        </label>
        <label className={styles.controlLabel}>
          Pitch
          <input className={styles.tinyControl} type="number" defaultValue={0} min={-12} max={12} />
        </label>
        <label className={styles.controlLabel}>
          Octaves
          <input className={styles.tinyControl} type="number" defaultValue={1} min={1} max={4} />
        </label>

        <div className={styles.miniAd}>Mini Ad</div>
        <SketchButton
          size="small"
          type="button"
          onClick={() => onStubStatus("Advanced options are frontend-only in this sketch.")}
        >
          Options
        </SketchButton>
      </div>
    </aside>
  );
}
