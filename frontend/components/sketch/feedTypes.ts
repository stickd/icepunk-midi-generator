import type { GeneratedMidiItem, GenerationType, PublicGeneratedPackFeedItem } from "@/lib/api";

export type FeedGeneration = {
  id: string;
  username: string;
  timeAgo: string;
  title: string;
  midiCount: number;
  downloads: number;
  sound: string;
  type?: GenerationType;
  bpm?: number | null;
  packDownloadUrl?: string;
  items?: GeneratedMidiItem[];
  midiUrl?: string;
  midiPreviewUrl?: string;
  sampleUrl?: string | null;
  uploadedAt?: string;
};

export function formatRelativeTime(uploadedAt: string) {
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

export function toFeedGeneration(item: PublicGeneratedPackFeedItem): FeedGeneration {
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
