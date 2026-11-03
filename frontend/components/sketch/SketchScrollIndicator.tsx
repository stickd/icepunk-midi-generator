"use client";

type SketchScrollIndicatorProps = {
  feedProgress: number;
  genProgress: number;
  isFeedScrolling: boolean;
  isGenScrolling: boolean;
};

export default function SketchScrollIndicator({
  feedProgress,
  genProgress,
  isFeedScrolling,
  isGenScrolling,
}: SketchScrollIndicatorProps) {
  return (
    <div
      aria-hidden="true"
      className="hidden self-stretch w-5 relative flex-col items-center justify-between py-6 lg:flex select-none pointer-events-none"
      title="Left dot: Generator scroll • Right dot: Feed scroll"
    >
      {/* Center Vertical Divider Line */}
      <div className="absolute inset-y-6 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/15 to-transparent" />

      {/* Left Square (Generator Scroll Position - Soft Periwinkle) */}
      <div
        className={`absolute left-1/2 h-2 w-2 -translate-x-[11px] rounded-[2px] bg-[color:var(--ice-accent)] shadow-[0_0_8px_rgba(132,146,255,0.4)] transition-all duration-300 ease-out ${
          isGenScrolling ? "opacity-60 scale-100" : "opacity-0 scale-75"
        }`}
        style={{ top: `calc(1.5rem + ${genProgress * 85}%)` }}
      />

      {/* Right Square (Feed Scroll Position - Soft Cyan, 1-to-1 Symmetrical relative to divider) */}
      <div
        className={`absolute left-1/2 h-2 w-2 translate-x-[3px] rounded-[2px] bg-[#6ee7ff] shadow-[0_0_8px_rgba(110,231,255,0.4)] transition-all duration-300 ease-out ${
          isFeedScrolling ? "opacity-60 scale-100" : "opacity-0 scale-75"
        }`}
        style={{ top: `calc(1.5rem + ${feedProgress * 85}%)` }}
      />
    </div>
  );
}
