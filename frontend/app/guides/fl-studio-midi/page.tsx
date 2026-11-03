import type { Metadata } from "next";
import GuidePage from "@/components/GuidePage";

export const metadata: Metadata = {
  title: "How to Import MIDI into FL Studio",
  description: "Generate a MIDI idea in iCEPUNK, download the .mid file and bring it into FL Studio to choose instruments and arrange your track.",
  alternates: { canonical: "/guides/fl-studio-midi" },
  openGraph: {
    type: "article",
    title: "How to Import MIDI into FL Studio | iCEPUNK",
    description: "A short workflow for generating, downloading and arranging an iCEPUNK MIDI file in FL Studio.",
    url: "/guides/fl-studio-midi",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "iCEPUNK MIDI Generator for Producers" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Import MIDI into FL Studio | iCEPUNK",
    description: "Generate, download and arrange an iCEPUNK MIDI file in FL Studio.",
    images: ["/opengraph-image"],
  },
};

export default function FlStudioMidiGuidePage() {
  return <GuidePage dawName="FL Studio" title="How to import an ICEPUNK MIDI file into FL Studio." intro="Use ICEPUNK to make a MIDI starting point, then bring the downloaded .mid file into FL Studio and build the sound around it." importStep="Drag the downloaded .mid file from your computer into FL Studio, or import it from FL Studio’s file workflow. Place the notes in the channel or instrument you want to use, then open the Piano roll when you want to edit them." arrangeStep="Choose an instrument, change the notes or rhythm, and arrange the MIDI around your own drums, bass and automation. The generated file is a starting point, not a finished track." />;
}
