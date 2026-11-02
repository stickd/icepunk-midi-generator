import Link from "next/link";
import Image from "next/image";

const roadmap = [
  ["01", "Native studio", "A focused ICEPUNK workspace for desktop music-making."],
  ["02", "Local projects", "Keep packs, MIDI ideas and sound settings together in one place."],
  ["03", "DAW handoff", "Open generated MIDI quickly in the workflow you already use."],
];

export default function DesktopPage() {
  return (
    <main className="desktop-page">
      <nav className="desktop-nav" aria-label="Desktop page navigation">
        <Link className="studio-wordmark" href="/">
          <span className="studio-logo" aria-hidden="true">✦</span> iCEPUNK<span className="studio-wordmark-label">MIDI LAB</span>
        </Link>
        <Link className="desktop-back" href="/#workspace">Open web studio ↗</Link>
      </nav>

      <section className="desktop-hero" aria-labelledby="desktop-title">
        <p className="desktop-kicker">ICEPUNK FOR DESKTOP · IN DEVELOPMENT</p>
        <h1 id="desktop-title">A colder, closer way to make MIDI.</h1>
        <p>We are shaping a desktop companion for longer sessions, local projects and a more direct handoff into your DAW.</p>
      </section>

      <section className="desktop-product-preview" aria-labelledby="desktop-preview-title">
        <div className="desktop-section-heading">
          <div>
            <p className="desktop-kicker">DESKTOP APP · REAL PREVIEW</p>
            <h2 id="desktop-preview-title">Your ideas, without the web limit.</h2>
          </div>
          <p className="desktop-product-copy">When ICEPUNK Desktop is ready, you will be able to work locally and create as many fresh MIDI ideas as you need — without a web generation limit.</p>
        </div>
        <figure>
          <Image src="/icepunk-desktop-preview.png" alt="ICEPUNK desktop MIDI generator with five generated MIDI patterns" width={1694} height={1694} priority />
          <figcaption>Desktop is in development. The web studio is available now.</figcaption>
        </figure>
      </section>

      <section className="desktop-roadmap" aria-labelledby="roadmap-title">
        <div className="desktop-section-heading">
          <p className="desktop-kicker">WORKING ROADMAP</p>
          <h2 id="roadmap-title">What we are building</h2>
        </div>
        <ol>
          {roadmap.map(([number, title, copy]) => (
            <li key={number}>
              <span>{number}</span>
              <div><h3>{title}</h3><p>{copy}</p></div>
              <em>TODO</em>
            </li>
          ))}
        </ol>
      </section>

      <section className="desktop-note" aria-label="Current availability">
        <span aria-hidden="true">✦</span>
        <p>The web studio is available now. The desktop app is a prepared space — no download is available yet.</p>
      </section>
    </main>
  );
}
