const NOTE_PATTERN = [
  { left: "8%", top: "22%", width: "15%" },
  { left: "28%", top: "14%", width: "10%" },
  { left: "46%", top: "34%", width: "17%" },
  { left: "68%", top: "18%", width: "19%" },
  { left: "14%", top: "62%", width: "20%" },
  { left: "40%", top: "70%", width: "12%" },
  { left: "61%", top: "58%", width: "28%" },
  { left: "78%", top: "76%", width: "14%" },
] as const;

type PianoRollPreviewProps = {
  large?: boolean;
  label?: string;
};

export default function PianoRollPreview({ large = false, label }: PianoRollPreviewProps) {
  return (
    <div
      aria-label={label ?? "Piano roll MIDI preview"}
      className={`relative overflow-hidden rounded-xl border border-white/[0.06] bg-[color:var(--ice-bg-canvas)] ${
        large ? "h-[210px]" : "h-[88px]"
      }`}
      role="img"
    >
      {NOTE_PATTERN.map((note, index) => (
        <span
          aria-hidden="true"
          className="absolute h-[6px] rounded-full bg-[rgba(120,150,255,0.7)]"
          key={`${note.left}-${index}`}
          style={{ left: note.left, top: note.top, width: note.width }}
        />
      ))}
    </div>
  );
}
