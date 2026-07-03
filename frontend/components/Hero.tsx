type HeroProps = {
  children: React.ReactNode;
};

export default function Hero({ children }: HeroProps) {
  return (
    <section id="generate" className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-12 pt-28 text-center md:pb-16">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-24 h-[480px] w-[680px] -translate-x-1/2 rounded-full bg-cyan-200/8 blur-[150px]" />
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-500/8 blur-[180px]" />
      </div>

      <p className="mb-6 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/55">
        MIDI Creation Workspace
      </p>

      <h1 className="max-w-5xl overflow-visible bg-gradient-to-b from-white via-slate-100 to-cyan-200 bg-clip-text pb-3 text-5xl font-extrabold leading-[1.08] text-transparent md:text-7xl">
        Generate MIDI packs with studio-grade control
      </h1>

      <p className="mt-7 max-w-2xl text-lg leading-8 text-ice-secondary">
        Create, preview, save, and publish melodic ideas from one focused
        workspace.
      </p>

      {children}
    </section>
  );
}
