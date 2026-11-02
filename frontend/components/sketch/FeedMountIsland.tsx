"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { SoundEngineSettings, useBrowserMidiPlayback } from "@/hooks/useBrowserMidiPlayback";

// This module reads browser visibility during initialization, so it remains
// client-only. It is still requested on the first render rather than after an
// interaction, keeping the community feed immediately available.
const UserGenerationsFeed = dynamic(() => import("./UserGenerationsFeed"), {
  loading: () => <section aria-label="Loading community feed" className="min-h-[220px]" />,
  ssr: false,
});

type FeedMountIslandProps = {
  isLoggedIn: boolean;
  onRequireLogin: () => void;
  onStubStatus: (message: string) => void;
  playback: ReturnType<typeof useBrowserMidiPlayback>;
  soundEngine: SoundEngineSettings;
};

export default function FeedMountIsland({
  isLoggedIn,
  onRequireLogin,
  onStubStatus,
  playback,
  soundEngine,
}: FeedMountIslandProps) {
  const [previewVisibilityRoot, setPreviewVisibilityRoot] = useState<HTMLDivElement | null>(null);

  const setFeedScrollRoot = useCallback((element: HTMLDivElement | null) => {
    setPreviewVisibilityRoot((current) => current === element ? current : element);
  }, []);

  return (
    <div className="studio-community min-w-0" id="community">
      <div
        ref={setFeedScrollRoot}
        aria-label="Community feed"
        className="ice-scrollbar studio-feed-scroll"
        role="region"
        tabIndex={0}
      >
        <UserGenerationsFeed
          isLoggedIn={isLoggedIn}
          onRequireLogin={onRequireLogin}
          onStubStatus={onStubStatus}
          playback={playback}
          previewVisibilityRoot={previewVisibilityRoot}
          soundEngine={soundEngine}
        />
      </div>
    </div>
  );
}
