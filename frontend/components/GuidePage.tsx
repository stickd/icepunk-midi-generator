import Link from "next/link";

type GuidePageProps = {
  dawName: string;
  title: string;
  intro: string;
  importStep: string;
  arrangeStep: string;
};

export default function GuidePage({ dawName, title, intro, importStep, arrangeStep }: GuidePageProps) {
  return (
    <main className="guide-page">
      <nav className="guide-nav" aria-label="Guide navigation">
        <Link className="studio-wordmark" href="/">
          <span className="studio-logo" aria-hidden="true">✦</span> iCEPUNK<span className="studio-wordmark-label">MIDI LAB</span>
        </Link>
        <Link className="desktop-back" href="/#workspace">Open web studio ↗</Link>
      </nav>

      <article className="guide-article">
        <header>
          <p className="desktop-kicker">DAW GUIDE · MIDI WORKFLOW</p>
          <h1>{title}</h1>
          <p>{intro}</p>
        </header>

        <section aria-labelledby="guide-steps-title">
          <p className="studio-eyebrow">The short route</p>
          <h2 id="guide-steps-title">From generation to arrangement.</h2>
          <ol className="guide-steps">
            <li>
              <span>01</span>
              <div><h3>Generate a MIDI pack</h3><p>Open the <Link href="/#workspace">ICEPUNK web studio</Link>, choose your source and musical settings, then generate a pack.</p></div>
            </li>
            <li>
              <span>02</span>
              <div><h3>Download the idea you want</h3><p>Preview the patterns, then download an individual .mid file or the pack. Keep the file somewhere easy to find in your project folder.</p></div>
            </li>
            <li>
              <span>03</span>
              <div><h3>Import it into {dawName}</h3><p>{importStep}</p></div>
            </li>
            <li>
              <span>04</span>
              <div><h3>Make it yours</h3><p>{arrangeStep}</p></div>
            </li>
          </ol>
        </section>

        <aside className="guide-note">
          <h2>ICEPUNK exports MIDI, not a DAW plugin.</h2>
          <p>The downloaded .mid file carries note and timing information. The instrument, sound design, mix and final arrangement stay in your DAW.</p>
        </aside>

        <Link className="guide-return" href="/#workspace"><span>←</span> Back to the MIDI generator</Link>
      </article>
    </main>
  );
}
