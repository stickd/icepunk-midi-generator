import IceCrystal from "./IceCrystal";

export default function StudioIntro() {
  return (
    <header className="studio-intro">
      <div className="studio-intro-copy">
        <p className="studio-eyebrow"><span /> A playground for cold sounds</p>
        <h1>Cold by nature.<br /><span>Endless by design.</span></h1>
        <p className="studio-description">Turn a spark into your next sound. Generate, shape and discover MIDI in your own creative orbit.</p>
        <div className="studio-capabilities"><span>MELODIES & DRUMS</span><i /><span>YOUR MIDI. YOUR SOUND.</span></div>
      </div>
      <div className="studio-art"><IceCrystal /><span className="studio-art-caption">iC / SOUND IN ITS PUREST FORM</span></div>
    </header>
  );
}
