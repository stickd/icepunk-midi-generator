import Link from "next/link";

export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return <main lang="de" className="mx-auto w-full max-w-3xl px-6 py-16 text-ice-secondary">
    <Link className="text-sm text-[color:var(--ice-accent)]" href="/">← ICEPUNK</Link>
    <h1 className="mt-8 font-[family-name:var(--font-display)] text-3xl text-ice-primary">{title}</h1>
    <p className="mt-2 text-sm">Version 1.0 · effective before public beta launch after operator details are completed.</p>
    <div className="mt-10 space-y-7 leading-7">{children}</div>
  </main>;
}
