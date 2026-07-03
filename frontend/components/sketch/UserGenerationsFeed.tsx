"use client";

import { useEffect, useMemo, useState } from "react";
import { getPublicUploadFeed, PublicUploadFeedItem } from "@/lib/api";
import GenerationFeedCard from "./GenerationFeedCard";
import SketchButton from "./SketchButton";
import { MockGeneration, mockGenerations } from "./mockData";
import styles from "./sketchTheme.module.css";

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

function metadataString(metadata: Record<string, unknown>, key: string, fallback: string) {
  const value = metadata[key];

  return typeof value === "string" && value.trim() ? value : fallback;
}

function toGeneration(item: PublicUploadFeedItem): MockGeneration {
  return {
    downloads: 0,
    id: String(item.id),
    midiCount: 1,
    midiUrl: item.midiUrl,
    sampleUrl: item.sampleUrl,
    sound: metadataString(item.metadata, "sampleOriginalFilename", "Uploaded one-shot"),
    timeAgo: formatRelativeTime(item.uploadedAt),
    title: item.title,
    uploadedAt: item.uploadedAt,
    username: item.ownerUsername,
  };
}

export default function UserGenerationsFeed({ onStubStatus }: UserGenerationsFeedProps) {
  const [page, setPage] = useState(0);
  const [feedItems, setFeedItems] = useState<PublicUploadFeedItem[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [feedMessage, setFeedMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    getPublicUploadFeed(page, FEED_PAGE_SIZE, controller.signal)
      .then((feed) => {
        setFeedItems(feed.items);
        setHasNext(feed.hasNext);
        setFeedMessage(
          feed.totalItems > 0
            ? `${feed.totalItems.toLocaleString()} public uploads discovered.`
            : "No public uploads yet. Showing sketch examples.",
        );
      })
      .catch(() => {
        setFeedItems([]);
        setHasNext(false);
        setFeedMessage("Public feed is unavailable. Showing sketch examples.");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [page]);

  const generations = useMemo(
    () => (feedItems.length > 0 ? feedItems.map(toGeneration) : mockGenerations),
    [feedItems],
  );

  return (
    <section className={styles.feedSection} aria-labelledby="user-generations-feed">
      <div className={styles.feedHeader}>
        <h2 className={styles.feedTitle} id="user-generations-feed">
          User Generations Feed
        </h2>
        <button
          className={styles.sortButton}
          type="button"
          onClick={() => onStubStatus("Public feed is sorted by newest uploads.")}
        >
          Newest ☰
        </button>
      </div>
      <p className={styles.statusLine} role="status">
        {isLoading ? "Loading public MIDI feed..." : feedMessage}
      </p>
      <div className={styles.feedList}>
        {generations.map((generation) => (
          <GenerationFeedCard
            generation={generation}
            key={generation.id}
            onStubStatus={onStubStatus}
          />
        ))}
      </div>
      <div className={styles.paginationControls}>
        <SketchButton
          disabled={page === 0 || isLoading}
          size="small"
          type="button"
          onClick={() => {
            setIsLoading(true);
            setPage((currentPage) => Math.max(0, currentPage - 1));
          }}
        >
          Previous
        </SketchButton>
        <span>Page {page + 1}</span>
        <SketchButton
          disabled={!hasNext || isLoading}
          size="small"
          type="button"
          onClick={() => {
            setIsLoading(true);
            setPage((currentPage) => currentPage + 1);
          }}
        >
          Next
        </SketchButton>
      </div>
    </section>
  );
}
