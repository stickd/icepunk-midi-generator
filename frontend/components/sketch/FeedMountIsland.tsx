"use client";

import dynamic from "next/dynamic";
import { RefObject, UIEvent, useCallback, useState } from "react";
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
    <section
      aria-labelledby="user-generations-feed-heading"
      className="grid gap-4"
      onFocus={onIntent}
      onTouchStart={onIntent}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2
            className="flex items-center gap-3 pl-1 text-3xl font-bold tracking-tight text-white sm:text-4xl"
            id="user-generations-feed-heading"
          >
            <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center p-0.5">
              <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-[3px] bg-[#6ee7ff] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-[3px] bg-[#6ee7ff] shadow-[0_0_14px_#6ee7ff]" />
            </span>
            Feed
          </h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-[#6ee7ff]/30 bg-[#6ee7ff]/10 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-[#6ee7ff]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6ee7ff] animate-pulse" />
            Live
          </span>
        </div>
      </div>

      <div className="grid gap-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            className="overflow-hidden rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-white/[0.035] p-0 shadow-[var(--ice-shadow-card)]"
            key={`feed-shell-card-${index}`}
          >
            <div className="border-b border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 animate-pulse rounded-full bg-white/[0.08]" />
                <div className="grid gap-1">
                  <div className="h-3.5 w-24 animate-pulse rounded bg-white/[0.08]" />
                  <div className="h-2.5 w-14 rounded bg-white/[0.04]" />
                </div>
              </div>
              <div className="mt-2.5 h-5 w-48 animate-pulse rounded bg-white/[0.08]" />
            </div>
            <div className="p-3">
              <div className="flex h-[210px] items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04] p-3">
                <span className="text-xs text-ice-muted">Click or scroll to load feed.</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type FeedMountIslandProps = {
  feedScrollRef: RefObject<HTMLDivElement | null>;
  handleFeedScroll: (event?: UIEvent<HTMLElement>) => void;
  isLoggedIn: boolean;
  onRequireLogin: () => void;
  onStubStatus: (message: string) => void;
  playback: ReturnType<typeof useBrowserMidiPlayback>;
  soundEngine: SoundEngineSettings;
};

export default function FeedMountIsland({
  feedScrollRef,
  handleFeedScroll,
  isLoggedIn,
  onRequireLogin,
  onStubStatus,
  playback,
  soundEngine,
}: FeedMountIslandProps) {
  const [isFeedMounted, setIsFeedMounted] = useState(false);

  const triggerFeedMount = useCallback(() => {
    setIsFeedMounted(true);
  }, []);

  return (
    <div className="min-w-0">
      <div
        ref={feedScrollRef}
        aria-label="Community feed"
        className="ice-scrollbar grid gap-4 overflow-y-auto pr-1 lg:max-h-[calc(100vh-4.5rem)]"
        onClick={triggerFeedMount}
        onFocus={triggerFeedMount}
        onScroll={(event) => {
          triggerFeedMount();
          handleFeedScroll(event);
        }}
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
            soundEngine={soundEngine}
          />
        ) : (
          <FeedShell onIntent={triggerFeedMount} />
        )}
      </div>
    </div>
  );
}
