type HeroProps = {
  isGenerating: boolean;
  status: string;
  onGenerate: () => void;
};

export default function Hero({ isGenerating, status, onGenerate }: HeroProps) {
  return (
    <section className="relative z-10 flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white md:text-7xl">
        Generate icy MIDI packs
      </h1>

      <p className="mt-6 max-w-xl text-lg text-cyan-100/80">
        Create dark, cold and melodic MIDI loops inspired by the iCEPUNK sound.
      </p>

      <button
        onClick={onGenerate}
        disabled={isGenerating}
        className="mt-10 rounded-full bg-cyan-300 px-8 py-4 font-bold text-slate-950 hover:bg-white disabled:opacity-50"
      >
        {isGenerating ? "Generating..." : "Generate MIDI Pack"}
      </button>

      {status && (
        <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-slate-950/60 px-6 py-4">
          <p className="text-sm text-cyan-100">{status}</p>
        </div>
      )}
    </section>
  );
}
