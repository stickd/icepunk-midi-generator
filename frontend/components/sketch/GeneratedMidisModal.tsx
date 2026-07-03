"use client";

import CreditButton from "./CreditButton";
import SketchButton from "./SketchButton";
import { GenerateMidiResponse } from "@/lib/api";
import { CreatePackDraft } from "./CreatePackModal";
import styles from "./sketchTheme.module.css";

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
                disabled
                title="Generated MIDI preview playback is coming soon."
                onClick={() => onStubStatus("Generated MIDI preview playback is coming soon.")}
                aria-label="Play generated MIDI preview"
              >
                ▶
              </button>
              <label className={styles.controlLabel}>
                BPM
                <input className={styles.tinyControl} type="number" defaultValue={140} disabled />
              </label>
              <label className={styles.controlLabel}>
                Pitch
                <input className={styles.tinyControl} type="number" defaultValue={0} disabled />
              </label>
              <label className={styles.controlLabel}>
                Octaves
                <input className={styles.tinyControl} type="number" defaultValue={1} disabled />
              </label>
            </div>

            <div>
              <div className={`${styles.pianoRollEmpty} ${styles.generatedPreviewState}`}>
                {lastGeneration
                  ? "ZIP generated. Individual MIDI piano-roll preview needs backend MIDI file URLs."
                  : "Generate a real pack to receive a ZIP download. Individual MIDI preview is coming soon."}
              </div>
              <div className={styles.ratingRow}>
                <button
                  className={styles.smallIconButton}
                  type="button"
                  disabled
                  title="Generated MIDI rating is coming soon."
                  onClick={() => onStubStatus("Generated MIDI rating is coming soon.")}
                  aria-label="Thumbs up"
                >
                  ♡
                </button>
                <button
                  className={styles.smallIconButton}
                  type="button"
                  disabled
                  title="Generated MIDI rating is coming soon."
                  onClick={() => onStubStatus("Generated MIDI rating is coming soon.")}
                  aria-label="Thumbs down"
                >
                  ♧
                </button>
              </div>
              <div className={styles.carousel}>
                <button className={styles.carouselArrow} type="button" disabled aria-label="Previous MIDI">
                  ‹
                </button>
                {Array.from({ length: Math.min(3, draft.amount) }, (_, index) => (
                  <span className={styles.thumbnail} key={index} aria-label={`MIDI ${index + 1} preview coming soon`} />
                ))}
                <button className={styles.carouselArrow} type="button" disabled aria-label="Next MIDI">
                  ›
                </button>
              </div>
              <div className={styles.carouselCount}>Preview coming soon</div>
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
              {lastGeneration ? (
                <a
                  className={styles.downloadLink}
                  href={lastGeneration.downloadUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Latest ZIP ready
                </a>
              ) : null}
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
              {lastGeneration ? (
                <a
                  className={styles.downloadLink}
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
