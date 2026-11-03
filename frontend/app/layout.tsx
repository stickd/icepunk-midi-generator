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
    default: "iCEPUNK – Free MIDI Melody Generator",
    template: "%s | iCEPUNK",
  },
  description: "Producer-made MIDI melodies in your browser: generate, preview and drag the notes into FL Studio or any DAW. Choose your sound and key.",
  applicationName: "iCEPUNK",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "iCEPUNK",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "iCEPUNK MIDI Generator for Producers" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
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
