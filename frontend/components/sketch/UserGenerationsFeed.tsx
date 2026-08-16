"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPublicGeneratedPackFeed } from "@/lib/api";
import type { PublicGeneratedPackFeedItem } from "@/lib/api";
import { FEED_REFRESH_EVENT } from "@/lib/events";
import { Button, EmptyState } from "@/components/ui";
import { SoundEngineSettings, useBrowserMidiPlayback } from "@/hooks/useBrowserMidiPlayback";
import GenerationFeedCard from "./GenerationFeedCard";
import { toFeedGeneration } from "./feedTypes";

type UserGenerationsFeedProps = {
  onStubStatus: (message: string) => void;
  playback: ReturnType<typeof useBrowserMidiPlayback>;
  soundEngine: SoundEngineSettings;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
  previewVisibilityRoot?: HTMLElement | null;
};

const FEED_PAGE_SIZE = 2;

function mergeUniqueFeedItems(
  currentItems: PublicGeneratedPackFeedItem[],
  nextItems: PublicGeneratedPackFeedItem[],
) {
  const seen = new Set(currentItems.map((item) => item.packId));
  const merged = [...currentItems];

  nextItems.forEach((item) => {
    if (seen.has(item.packId)) return;
    seen.add(item.packId);
    merged.push(item);
  });

  return merged;
}

function mergeFreshFeedItems(
  currentItems: PublicGeneratedPackFeedItem[],
  freshItems: PublicGeneratedPackFeedItem[],
) {
  const freshIds = new Set(freshItems.map((item) => item.packId));
  return [
    ...freshItems,
    ...currentItems.filter((item) => !freshIds.has(item.packId)),
  ];
}

export default function UserGenerationsFeed({
  onStubStatus,
  playback,
  soundEngine,
  isLoggedIn = false,
  onRequireLogin,
  previewVisibilityRoot = null,
}: UserGenerationsFeedProps) {
  const [feedItems, setFeedItems] = useState<PublicGeneratedPackFeedItem[]>([]);
  const [nextPage, setNextPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [isFeedActive, setIsFeedActive] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [feedMessage, setFeedMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasFeedScrollIntent, setHasFeedScrollIntent] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(() => document.visibilityState !== "hidden");
  const feedRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inFlightPageRef = useRef<number | null>(null);
  const isFeedActiveRef = useRef(false);
  const isFeedVisibleRef = useRef(false);
  const hasFeedScrollIntentRef = useRef(false);

  const activateFeed = useCallback(() => {
    if (isFeedActiveRef.current) return;
    isFeedActiveRef.current = true;
    setIsFeedActive(true);
    setIsInitialLoading(true);
  }, []);

  const requestFeedRefresh = useCallback(() => {
    setIsInitialLoading(true);
    setIsPageLoading(false);
    setHasError(false);
    setNextPage(0);
    setRefreshKey((currentKey) => currentKey + 1);
  }, []);

  const refreshFeed = useCallback(() => {
    if (!isFeedActiveRef.current) return;
    requestFeedRefresh();
  }, [requestFeedRefresh]);

  useEffect(() => {
    if (!isFeedActive || !isPageVisible) return;

    const controller = new AbortController();
    inFlightPageRef.current = 0;

    getPublicGeneratedPackFeed(0, FEED_PAGE_SIZE, controller.signal)
      .then((feed) => {
        setHasError(false);
        setFeedItems(feed.items);
        setHasNext(feed.hasNext);
        setNextPage(feed.hasNext ? 1 : 0);
        setFeedMessage(
          feed.totalItems > 0
            ? `${feed.totalItems.toLocaleString()} public generated packs discovered.`
            : "No public generated packs yet. Generate a public MIDI pack to start the feed.",
        );
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;

        setFeedItems([]);
        setHasNext(false);
        setNextPage(0);
        setHasError(true);
        setFeedMessage("Public feed is unavailable. Try again in a moment.");
      })
      .finally(() => {
        inFlightPageRef.current = null;
        if (!controller.signal.aborted) {
          setIsInitialLoading(false);
        }
      });

    return () => controller.abort();
  }, [isFeedActive, isPageVisible, refreshKey]);

  const loadNextPage = useCallback(() => {
    if (!isFeedActive || !isPageVisible || isInitialLoading || isPageLoading || hasError || !hasNext) return;
    if (inFlightPageRef.current !== null) return;

    const pageToLoad = nextPage;
    inFlightPageRef.current = pageToLoad;
    setIsPageLoading(true);

    getPublicGeneratedPackFeed(pageToLoad, FEED_PAGE_SIZE)
      .then((feed) => {
        setHasError(false);
        setFeedItems((currentItems) =>
          mergeUniqueFeedItems(currentItems, feed.items),
        );
        setHasNext(feed.hasNext);
        setNextPage(feed.hasNext ? pageToLoad + 1 : pageToLoad);
        setFeedMessage(
          feed.totalItems > 0
            ? `${feed.totalItems.toLocaleString()} public generated packs discovered.`
            : "No public generated packs yet.",
        );
      })
      .catch(() => {})
      .finally(() => {
        if (inFlightPageRef.current === pageToLoad) {
          inFlightPageRef.current = null;
        }
        setIsPageLoading(false);
      });
  }, [hasError, hasNext, isFeedActive, isInitialLoading, isPageLoading, isPageVisible, nextPage]);

  useEffect(() => {
    activateFeed();
  }, [activateFeed]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState !== "hidden");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    const markScrollIntent = () => {
      if (!hasFeedScrollIntentRef.current) {
        hasFeedScrollIntentRef.current = true;
        setHasFeedScrollIntent(true);
      }

      if (isFeedVisibleRef.current) {
        activateFeed();
      }
    };

    window.addEventListener("scroll", markScrollIntent, { passive: true });
    window.addEventListener("wheel", markScrollIntent, { passive: true });
    window.addEventListener("touchstart", markScrollIntent, { passive: true });
    window.addEventListener("keydown", markScrollIntent);

    return () => {
      window.removeEventListener("scroll", markScrollIntent);
      window.removeEventListener("wheel", markScrollIntent);
      window.removeEventListener("touchstart", markScrollIntent);
      window.removeEventListener("keydown", markScrollIntent);
    };
  }, [activateFeed]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !isFeedActive || !isPageVisible || !hasNext || hasError || isInitialLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!hasFeedScrollIntentRef.current) return;
        if (entries.some((entry) => entry.isIntersecting)) {
          loadNextPage();
        }
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasError, hasFeedScrollIntent, hasNext, isFeedActive, isInitialLoading, isPageVisible, loadNextPage]);

  // Live background polling for real-time feed updates without page reloads
  useEffect(() => {
    if (!isFeedActive || !isPageVisible) return;

    const interval = setInterval(() => {
      getPublicGeneratedPackFeed(0, FEED_PAGE_SIZE)
        .then((feed) => {
          if (feed.items.length > 0) {
            setFeedItems((prev) => {
              const prevFirstId = prev[0]?.packId;
              const newFirstId = feed.items[0]?.packId;
              if (prevFirstId !== newFirstId) {
                return mergeFreshFeedItems(prev, feed.items);
              }
              return prev;
            });
            setHasNext(feed.hasNext);
            setFeedMessage(
              feed.totalItems > 0
                ? `${feed.totalItems.toLocaleString()} public generated packs discovered.`
                : "No public generated packs yet.",
            );
          }
        })
        .catch(() => {});
    }, 10000);

    return () => clearInterval(interval);
  }, [isFeedActive, isPageVisible]);

  useEffect(() => {
    window.addEventListener(FEED_REFRESH_EVENT, refreshFeed);

    return () => {
      window.removeEventListener(FEED_REFRESH_EVENT, refreshFeed);
    };
  }, [refreshFeed]);

  const generations = useMemo(() => feedItems.map(toFeedGeneration), [feedItems]);

  const handleRefreshClick = useCallback(() => {
    if (!isFeedActiveRef.current) {
      activateFeed();
    }

    requestFeedRefresh();
    onStubStatus("Public generated feed refreshed and sorted by newest packs.");
  }, [activateFeed, onStubStatus, requestFeedRefresh]);

  return (
    <section aria-labelledby="user-generations-feed" className="grid content-start gap-4" ref={feedRef}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-3 pl-1 text-3xl font-bold tracking-tight text-white sm:text-4xl" id="user-generations-feed">
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
        <button
          className="text-xs font-medium uppercase tracking-[0.06em] text-ice-muted transition-colors duration-150 ease-out hover:text-ice-primary"
          onClick={handleRefreshClick}
          type="button"
        >
          Refresh ☰
        </button>
      </div>

      <p className="text-sm text-ice-secondary" role="status">
        {!isFeedActive
          ? "Scroll to load public generated MIDI feed."
          : isInitialLoading
            ? "Loading public generated MIDI feed..."
            : feedMessage}
      </p>

      {hasError ? (
        <EmptyState
          action={
            <Button
              onClick={refreshFeed}
              size="sm"
              type="button"
            >
              Retry
            </Button>
          }
          description="Check backend/API availability, then refresh."
          title="Feed could not load."
        />
      ) : null}

      {!hasError && isFeedActive && !isInitialLoading && generations.length === 0 ? (
        <EmptyState
          description="Generate a public MIDI pack and it will appear here."
          title="No public generated MIDI packs yet."
        />
      ) : null}

      {generations.length > 0 ? (
        <div className="grid gap-4">
          {generations.map((generation) => (
            <div key={generation.id} style={{ contentVisibility: "auto", containIntrinsicSize: "0 280px" }}>
              <GenerationFeedCard
                generation={generation}
                isLoggedIn={isLoggedIn}
                onRequireLogin={onRequireLogin}
                onStubStatus={onStubStatus}
                playback={playback}
                previewVisibilityRoot={previewVisibilityRoot}
                soundEngine={soundEngine}
              />
            </div>
          ))}
        </div>
      ) : null}

      <div
        aria-hidden={!hasNext}
        className="grid min-h-8 place-items-center pt-2 text-xs text-ice-muted"
        ref={sentinelRef}
      >
        {isPageLoading ? "Loading more packs..." : hasNext ? "Scroll for more" : "End of feed"}
      </div>
    </section>
  );
}
