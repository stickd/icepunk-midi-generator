import { useState } from "react";

type GenerateButtonProps = {
  isGenerating: boolean;
  onGenerate: () => void;
};

export default function GenerateButton({
  isGenerating,
  onGenerate,
}: GenerateButtonProps) {
  const [pressed, setPressed] = useState(false);

  const handleClick = () => {
    if (isGenerating) return;

    setPressed(true);
    onGenerate();

    setTimeout(() => {
      setPressed(false);
    }, 700);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isGenerating}
      className="
        group relative mt-6 h-[64px] w-full max-w-[360px] overflow-visible rounded-full
        text-lg font-black tracking-tight text-slate-950
        transition-all duration-300
        hover:-translate-y-0.5 hover:scale-[1.018]
        active:translate-y-0 active:scale-[0.97]
        disabled:cursor-not-allowed disabled:opacity-60
      "
    >
      {/* outer glow */}
      <span className="absolute -inset-4 rounded-full bg-cyan-300/10 blur-2xl transition-all duration-500 group-hover:bg-cyan-200/18 group-hover:blur-2xl" />

      {/* click energy pulse */}
      {pressed && (
        <span className="absolute inset-0 rounded-full border border-cyan-100/70 animate-[icePulse_700ms_ease-out]" />
      )}

      {/* button body */}
      <span
        className="
          absolute inset-0 overflow-hidden rounded-full
          border border-white/80
          bg-gradient-to-b from-white via-cyan-50 to-sky-200
          shadow-[0_14px_44px_rgba(56,189,248,0.18),inset_0_1px_0_rgba(255,255,255,1),inset_0_-8px_18px_rgba(14,165,233,0.14)]
          transition-all duration-500
          group-hover:shadow-[0_18px_58px_rgba(125,211,252,0.28),inset_0_1px_0_rgba(255,255,255,1),inset_0_-10px_22px_rgba(14,165,233,0.18)]
        "
      >
        {/* liquid ice surface */}
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,1),transparent_25%),radial-gradient(circle_at_75%_75%,rgba(125,211,252,0.34),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.72),rgba(186,230,253,0.16))]" />

        {/* premium shine sweep */}
        <span className="absolute inset-y-0 -left-[70%] w-[55%] skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/80 to-transparent transition-all duration-700 group-hover:left-[120%]" />

        {/* subtle frozen border light */}
        <span className="absolute inset-[1px] rounded-full border border-cyan-100/45" />

        {/* inner hover frost */}
        <span className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-80 bg-[linear-gradient(120deg,rgba(255,255,255,0.34),rgba(103,232,249,0.12),rgba(255,255,255,0.24))]" />
      </span>

      {/* text */}
      <span
        className={`
          relative z-10 flex h-full items-center justify-center gap-3
          transition-all duration-300
          ${pressed ? "scale-[0.96]" : "group-hover:scale-[1.01]"}
        `}
      >
        {isGenerating && (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-950/25 border-t-slate-950" />
        )}

        <span>{isGenerating ? "Generating..." : "Generate MIDI Pack"}</span>
      </span>
    </button>
  );
}
