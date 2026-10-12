"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { SoundEngineSettings, useBrowserMidiPlayback } from "@/hooks/useBrowserMidiPlayback";

const UserGenerationsFeed = dynamic(() => import("./UserGenerationsFeed"), {
  loading: () => (
    <section aria-labelledby="user-generations-feed-placeholder" className="grid min-h-[220px] content-start gap-4">
      <h2 className="pl-1 text-3xl font-bold tracking-tight text-white sm:text-4xl" id="user-generations-feed-placeholder">
        Latest community packs
      </h2>
    </section>
  ),
  ssr: false,
});

function FeedShell({ onIntent }: { onIntent: () => void }) {
  return (
    <section aria-labelledby="user-generations-feed-heading" className="studio-discover">
      <div className="studio-section-title"><h2 id="user-generations-feed-heading">Community<span aria-hidden="true"> / 02</span></h2><span className="studio-eyebrow">DISCOVER A NEW FREQUENCY</span></div>
      <div className="studio-discover-card studio-glass">
        <div className="studio-discover-art" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
        <span className="studio-eyebrow">MADE IN THE COMMUNITY</span>
        <h3>A shared state of sound.</h3>
        <p>Find your next spark in original MIDI packs.<br />Listen, explore and make them your own.</p>
        <button className="studio-explore-button" onClick={onIntent} type="button">Explore community <span aria-hidden="true">↗</span></button>
      </div>
      <div className="studio-note"><span aria-hidden="true">↳</span><p>From the first note to the final texture.<br /><strong>Keep creating. Stay cold.</strong></p><span className="studio-note-mark" aria-hidden="true">✳</span></div>
    </section>
  );
}

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
  const [isFeedMounted, setIsFeedMounted] = useState(false);
  const [previewVisibilityRoot, setPreviewVisibilityRoot] = useState<HTMLDivElement | null>(null);

  const triggerFeedMount = useCallback(() => {
    setIsFeedMounted(true);
  }, []);

  const setFeedScrollRoot = useCallback((element: HTMLDivElement | null) => {
    setPreviewVisibilityRoot((current) => current === element ? current : element);
  }, []);

  return (
    <div className="studio-community min-w-0" id="community">
      <div
        ref={setFeedScrollRoot}
        aria-label="Community feed"
        className="ice-scrollbar studio-feed-scroll"
        onClick={triggerFeedMount}
        onFocus={triggerFeedMount}
        onScroll={triggerFeedMount}
        onTouchStart={triggerFeedMount}
        role="region"
        tabIndex={0}
        onWheel={triggerFeedMount}
      >
        {isFeedMounted ? (
          <UserGenerationsFeed
            isLoggedIn={isLoggedIn}
            onRequireLogin={onRequireLogin}
            onStubStatus={onStubStatus}
            playback={playback}
            previewVisibilityRoot={previewVisibilityRoot}
            soundEngine={soundEngine}
          />
        ) : (
          <FeedShell onIntent={triggerFeedMount} />
        )}
      </div>
    </div>
  );
}
