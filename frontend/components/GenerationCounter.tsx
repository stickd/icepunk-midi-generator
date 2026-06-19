type GenerationCounterProps = {
  totalGenerations: number | null;
  isLoading?: boolean;
};

export default function GenerationCounter({
  totalGenerations,
  isLoading = false,
}: GenerationCounterProps) {
  const formattedTotal = totalGenerations?.toLocaleString("en-US") ?? "...";

  return (
    <div className="mt-8 flex items-center justify-center">
      <div className="relative overflow-hidden rounded-full border border-cyan-100/20 bg-white/[0.045] px-6 py-3 shadow-[0_18px_60px_rgba(56,189,248,0.12)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.14),rgba(103,232,249,0.06),rgba(255,255,255,0.08))]" />

        <div className="relative flex items-center gap-3 text-sm text-slate-200">
          <span className="h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_18px_rgba(125,211,252,0.95)]" />
          <span className="font-semibold text-white">
            {isLoading ? "Loading" : formattedTotal}
          </span>
          <span className="text-slate-300/80">MIDI packs generated</span>
        </div>
      </div>
    </div>
  );
}
