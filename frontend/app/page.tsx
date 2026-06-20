import FeedbackSection from "@/components/FeedbackSection";
import Hero from "@/components/Hero";
import HomeControls from "@/components/HomeControls";
import Snowfall from "@/components/Snowfall";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(56,189,248,0.18),transparent_38%)]" />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0)_0%,rgba(2,6,23,0.25)_100%)]" />

      <Snowfall />

      <Hero>
        <HomeControls />
      </Hero>

      <FeedbackSection />
    </main>
  );
}
