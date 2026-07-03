import styles from "./sketchTheme.module.css";

const NOTE_PATTERN = [
  { left: "8%", top: "22%", width: "15%", rotation: "-4deg" },
  { left: "28%", top: "14%", width: "10%", rotation: "7deg" },
  { left: "46%", top: "34%", width: "17%", rotation: "-8deg" },
  { left: "68%", top: "18%", width: "19%", rotation: "5deg" },
  { left: "14%", top: "62%", width: "20%", rotation: "-6deg" },
  { left: "40%", top: "70%", width: "12%", rotation: "8deg" },
  { left: "61%", top: "58%", width: "28%", rotation: "0deg" },
  { left: "78%", top: "76%", width: "14%", rotation: "-5deg" },
] as const;

type PianoRollPreviewProps = {
  large?: boolean;
  label?: string;
};

export default function PianoRollPreview({ large = false, label }: PianoRollPreviewProps) {
  return (
    <div
      className={`${styles.pianoRoll} ${large ? styles.pianoRollLarge : ""}`}
      aria-label={label ?? "Piano roll MIDI preview"}
      role="img"
    >
      {NOTE_PATTERN.map((note, index) => (
        <span
          aria-hidden="true"
          className={styles.note}
          key={`${note.left}-${index}`}
          style={{
            left: note.left,
            top: note.top,
            width: note.width,
            "--rotation": note.rotation,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
