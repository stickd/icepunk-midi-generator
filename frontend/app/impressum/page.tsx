import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import ImpressumContactForm from "@/components/ImpressumContactForm";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Legal notice for iCEPUNK.",
  alternates: { canonical: "/impressum" },
};

export default function ImprintPage() {
  return <LegalPage title="Impressum">
    <p><strong>Danylo Nikulin</strong><br />Ahrstraße 1<br />53424 Remagen<br />Deutschland</p>
    <p>Kontakt: <a className="text-[color:var(--ice-accent)]" href="mailto:stickd999@gmail.com">stickd999@gmail.com</a></p>
    <ImpressumContactForm />
  </LegalPage>;
}
