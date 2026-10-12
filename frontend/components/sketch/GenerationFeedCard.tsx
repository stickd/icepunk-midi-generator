"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, UserAvatar } from "@/components/ui";
import { SoundEngineSettings, useBrowserMidiPlayback } from "@/hooks/useBrowserMidiPlayback";
import { useGeneratedMidiPreview } from "@/hooks/useGeneratedMidiPreview";
import { getGeneratedItemDownloadUrl, getGeneratedPackDownloadUrl } from "@/lib/api";
import BrowserPianoRoll from "./BrowserPianoRoll";
import MidiThumbnailCarousel from "./MidiThumbnailCarousel";
import { FeedGeneration } from "./feedTypes";

type GenerationFeedCardProps = {
  generation: FeedGeneration;
  onStubStatus: (message: string) => void;
  playback: ReturnType<typeof useBrowserMidiPlayback>;
  soundEngine: SoundEngineSettings;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
  previewVisibilityRoot?: HTMLElement | null;
};

function formatUploadedAt(value?: string | null) {
  if (!value) return "new";

  try {
    return new Date(value).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "new";
  }
}

function formatDuration(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}s`;
}

function GenerationFeedCard({
  generation,
  onStubStatus,
  playback,
  soundEngine,
  isLoggedIn = false,
  onRequireLogin,
  previewVisibilityRoot = null,
}: GenerationFeedCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isPreviewEligible, setIsPreviewEligible] = useState(
    () => typeof window !== "undefined" && typeof IntersectionObserver === "undefined",
  );
  const items = useMemo(() => generation.items ?? [], [generation.items]);
  const selectedIndex = selectedItemId ? items.findIndex((item) => item.id === selectedItemId) : -1;
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const activeItem = items[activeIndex] ?? null;
  const hasMultipleItems = items.length > 1;
  const activePreview = useGeneratedMidiPreview(
    activeItem
      ? {
          fileName: activeItem.fileName,
          itemId: activeItem.id,
          packId: generation.id,
        }
      : null,
    Boolean(activeItem) && isPreviewEligible,
  );
  const playbackSourceId = activeItem ? `${generation.id}:${activeItem.id}` : null;
  const isThisSource = Boolean(playbackSourceId) && playback.activeSourceId === playbackSourceId;
  const isThisLoading = isThisSource && playback.isLoading;
  const isThisPlaying = isThisSource && playback.isPlaying;

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setIsPreviewEligible(true);
        observer.disconnect();
      },
      // Feed cards live in a separately scrollable column. The actual scroll
      // root plus this margin starts the selected preview before full exposure.
      { root: previewVisibilityRoot, rootMargin: "280px 0px" },
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, [previewVisibilityRoot]);

  const togglePreview = useCallback(async () => {
    if (!activeItem) return;

    if (isThisPlaying) {
      playback.stop();
      return;
    }

    if (!activePreview.preview || !playbackSourceId) {
      activePreview.retry();
      return;
    }

    playback.play(activePreview.preview.midiBuffer, soundEngine, playbackSourceId);
  }, [activeItem, activePreview, isThisPlaying, playback, playbackSourceId, soundEngine]);

  const handleMidiDownload = useCallback(() => {
    if (!isLoggedIn) {
      onRequireLogin?.();
      onStubStatus("Sign up or log in to keep creating and downloading free of charge!");
      return;
    }
    if (!activeItem) return;

    const rawName = activeItem?.fileName ?? generation.title;
    const cleanName = rawName.replace(/\.mid$/i, "").replace(/\s+/g, "_");
    const downloadFilename = `${cleanName}_by_${generation.username}.mid`;

    getGeneratedItemDownloadUrl(generation.id, activeItem.id)
      .then(({ url }) => {
        window.location.assign(url);
        onStubStatus(`Downloading ${downloadFilename}`);
      })
      .catch(() => onStubStatus("MIDI download is unavailable."));
  }, [activeItem, generation.id, generation.title, generation.username, isLoggedIn, onRequireLogin, onStubStatus]);

  const handleSelectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;

      if (item.id === activeItem?.id) {
        if (activePreview.status === "error") activePreview.retry();
        return;
      }

      if (isThisSource) {
        playback.stop();
      }
      setSelectedItemId(item.id);
    },
    [activeItem?.id, activePreview, isThisSource, items, playback],
  );

  const handleDetailsToggle = useCallback(() => {
    setShowDetails((current) => !current);
  }, []);

  return (
    <article aria-label={`Generated pack ${generation.title}`} className="feed-pack" ref={cardRef}>
      <header className="feed-pack-header">
        <div className="feed-pack-author">
          <UserAvatar sizeClassName="h-7 w-7 text-xs" username={generation.username} />
          {generation.username === "guest" ? <span>{generation.username}</span> : <Link href={`/u/${encodeURIComponent(generation.username)}`}>{generation.username}</Link>}
          <span className="feed-pack-time">{generation.timeAgo}</span>
        </div>
        <h3>{generation.title}</h3>
        <div className="feed-pack-meta"><span>{generation.midiCount} MIDI</span><span>{generation.type === "DRUMS" ? "Drums" : "Melody"}</span>{generation.bpm != null && <span>{generation.bpm} BPM</span>}</div>
      </header>
      <div className="feed-pack-score">
        <div className="feed-pack-file"><span title={activeItem?.fileName}>{activeItem?.fileName ?? generation.title}</span><span>{String(activeIndex + 1).padStart(2, "0")} / {items.length}</span></div>
        <BrowserPianoRoll
          isPlaying={isThisPlaying}
          midiData={activePreview.preview?.data}
          midiFile={null}
          midiMessage={activePreview.error ?? (isPreviewEligible ? undefined : "Preview loads when this pack becomes visible.")}
          midiStatus={activePreview.status}
          playbackPositionSeconds={isThisSource ? playback.positionSeconds : 0}
        />
        <div className="feed-pack-transport">
          <span className="feed-pack-duration">{formatDuration(activePreview.preview?.data.duration ?? activeItem?.durationSeconds)}</span>
          <div>
            <Button disabled={!activeItem || activePreview.status === "idle" || activePreview.status === "loading"} onClick={togglePreview} size="sm" type="button" variant={isThisPlaying ? "primary" : "secondary"}>
              {isThisLoading || activePreview.status === "loading" ? "Loading..." : activePreview.status === "error" ? "Retry preview" : <><span aria-hidden="true">{isThisPlaying ? "■" : "▶"}</span>{isThisPlaying ? "Stop" : "Preview"}</>}
            </Button>
            <Button aria-label={`Download ${activeItem?.fileName ?? generation.title}`} disabled={!activeItem} onClick={handleMidiDownload} size="sm" title={isLoggedIn ? "Download MIDI" : "Log in to download MIDI"} type="button" variant="ghost">Download ↓</Button>
          </div>
        </div>
      </div>
      {hasMultipleItems && isPreviewEligible ? <MidiThumbnailCarousel activeIndex={activeIndex} items={items} label="Pack MIDIs" onSelect={handleSelectItem} packId={generation.id} /> : null}
      {isThisSource && playback.message ? <p className="feed-pack-message" role="status">{playback.message}</p> : null}
      <footer className="feed-pack-footer">
        <button aria-expanded={showDetails} onClick={handleDetailsToggle} type="button">Details {showDetails ? "−" : "+"}</button>
        <span>{generation.downloads} downloads</span>
        <button onClick={() => {
          if (!isLoggedIn) { onRequireLogin?.(); onStubStatus("Sign up or log in to keep creating and downloading free of charge!"); return; }
          getGeneratedPackDownloadUrl(generation.id).then(({ url }) => window.location.assign(url)).catch(() => onStubStatus("ZIP download is unavailable."));
        }} type="button">Download ZIP ↗</button>
      </footer>
      {showDetails ? <dl className="feed-pack-details">
        <div><dt>Generated</dt><dd>{formatUploadedAt(generation.uploadedAt)}</dd></div>
        <div><dt>Visibility</dt><dd>Public</dd></div>
        <div><dt>Notes / tracks</dt><dd>{activePreview.preview?.data.notes.length ?? activeItem?.noteCount ?? "n/a"} notes · {activePreview.preview?.data.trackCount ?? activeItem?.trackCount ?? "n/a"} tracks</dd></div>
        <div><dt>Item BPM</dt><dd>{activeItem?.bpm ?? "n/a"}</dd></div>
      </dl> : null}
    </article>
  );
}

// Ignore another pack's transport clock, but always propagate actions/settings.
function sameFeedCard(previous: GenerationFeedCardProps, next: GenerationFeedCardProps) {
  if (previous.generation !== next.generation || previous.soundEngine !== next.soundEngine || previous.onStubStatus !== next.onStubStatus || previous.isLoggedIn !== next.isLoggedIn || previous.onRequireLogin !== next.onRequireLogin || previous.previewVisibilityRoot !== next.previewVisibilityRoot) return false;
  const ownsClock = next.generation.items?.some(item => next.playback.activeSourceId === `${next.generation.id}:${item.id}`);
  return (Object.keys(next.playback) as Array<keyof typeof next.playback>).every(key =>
    key === "positionSeconds" && !ownsClock || previous.playback[key] === next.playback[key],
  );
}

export default memo(GenerationFeedCard, sameFeedCard);
