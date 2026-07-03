import type { GeneratedMidiItem, GenerationType } from "@/lib/api";

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
