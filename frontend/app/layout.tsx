import type { Metadata } from "next";
import { Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Open-source stand-in for the closed-source "Author" typeface requested by
// design: same geometric-grotesk feel (circular counters, wide apertures).
const geistSans = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist-mono",
  display: "swap",
});

import { AmbientBlobBackground, ThemeInitializer } from "@/components/ui";

export const metadata: Metadata = {
  title: "iCEPUNK",
  description: "Generated midi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-full flex flex-col">
        <ThemeInitializer />
        <AmbientBlobBackground />
        {children}
      </body>
    </html>
  );
}
