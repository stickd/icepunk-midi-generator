"use client";

import CreditButton from "./CreditButton";
import PianoRollPreview from "./PianoRollPreview";
import SketchButton from "./SketchButton";
import { CreatePackDraft } from "./CreatePackModal";
import { mockGeneratedMidis } from "./mockData";
import styles from "./sketchTheme.module.css";

type GeneratedMidisModalProps = {
  draft: CreatePackDraft;
  isGenerating: boolean;
  onClose: () => void;
  onGenerateRealPack: () => void;
  onStubStatus: (message: string) => void;
};

export default function GeneratedMidisModal({
  draft,
  isGenerating,
  onClose,
  onGenerateRealPack,
  onStubStatus,
}: GeneratedMidisModalProps) {
  const currentMidi = mockGeneratedMidis[0];

  return (
    <div className={styles.modalBackdrop}>
      <section
        aria-labelledby="generated-midis-title"
        aria-modal="true"
        className={`${styles.modal} ${styles.largeModal}`}
        role="dialog"
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle} id="generated-midis-title">
            Generated Midis
          </h2>
          <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.generatedGrid}>
            <div className={styles.sideKnobs}>
              <button
                className={styles.playButton}
                type="button"
                onClick={() => onStubStatus("MIDI preview playback is a stub.")}
                aria-label="Play generated MIDI preview"
              >
                ▶
              </button>
              <label className={styles.controlLabel}>
                BPM
                <input className={styles.tinyControl} type="number" defaultValue={currentMidi.bpm} />
              </label>
              <label className={styles.controlLabel}>
                Pitch
                <input className={styles.tinyControl} type="number" defaultValue={currentMidi.pitch} />
              </label>
              <label className={styles.controlLabel}>
                Octaves
                <input className={styles.tinyControl} type="number" defaultValue={currentMidi.octaves} />
              </label>
            </div>

            <div>
              <PianoRollPreview large label="Generated MIDI piano roll preview" />
              <div className={styles.ratingRow}>
                <button
                  className={styles.smallIconButton}
                  type="button"
                  onClick={() => onStubStatus("Rating generated MIDI is a frontend stub.")}
                  aria-label="Thumbs up"
                >
                  ♡
                </button>
                <button
                  className={styles.smallIconButton}
                  type="button"
                  onClick={() => onStubStatus("Rating generated MIDI is a frontend stub.")}
                  aria-label="Thumbs down"
                >
                  ♧
                </button>
              </div>
              <div className={styles.carousel}>
                <button className={styles.carouselArrow} type="button" aria-label="Previous MIDI">
                  ‹
                </button>
                {mockGeneratedMidis.map((midi) => (
                  <span className={styles.thumbnail} key={midi.id} aria-label={midi.label} />
                ))}
                <button className={styles.carouselArrow} type="button" aria-label="Next MIDI">
                  ›
                </button>
              </div>
              <div className={styles.carouselCount}>{currentMidi.label}</div>
            </div>

            <div className={styles.generatedActions}>
              <p>Keep this midi to yourself and download exclusive for</p>
              <CreditButton>2 points</CreditButton>
              <strong>OR</strong>
              <SketchButton
                disabled={isGenerating}
                size="small"
                type="button"
                onClick={onGenerateRealPack}
              >
                {isGenerating ? "Generating..." : "Download and publish ↓"}
              </SketchButton>
              <small>Learn more</small>
            </div>
          </div>

          <div className={styles.packSection}>
            <div>
              <h3 className={styles.packTitle}>Pack</h3>
              <label className={styles.checkLine}>
                <input type="checkbox" defaultChecked /> Include downloaded
              </label>
              <label className={styles.checkLine}>
                <input type="checkbox" defaultChecked /> Include non-rated
              </label>
              <div className={styles.packTotal}>
                Total:
                <strong>{draft.amount} midis</strong>
              </div>
            </div>

            <div className={styles.chevrons} aria-hidden="true">
              &gt;&gt;&gt;
            </div>

            <div className={styles.generatedActions}>
              <p>Download whole pack exclusively and keep it private for</p>
              <CreditButton>34 points</CreditButton>
              <strong>OR</strong>
              <SketchButton
                disabled={isGenerating}
                size="small"
                type="button"
                onClick={onGenerateRealPack}
              >
                {isGenerating ? "Generating..." : `${draft.packName}-Midis.zip ↓`}
              </SketchButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
