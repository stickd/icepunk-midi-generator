import type { Metadata } from "next";
import SketchThemeLayout from "@/components/sketch/SketchThemeLayout";

export const metadata: Metadata = {
  title: { absolute: "Free MIDI Generator for Melodies & MIDI Packs | iCEPUNK" },
  description: "Generate MIDI melodies and MIDI packs for your music. Preview, customize and export MIDI for FL Studio, Ableton, Logic and other DAWs.",
  alternates: { canonical: "/" },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "iCEPUNK",
    url: "https://icepunk.app",
    logo: "https://icepunk.app/icepunk-mark.svg",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "iCEPUNK",
    url: "https://icepunk.app",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "iCEPUNK MIDI Generator",
    url: "https://icepunk.app",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    isAccessibleForFree: true,
    description: "A MIDI melody generator for music producers. Generate, preview and export MIDI melodies and MIDI packs for your DAW.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
  },
];

export default function Home() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        type="application/ld+json"
      />
      <SketchThemeLayout />
    </>
  );
}
