"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getPublicUploadFeed,
  getPublicUploadMidiPreviewUrl,
  PublicUploadFeedItem,
} from "@/lib/api";
import { FEED_REFRESH_EVENT } from "@/lib/events";
import GenerationFeedCard from "./GenerationFeedCard";
import SketchButton from "./SketchButton";
import { FeedGeneration } from "./feedTypes";
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

function toGeneration(item: PublicUploadFeedItem): FeedGeneration {
  return {
    downloads: 0,
    id: String(item.id),
    midiCount: 1,
    midiPreviewUrl: getPublicUploadMidiPreviewUrl(item.id),
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
  const [hasError, setHasError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    getPublicUploadFeed(page, FEED_PAGE_SIZE, controller.signal)
      .then((feed) => {
        setFeedItems(feed.items);
        setHasNext(feed.hasNext);
        setFeedMessage(
          feed.totalItems > 0
            ? `${feed.totalItems.toLocaleString()} public uploads discovered.`
            : "No public uploads yet. Upload a public MIDI project to start the feed.",
        );
      })
      .catch(() => {
        setFeedItems([]);
        setHasNext(false);
        setHasError(true);
        setFeedMessage("Public feed is unavailable. Try again in a moment.");
      })
      .finally(() => setIsLoading(false));

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

  const generations = useMemo(
    () => feedItems.map(toGeneration),
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
          onClick={() => {
            setIsLoading(true);
            setHasError(false);
            setPage(0);
            setRefreshKey((currentKey) => currentKey + 1);
            onStubStatus("Public feed refreshed and sorted by newest uploads.");
          }}
        >
          Refresh ☰
        </button>
      </div>
      <p className={styles.statusLine} role="status">
        {isLoading ? "Loading public MIDI feed..." : feedMessage}
      </p>
      {hasError ? (
        <div className={styles.feedStatePanel}>
          <strong>Feed could not load.</strong>
          <span>Check backend/API availability, then refresh.</span>
          <SketchButton
            size="small"
            type="button"
            onClick={() => {
              setIsLoading(true);
              setHasError(false);
              setRefreshKey((currentKey) => currentKey + 1);
            }}
          >
            Retry
          </SketchButton>
        </div>
      ) : null}
      {!hasError && !isLoading && generations.length === 0 ? (
        <div className={styles.feedStatePanel}>
          <strong>No public MIDI uploads yet.</strong>
          <span>Upload a project with PUBLIC visibility and it will appear here.</span>
        </div>
      ) : null}
      {generations.length > 0 ? (
        <div className={styles.feedList}>
          {generations.map((generation) => (
            <GenerationFeedCard
              generation={generation}
              key={generation.id}
              onStubStatus={onStubStatus}
            />
          ))}
        </div>
      ) : null}
      <div className={styles.paginationControls}>
        <SketchButton
          disabled={page === 0 || isLoading}
          size="small"
          type="button"
          onClick={() => {
            setIsLoading(true);
            setHasError(false);
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
            setHasError(false);
            setPage((currentPage) => currentPage + 1);
          }}
        >
          Next
        </SketchButton>
      </div>
    </section>
  );
}
