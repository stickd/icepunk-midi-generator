import type { Metadata } from "next";
import ProfileView from "@/components/profile/ProfileView";

type ProfilePageProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const decoded = decodeURIComponent(username);

  return {
    title: `${decoded} — iCEPUNK`,
    description: `MIDI packs published by ${decoded} on iCEPUNK.`,
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <ProfileView username={decodeURIComponent(username)} />
    </main>
  );
}
