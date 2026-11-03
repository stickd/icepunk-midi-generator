import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Legal notice for iCEPUNK.",
  alternates: { canonical: "/impressum" },
};

export default function ImprintPage() { return <LegalPage title="Impressum"><p><strong>[FULL_LEGAL_NAME]</strong><br />[BUSINESS_NAME_IF_APPLICABLE]<br />[SERVICEABLE_POSTAL_ADDRESS]</p><p>Kontakt: [CONTACT_EMAIL]</p><hr /><p>Angaben nur soweit zutreffend und vor Launch zu ergänzen:<br />[LEGAL_FORM_IF_APPLICABLE]<br />[AUTHORIZED_REPRESENTATIVE_IF_APPLICABLE]<br />[COMMERCIAL_REGISTER_AND_NUMBER_IF_APPLICABLE]<br />[VAT_ID_OR_W-IDNR_IF_APPLICABLE]<br />[SUPERVISORY_INFORMATION_IF_APPLICABLE]</p></LegalPage>; }
