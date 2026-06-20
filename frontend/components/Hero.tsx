type HeroProps = {
  children: React.ReactNode;
};

export default function Hero({ children }: HeroProps) {
  return (
    <section className="relative z-10 flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-20 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-20 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-cyan-300/10 blur-[140px]" />

        <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/5 blur-[180px]" />
      </div>

      <p className="mb-6 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/60">
        iCEPUNK MIDI GENERATOR
      </p>

      <h1 className="max-w-5xl overflow-visible bg-gradient-to-b from-white via-cyan-50 to-cyan-300 bg-clip-text pb-3 text-5xl font-extrabold leading-[1.08] tracking-[-0.025em] text-transparent md:text-7xl">
        Generate icy MIDI packs
      </h1>

      <p className="mt-8 max-w-xl text-lg leading-7 text-slate-300/80">
        Create dark, cold and melodic MIDI loops inspired by the iCEPUNK sound.
      </p>

      {children}
    </section>
  );
}
