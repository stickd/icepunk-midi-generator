import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import GenerationFeedCard from "./GenerationFeedCard";
import { FeedGeneration } from "./feedTypes";
import { useGeneratedMidiPreview } from "@/hooks/useGeneratedMidiPreview";

jest.mock("@/hooks/useGeneratedMidiPreview", () => ({
  useGeneratedMidiPreview: jest.fn(),
}));

jest.mock("./BrowserPianoRoll", () => ({
  __esModule: true,
  default: ({ midiData, midiMessage, midiStatus }: { midiData?: { fileName: string; notes: unknown[]; trackCount: number; duration: number } | null; midiMessage?: string; midiStatus?: string }) => (
    <div data-testid="feed-piano-roll">{midiStatus}:{midiData?.fileName ?? midiMessage ?? "empty"}</div>
  ),
}));

jest.mock("./MidiThumbnailCarousel", () => ({
  __esModule: true,
  default: ({ onSelect }: { onSelect: (index: number) => void }) => (
    <button onClick={() => onSelect(1)} type="button">Select second feed MIDI</button>
  ),
}));

const useGeneratedMidiPreviewMock = useGeneratedMidiPreview as jest.MockedFunction<
  typeof useGeneratedMidiPreview
>;

const firstPreview = {
  data: {
    duration: 2.9,
    fileName: "feed-first.mid",
    maxMidi: 72,
    minMidi: 48,
    notes: [
      { duration: 0.5, midi: 60, name: "C4", time: 0, velocity: 0.8 },
      { duration: 0.5, midi: 64, name: "E4", time: 0.5, velocity: 0.8 },
    ],
    trackCount: 1,
  },
  fileName: "feed-first.mid",
  midiBuffer: new ArrayBuffer(16),
};

const secondPreview = {
  data: {
    duration: 4.2,
    fileName: "feed-second.mid",
    maxMidi: 80,
    minMidi: 40,
    notes: [{ duration: 1, midi: 67, name: "G4", time: 0, velocity: 0.7 }],
    trackCount: 2,
  },
  fileName: "feed-second.mid",
  midiBuffer: new ArrayBuffer(24),
};

function feedItem(id: string, fileName: string) {
  return {
    avgPitch: null,
    bpm: 140,
    durationSeconds: null,
    fileName,
    id,
    index: id === "feed-item-1" ? 0 : 1,
    maxPitch: null,
    minPitch: null,
    noteCount: null,
    preview: { notes: [], truncated: false },
    trackCount: null,
  };
}

function generation(id = "public-pack"): FeedGeneration {
  return {
    bpm: 140,
    downloads: 0,
    id,
    items: [feedItem("feed-item-1", "feed-first.mid"), feedItem("feed-item-2", "feed-second.mid")],
    midiCount: 2,
    sound: "Generated melody",
    timeAgo: "now",
    title: "Public feed pack",
    type: "MELODY",
    username: "public-user",
  };
}

function createPlayback() {
  return {
    activeSourceId: null,
    isLoading: false,
    isPaused: false,
    isPlaying: false,
    message: "",
    pause: jest.fn(),
    play: jest.fn(),
    positionSeconds: 0,
    status: "idle" as const,
    stop: jest.fn(),
    updateSettings: jest.fn(),
  };
}

describe("GenerationFeedCard", () => {
  const observers: Array<{ callback: IntersectionObserverCallback; disconnect: jest.Mock }> = [];

  beforeEach(() => {
    observers.splice(0, observers.length);
    useGeneratedMidiPreviewMock.mockReset();
    useGeneratedMidiPreviewMock.mockImplementation((input) => ({
      error: null,
      preview: input?.itemId === "feed-item-2" ? secondPreview : firstPreview,
      retry: jest.fn(),
      status: "ready",
    }));
    global.IntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
      const observer = { callback, disconnect: jest.fn(), observe: jest.fn(), unobserve: jest.fn() };
      observers.push(observer);
      return observer;
    }) as unknown as typeof IntersectionObserver;
  });

  function renderCard(feedGeneration = generation(), playback = createPlayback()) {
    const settings = { preset: "Soft Piano" as const, sampleFile: null, volume: 0.8 };
    const view = render(
      <GenerationFeedCard
        generation={feedGeneration}
        onStubStatus={jest.fn()}
        playback={playback}
        soundEngine={settings}
      />,
    );

    return { playback, settings, ...view };
  }

  function revealCards() {
    act(() => {
      observers.forEach(({ callback }) => callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ));
    });
  }

  it("selects the first feed MIDI, loads parsed data, and plays its cached buffer", async () => {
    const { playback, settings } = renderCard();

    expect(useGeneratedMidiPreviewMock).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: "feed-item-1", packId: "public-pack" }),
      false,
    );
    revealCards();

    await waitFor(() => expect(useGeneratedMidiPreviewMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ itemId: "feed-item-1", packId: "public-pack" }),
      true,
    ));
    expect(screen.getByTestId("feed-piano-roll")).toHaveTextContent("ready:feed-first.mid");
    expect(screen.getByText((_, element) => element?.textContent === "2 notes")).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === "1 tracks")).toBeInTheDocument();
    expect(screen.getByText("2.9s")).toBeInTheDocument();

    const preview = screen.getByRole("button", { name: "Preview" });
    expect(preview).toBeEnabled();
    fireEvent.click(preview);
    expect(playback.play).toHaveBeenCalledWith(firstPreview.midiBuffer, settings, "public-pack:feed-item-1");
  });

  it("updates the big preview on thumbnail click without resetting the user selection on refresh", async () => {
    const { rerender } = renderCard();
    revealCards();

    fireEvent.click(screen.getByRole("button", { name: "Select second feed MIDI" }));
    await waitFor(() => expect(useGeneratedMidiPreviewMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ itemId: "feed-item-2", packId: "public-pack" }),
      true,
    ));
    expect(screen.getByTestId("feed-piano-roll")).toHaveTextContent("ready:feed-second.mid");
    expect(screen.getByText((_, element) => element?.textContent === "1 notes")).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === "2 tracks")).toBeInTheDocument();
    expect(screen.getByText("4.2s")).toBeInTheDocument();

    rerender(
      <GenerationFeedCard
        generation={{ ...generation(), items: generation().items?.map((item) => ({ ...item })) }}
        onStubStatus={jest.fn()}
        playback={createPlayback()}
        soundEngine={{ preset: "Soft Piano", sampleFile: null, volume: 0.8 }}
      />,
    );

    expect(screen.getByTestId("feed-piano-roll")).toHaveTextContent("ready:feed-second.mid");
  });

  it("keeps a selected-preview error local to its feed pack", async () => {
    useGeneratedMidiPreviewMock.mockImplementation((input) => ({
      error: input?.packId === "broken-pack" ? "Could not load this MIDI preview." : null,
      preview: input?.packId === "broken-pack" ? null : firstPreview,
      retry: jest.fn(),
      status: input?.packId === "broken-pack" ? "error" : "ready",
    }));

    renderCard(generation("broken-pack"));
    renderCard(generation("healthy-pack"));
    revealCards();

    expect(screen.getAllByTestId("feed-piano-roll")[0]).toHaveTextContent("error:Could not load this MIDI preview.");
    expect(screen.getAllByTestId("feed-piano-roll")[1]).toHaveTextContent("ready:feed-first.mid");
  });
});
