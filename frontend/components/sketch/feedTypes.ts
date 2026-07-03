export type FeedGeneration = {
  id: string;
  username: string;
  timeAgo: string;
  title: string;
  midiCount: number;
  downloads: number;
  sound: string;
  midiUrl?: string;
  midiPreviewUrl?: string;
  sampleUrl?: string | null;
  uploadedAt?: string;
};
