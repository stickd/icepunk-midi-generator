import Link from "next/link";

const steps = [
  ["01", "Choose a starting point", "Pick the Factory collection or bring in your own MIDI source, then set the key, scale and sound that fit the idea."],
  ["02", "Generate melodic MIDI", "Create a pack of fresh MIDI patterns from the settings you chose. A pack can include up to 10 MIDI ideas."],
  ["03", "Preview the movement", "Listen in the browser, switch between the generated patterns and keep the one that feels right."],
  ["04", "Take it to your DAW", "Download the .mid file and arrange it with your own instruments in FL Studio, Ableton Live, Logic Pro or another MIDI-ready DAW."],
];

const faqs = [
  ["What is ICEPUNK?", "ICEPUNK is a browser-based MIDI melody generator for finding melodic starting points. You choose the source and musical settings, generate a MIDI pack, preview it and download the ideas you want to keep."],
  ["Is ICEPUNK free?", "Yes. The web studio is currently free to use within its daily generation limits."],
  ["Can I use ICEPUNK MIDI in FL Studio, Ableton, Logic or another DAW?", "Yes. ICEPUNK exports standard .mid files. Import the downloaded file into any DAW that supports MIDI, then choose your own instruments, sounds and arrangement."],
  ["What does ICEPUNK export?", "Each generated idea can be downloaded as a standard MIDI (.mid) file. You can also download the generated pack when that is useful for your session."],
  ["What are the current generation limits?", "Guests can create 3 packs per day. Verified accounts can create 5 packs per day. Each pack can contain up to 10 generated MIDI patterns."],
  ["Is ICEPUNK Desktop available?", "Not yet. Desktop is in development, and there is no release date to announce. You can use the web studio now or join the Desktop waitlist for updates."],
];

export default function SeoContentSections() {
  return (
    <div className="studio-seo-content">
      <section className="studio-seo-section studio-how-it-works" aria-labelledby="how-it-works-title">
        <div className="studio-seo-heading">
          <p className="studio-eyebrow">Workflow / 02</p>
          <h2 id="how-it-works-title">How ICEPUNK works.</h2>
          <p>From a cold starting point to a MIDI idea you can shape in your own session.</p>
        </div>
        <ol className="studio-workflow-list">
          {steps.map(([number, title, copy]) => (
            <li key={number}>
              <span aria-hidden="true">{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="studio-seo-section studio-daw-guides" aria-labelledby="daw-guides-title">
        <div className="studio-seo-heading">
          <p className="studio-eyebrow">Quick guides / 03</p>
          <h2 id="daw-guides-title">Bring your MIDI into the session.</h2>
          <p>Two short starting points for getting a downloaded ICEPUNK .mid file into a DAW.</p>
        </div>
        <div className="studio-guide-links">
          <Link href="/guides/fl-studio-midi">
            <span>FL Studio</span>
            <strong>Import an ICEPUNK MIDI idea <b aria-hidden="true">↗</b></strong>
          </Link>
          <Link href="/guides/ableton-midi">
            <span>Ableton Live</span>
            <strong>Start arranging a downloaded .mid <b aria-hidden="true">↗</b></strong>
          </Link>
        </div>
      </section>

      <section className="studio-seo-section studio-faq" aria-labelledby="faq-title">
        <div className="studio-seo-heading">
          <p className="studio-eyebrow">Practical notes / 04</p>
          <h2 id="faq-title">Questions, answered.</h2>
        </div>
        <div className="studio-faq-list">
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
