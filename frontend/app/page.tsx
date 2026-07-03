import AppShell from "@/components/AppShell";
import FeedbackSection from "@/components/FeedbackSection";
import Hero from "@/components/Hero";
import HomeControls from "@/components/HomeControls";
import UploadProjectSection from "@/components/UploadProjectSection";

export default function Home() {
  return (
    <AppShell>
      <Hero>
        <HomeControls />
      </Hero>

      <UploadProjectSection />

      <FeedbackSection />
    </AppShell>
  );
}
