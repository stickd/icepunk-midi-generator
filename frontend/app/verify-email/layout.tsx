import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify email",
  description: "Verify your iCEPUNK account email address.",
  robots: { index: false, follow: false },
};

export default function VerifyEmailLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
