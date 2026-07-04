import type { Metadata } from "next";
import ProfileView from "@/components/profile/ProfileView";

type ProfilePageProps = {
  params: Promise<{ username: string }>;
};

function safeDecode(str?: string): string {
  if (!str) return "";
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const decoded = safeDecode(username);

  return {
    title: `${decoded} — iCEPUNK`,
    description: `MIDI packs published by ${decoded} on iCEPUNK.`,
  };
}

import { EtherealShadowBackground } from "@/components/ui/ethereal-shadow";

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;

  return (
    <EtherealShadowBackground>
      <main className="mx-auto w-full max-w-5xl px-6 py-8 min-h-screen">
        <ProfileView username={safeDecode(username)} />
      </main>
    </EtherealShadowBackground>
  );
}
