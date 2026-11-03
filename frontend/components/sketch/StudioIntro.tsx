export default function StudioIntro() {
  return (
    <header className="studio-intro">
      <div className="studio-intro-copy">
        <p className="studio-eyebrow"><span /> A playground for cold sounds</p>
        <h1>
          <span className="sr-only">MIDI Melody Generator for Producers</span>
          <span aria-hidden="true" className="studio-tagline">Cold by nature.<br /><span>Endless by sound.</span></span>
        </h1>
        <p className="studio-description">Generate MIDI melodies, preview ideas instantly and export MIDI directly into your DAW.</p>
        <div className="studio-capabilities"><span>MELODIC MIDI</span><i /><span>YOUR MIDI. YOUR SOUND.</span></div>
      </div>
    </header>
  );
}
