"use client";

import { useState } from "react";
import SketchButton from "./SketchButton";
import styles from "./sketchTheme.module.css";

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
  const [packName, setPackName] = useState("SteveMuis");
  const [type, setType] = useState<CreatePackDraft["type"]>("melody");

  return (
    <div className={styles.modalBackdrop}>
      <section
        aria-labelledby="create-pack-title"
        aria-modal="true"
        className={styles.modal}
        role="dialog"
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle} id="create-pack-title">
            Create pack
          </h2>
          <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.sliderGroup}>
            <label htmlFor="midi-amount">Amount of midis</label>
            <input
              className={styles.slider}
              id="midi-amount"
              type="range"
              min={1}
              max={34}
              value={amount}
              onChange={(event) => setAmount(Number(event.currentTarget.value))}
            />
            <strong>{amount}</strong>
          </div>

          <div className={styles.packForm}>
            <label htmlFor="pack-name">Pack Name</label>
            <input
              className={styles.roughInput}
              id="pack-name"
              value={packName}
              onChange={(event) => setPackName(event.currentTarget.value)}
            />

            <div>
              <div className={styles.controlLabel}>Type</div>
              <div className={styles.radioRow}>
                <label>
                  <input
                    checked={type === "melody"}
                    name="pack-type"
                    onChange={() => setType("melody")}
                    type="radio"
                  />
                  Melody
                </label>
                <label>
                  <input
                    checked={type === "drums"}
                    name="pack-type"
                    onChange={() => setType("drums")}
                    type="radio"
                  />
                  Drums
                </label>
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <SketchButton
              size="small"
              type="button"
              onClick={() => onNext({ amount, packName, type })}
            >
              Next →
            </SketchButton>
          </div>
        </div>
      </section>
    </div>
  );
}
