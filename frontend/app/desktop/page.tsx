import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import DesktopWaitlistForm from "@/components/DesktopWaitlistForm";

export const metadata: Metadata = {
  title: "Desktop MIDI Generator for PC – Offline & Unlimited",
  description: "Join the iCEPUNK Desktop waitlist for unlimited local MIDI generation, offline projects and direct DAW handoff. Desktop is in development.",
  alternates: { canonical: "/desktop" },
  openGraph: {
    type: "website",
    siteName: "iCEPUNK",
    title: "Desktop MIDI Generator for PC – Offline & Unlimited | iCEPUNK",
    description: "Join the iCEPUNK Desktop waitlist for unlimited local MIDI generation, offline projects and direct DAW handoff.",
    url: "/desktop",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "iCEPUNK MIDI Generator for Producers" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Desktop MIDI Generator for PC – Offline & Unlimited | iCEPUNK",
    description: "Join the iCEPUNK Desktop waitlist for unlimited local MIDI generation, offline projects and direct DAW handoff.",
    images: ["/opengraph-image"],
  },
};

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
        <Link className="desktop-hero-action" href="/#workspace"><span>→</span> Use the web MIDI generator</Link>
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

      <section className="desktop-waitlist" aria-labelledby="desktop-waitlist-title">
        <div>
          <p className="desktop-kicker">EARLY ACCESS</p>
          <h2 id="desktop-waitlist-title">Get Desktop first.</h2>
          <p>Join the waitlist for the upcoming desktop version: unlimited MIDI generations, local projects and a focused workflow built for longer sessions.</p>
        </div>
        <DesktopWaitlistForm />
      </section>
    </main>
  );
}
