"use client";

import { DragEvent, useRef, useState } from "react";
import styles from "./sketchTheme.module.css";

type MidiDropZoneProps = {
  onStubStatus: (message: string) => void;
};

export default function MidiDropZone({ onStubStatus }: MidiDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".mid") && !file.name.toLowerCase().endsWith(".midi")) {
      onStubStatus("Drop a .mid file to use it as a future reference.");
      return;
    }

    // TODO: Wire uploaded MIDI references into the backend once dataset conditioning exists.
    onStubStatus(`${file.name} is staged as a frontend-only reference.`);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <label
      className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ""}`}
      onDragEnter={() => setIsDragging(true)}
      onDragLeave={() => setIsDragging(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        className={styles.visuallyHidden}
        type="file"
        accept=".mid,.midi"
        onChange={(event) => handleFiles(event.currentTarget.files)}
      />
      <span>Drop your midis here</span>
      <span className={styles.uploadGlyph} aria-hidden="true">
        ↧
      </span>
    </label>
  );
}
