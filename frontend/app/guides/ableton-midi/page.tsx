import type { Metadata } from "next";
import GuidePage from "@/components/GuidePage";

export const metadata: Metadata = {
  title: "How to Import MIDI into Ableton Live",
  description: "Generate a MIDI idea in iCEPUNK, download the .mid file and bring it into Ableton Live to choose instruments and arrange your track.",
  alternates: { canonical: "/guides/ableton-midi" },
  openGraph: {
    type: "article",
    title: "How to Import MIDI into Ableton Live | iCEPUNK",
    description: "A short workflow for generating, downloading and arranging an iCEPUNK MIDI file in Ableton Live.",
    url: "/guides/ableton-midi",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "iCEPUNK MIDI Generator for Producers" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Import MIDI into Ableton Live | iCEPUNK",
    description: "Generate, download and arrange an iCEPUNK MIDI file in Ableton Live.",
    images: ["/opengraph-image"],
  },
};

export default function AbletonMidiGuidePage() {
  return <GuidePage dawName="Ableton Live" title="How to import an ICEPUNK MIDI file into Ableton Live." intro="Use ICEPUNK to make a MIDI starting point, then bring the downloaded .mid file into Ableton Live and shape it with your own instruments and arrangement." importStep="Drag the downloaded .mid file from your computer into an Ableton Live MIDI track or Session View. Ableton creates a MIDI clip that you can open in the Clip View editor." arrangeStep="Load an instrument on the track, then edit the clip’s notes, timing and velocity to fit your track. Build the surrounding arrangement with your own sound choices." />;
}
