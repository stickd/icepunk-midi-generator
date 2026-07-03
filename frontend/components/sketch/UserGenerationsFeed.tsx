"use client";

import { useEffect, useMemo, useState } from "react";
import { getPublicGeneratedPackFeed } from "@/lib/api";
import type { PublicGeneratedPackFeedItem } from "@/lib/api";
import { FEED_REFRESH_EVENT } from "@/lib/events";
import { Button, EmptyState } from "@/components/ui";
import GenerationFeedCard from "./GenerationFeedCard";
import { FeedGeneration } from "./feedTypes";

type UserGenerationsFeedProps = {
  onStubStatus: (message: string) => void;
};

const FEED_PAGE_SIZE = 5;

function formatRelativeTime(uploadedAt: string) {
  const timestamp = Date.parse(uploadedAt);

  if (Number.isNaN(timestamp)) {
    return "new";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60_000));

  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes} min`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr`;

  return `${Math.round(diffHours / 24)} d`;
}

function toGeneration(item: PublicGeneratedPackFeedItem): FeedGeneration {
  return {
    downloads: 0,
    id: item.packId,
    items: item.items,
    midiCount: item.items.length,
    packDownloadUrl: item.packDownloadUrl,
    sound: item.type === "DRUMS" ? "Generated drums" : "Generated melody",
    timeAgo: formatRelativeTime(item.createdAt),
    title: item.name,
    type: item.type,
    bpm: item.bpm,
    uploadedAt: item.createdAt,
    username: item.ownerUsername,
  };
}

export default function UserGenerationsFeed({ onStubStatus }: UserGenerationsFeedProps) {
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

  const generations = useMemo(() => feedItems.map(toGeneration), [feedItems]);

  return (
    <section aria-labelledby="user-generations-feed" className="grid content-start gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-ice-primary" id="user-generations-feed">
          User Generations Feed
        </h2>
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
              key={generation.id}
              onStubStatus={onStubStatus}
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
          Previous
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
          Next
        </Button>
      </div>
    </section>
  );
}
