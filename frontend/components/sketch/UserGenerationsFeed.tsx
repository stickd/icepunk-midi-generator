"use client";

import { useEffect, useMemo, useState } from "react";
import { getPublicGeneratedPackFeed } from "@/lib/api";
import type { PublicGeneratedPackFeedItem } from "@/lib/api";
import { FEED_REFRESH_EVENT } from "@/lib/events";
import { Button, EmptyState } from "@/components/ui";
import { SoundEngineSettings } from "@/hooks/useBrowserMidiPlayback";
import GenerationFeedCard from "./GenerationFeedCard";
import { toFeedGeneration } from "./feedTypes";

type UserGenerationsFeedProps = {
  onStubStatus: (message: string) => void;
  soundEngine: SoundEngineSettings;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
};

const FEED_PAGE_SIZE = 5;

export default function UserGenerationsFeed({
  onStubStatus,
  soundEngine,
  isLoggedIn = false,
  onRequireLogin,
}: UserGenerationsFeedProps) {
  const [page, setPage] = useState(0);
  const [feedItems, setFeedItems] = useState<PublicGeneratedPackFeedItem[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [feedMessage, setFeedMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    getPublicGeneratedPackFeed(page, FEED_PAGE_SIZE, controller.signal)
      .then((feed) => {
        setHasError(false);
        setFeedItems(feed.items);
        setHasNext(feed.hasNext);
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
        setHasError(true);
        setFeedMessage("Public feed is unavailable. Try again in a moment.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [page, refreshKey]);

  // Live background polling for real-time feed updates without page reloads
  useEffect(() => {
    // Only background poll on the first page
    if (page !== 0) return;

    const interval = setInterval(() => {
      getPublicGeneratedPackFeed(0, FEED_PAGE_SIZE)
        .then((feed) => {
          if (feed.items.length > 0) {
            setFeedItems((prev) => {
              const prevFirstId = prev[0]?.packId;
              const newFirstId = feed.items[0]?.packId;
              if (prevFirstId !== newFirstId || prev.length !== feed.items.length) {
                return feed.items;
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
  }, [page]);

  useEffect(() => {
    function refreshFeed() {
      setIsLoading(true);
      setHasError(false);
      setPage(0);
      setRefreshKey((currentKey) => currentKey + 1);
    }

    window.addEventListener(FEED_REFRESH_EVENT, refreshFeed);

    return () => {
      window.removeEventListener(FEED_REFRESH_EVENT, refreshFeed);
    };
  }, []);

  const generations = useMemo(() => feedItems.map(toFeedGeneration), [feedItems]);

  return (
    <section aria-labelledby="user-generations-feed" className="grid content-start gap-4">
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
          onClick={() => {
            setIsLoading(true);
            setHasError(false);
            setPage(0);
            setRefreshKey((currentKey) => currentKey + 1);
            onStubStatus("Public generated feed refreshed and sorted by newest packs.");
          }}
          type="button"
        >
          Refresh ☰
        </button>
      </div>

      <p className="text-sm text-ice-secondary" role="status">
        {isLoading ? "Loading public generated MIDI feed..." : feedMessage}
      </p>

      {hasError ? (
        <EmptyState
          action={
            <Button
              onClick={() => {
                setIsLoading(true);
                setHasError(false);
                setRefreshKey((currentKey) => currentKey + 1);
              }}
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

      {!hasError && !isLoading && generations.length === 0 ? (
        <EmptyState
          description="Generate a public MIDI pack and it will appear here."
          title="No public generated MIDI packs yet."
        />
      ) : null}

      {generations.length > 0 ? (
        <div className="grid gap-4">
          {generations.map((generation) => (
            <GenerationFeedCard
              generation={generation}
              isLoggedIn={isLoggedIn}
              key={generation.id}
              onRequireLogin={onRequireLogin}
              onStubStatus={onStubStatus}
              soundEngine={soundEngine}
            />
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-center gap-3 pt-2">
        <Button
          disabled={page === 0 || isLoading}
          onClick={() => {
            setIsLoading(true);
            setHasError(false);
            setPage((currentPage) => Math.max(0, currentPage - 1));
          }}
          size="sm"
          type="button"
        >
          &lt;
        </Button>
        <span className="text-xs text-ice-muted">Page {page + 1}</span>
        <Button
          disabled={!hasNext || isLoading}
          onClick={() => {
            setIsLoading(true);
            setHasError(false);
            setPage((currentPage) => currentPage + 1);
          }}
          size="sm"
          type="button"
        >
          &gt;
        </Button>
      </div>
    </section>
  );
}
