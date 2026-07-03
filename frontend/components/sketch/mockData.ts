export type MockGeneration = {
  id: string;
  username: string;
  timeAgo: string;
  title: string;
  midiCount: number;
  downloads: number;
  sound: string;
  midiUrl?: string;
  sampleUrl?: string | null;
  uploadedAt?: string;
};

export type MockGeneratedMidi = {
  id: string;
  label: string;
  bpm: number;
  pitch: number;
  octaves: number;
};

export const mockGenerations: MockGeneration[] = [
  {
    id: "aurora-loop",
    username: "user1",
    timeAgo: "4 min",
    title: "Frozen arp pack",
    midiCount: 9,
    downloads: 44,
    sound: "PAD",
  },
  {
    id: "night-grid",
    username: "gosha",
    timeAgo: "7 min",
    title: "Neon lead run",
    midiCount: 9,
    downloads: 31,
    sound: "PLUCK",
  },
];

export const mockGeneratedMidis: MockGeneratedMidi[] = [
  { id: "mid-1", label: "4/17", bpm: 140, pitch: 0, octaves: 1 },
  { id: "mid-2", label: "5/17", bpm: 138, pitch: -2, octaves: 1 },
  { id: "mid-3", label: "6/17", bpm: 146, pitch: 3, octaves: 2 },
];
