import type { Metadata } from "next";
import SketchThemeLayout from "@/components/sketch/SketchThemeLayout";

export const metadata: Metadata = {
  title: { absolute: "Free MIDI Melody Generator for FL Studio & Any DAW | iCEPUNK" },
  description: "Generate producer-made MIDI melodies in your browser. Preview ideas, choose your sound and key, and export .mid files to FL Studio, Ableton, Logic and other DAWs.",
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    title: "Free MIDI Melody Generator – iCEPUNK",
    description: "Producer-made MIDI melodies. Generate, preview and export .mid files for your DAW.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "iCEPUNK Free MIDI Melody Generator" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free MIDI Melody Generator – iCEPUNK",
    description: "Producer-made MIDI melodies. Generate, preview and export .mid files for your DAW.",
    images: ["/opengraph-image"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://icepunk.app/#organization",
      name: "iCEPUNK",
      url: "https://icepunk.app/",
      logo: "https://icepunk.app/icepunk-mark.svg",
    },
    {
      "@type": "WebSite",
      "@id": "https://icepunk.app/#website",
      name: "iCEPUNK",
      url: "https://icepunk.app/",
      publisher: { "@id": "https://icepunk.app/#organization" },
    },
    {
      "@type": "WebApplication",
      name: "iCEPUNK MIDI Melody Generator",
      url: "https://icepunk.app/",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any (web browser)",
      isAccessibleForFree: true,
      description: "Online MIDI melody generator for music producers. Generate and export .mid files for FL Studio and other DAWs.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
      },
      publisher: { "@id": "https://icepunk.app/#organization" },
    },
  ],
};

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
