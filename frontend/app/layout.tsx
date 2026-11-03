import type { Metadata } from "next";
import Link from "next/link";
import { DM_Mono, Space_Grotesk, Michroma } from "next/font/google";
import "./globals.css";
import "./studio.css";
import "./feed.css";

const inter = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const display = Michroma({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://icepunk.app"),
  title: {
    default: "iCEPUNK",
    template: "%s | iCEPUNK",
  },
  description: "Generate MIDI melodies and MIDI packs for your music. Preview, customize and export MIDI for FL Studio, Ableton, Logic and other DAWs.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "iCEPUNK",
    title: "Free MIDI Generator for Melodies & MIDI Packs | iCEPUNK",
    description: "Generate MIDI melodies and MIDI packs for your music. Preview, customize and export MIDI for your DAW.",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "iCEPUNK MIDI Generator for Producers" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free MIDI Generator for Melodies & MIDI Packs | iCEPUNK",
    description: "Generate MIDI melodies and MIDI packs for your music. Preview, customize and export MIDI for your DAW.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable} ${dmMono.variable} ${display.variable}`}>
      <body className="min-h-full flex flex-col">{children}<footer className="mx-auto flex w-full max-w-7xl justify-center gap-5 px-6 py-7 text-xs text-ice-muted"><Link href="/impressum">Impressum</Link><Link href="/datenschutz">Datenschutz</Link><Link href="/terms">Nutzungsbedingungen</Link></footer></body>
    </html>
  );
}
