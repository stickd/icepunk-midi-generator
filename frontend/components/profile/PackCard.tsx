"use client";

import { useState } from "react";
import {
  getPublicUploadMidiPreviewUrl,
  setProjectLiked,
  UserPackItem,
} from "@/lib/api";
import { Badge, Card } from "@/components/ui";
import BrowserPianoRoll from "@/components/sketch/BrowserPianoRoll";

type PackCardProps = {
  pack: UserPackItem;
  token: string | null;
  onAuthRequired: () => void;
};

function formatCount(value: number) {
  if (value >= 1000) {
    const compact = value / 1000;
    return `${compact >= 10 ? Math.round(compact) : compact.toFixed(1)}k`;
  }

  return String(value);
}

function formatUploadedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PackCard({ pack, token, onAuthRequired }: PackCardProps) {
  const [liked, setLiked] = useState(pack.likedByViewer);
  const [likeCount, setLikeCount] = useState(pack.likeCount);
  const [likePending, setLikePending] = useState(false);
  const [downloads, setDownloads] = useState(pack.downloadCount);

  async function toggleLike() {
    if (!token) {
      onAuthRequired();
      return;
    }
    if (likePending) return;

    const nextLiked = !liked;
    setLikePending(true);
    setLiked(nextLiked);
    setLikeCount((count) => Math.max(0, count + (nextLiked ? 1 : -1)));

    try {
      const response = await setProjectLiked(pack.id, nextLiked, token);
      setLiked(response.liked);
      setLikeCount(response.likeCount);
    } catch {
      setLiked(!nextLiked);
      setLikeCount((count) => Math.max(0, count + (nextLiked ? -1 : 1)));
    } finally {
      setLikePending(false);
    }
  }

  return (
    <Card className="group overflow-hidden">
      <div className="border-b border-white/[0.06] transition-[filter] duration-200 ease-out group-hover:brightness-125">
        <BrowserPianoRoll
          isPlaying={false}
          midiFile={null}
          midiUrl={pack.midiUrl}
          playbackPositionSeconds={0}
          size="compact"
        />
      </div>

      <div className="grid gap-3 p-4">
        <h3 className="truncate text-sm font-medium text-ice-primary">{pack.title}</h3>

        <div className="flex flex-wrap gap-1.5">
          <Badge>{formatUploadedAt(pack.uploadedAt)}</Badge>
          {typeof pack.metadata.midiOriginalFilename === "string" ? (
            <Badge className="max-w-40 truncate normal-case tracking-normal">
              {pack.metadata.midiOriginalFilename}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-ice-muted">
            <span>
              <span className="font-medium text-ice-secondary">{formatCount(downloads)}</span> dl
            </span>
            <button
              aria-label={liked ? `Unlike ${pack.title}` : `Like ${pack.title}`}
              aria-pressed={liked}
              className={`inline-flex items-center gap-1 rounded-full outline-none transition-[color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-[rgba(100,120,255,0.45)] active:scale-[0.94] ${
                liked ? "text-[color:var(--ice-accent-text)]" : "hover:text-ice-secondary"
              }`}
              disabled={likePending}
              onClick={toggleLike}
              type="button"
            >
              <span className="font-medium">{formatCount(likeCount)}</span>
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5"
                fill={liked ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={liked ? 0 : 1.5}
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 21c-4.8-3.6-8-6.6-8-10a4.6 4.6 0 0 1 8-3.1A4.6 4.6 0 0 1 20 11c0 3.4-3.2 6.4-8 10z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <a
            aria-label={`Download ${pack.title}`}
            className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/[0.09] bg-white/[0.04] text-white/[0.55] outline-none transition-[background-color,color,transform] duration-150 ease-out after:pointer-events-none after:absolute after:inset-x-[10%] after:top-0 after:h-[40%] after:rounded-full after:bg-gradient-to-b after:from-white/[0.09] after:to-transparent hover:bg-white/[0.08] hover:text-white/[0.85] focus-visible:ring-2 focus-visible:ring-[rgba(100,120,255,0.45)] active:scale-[0.94]"
            download
            href={getPublicUploadMidiPreviewUrl(pack.id)}
            onClick={() => setDownloads((count) => count + 1)}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      </div>
    </Card>
  );
}
