import { render, screen } from "@testing-library/react";
import GeneratedPackVisualizer from "./GeneratedPackVisualizer";
import { useGeneratedMidiPreview } from "@/hooks/useGeneratedMidiPreview";

jest.mock("@/hooks/useGeneratedMidiPreview", () => ({
  useGeneratedMidiPreview: jest.fn(),
}));

jest.mock("./BrowserPianoRoll", () => ({
  __esModule: true,
  default: ({ midiData, midiStatus }: { midiData?: { notes: unknown[]; trackCount: number; duration: number } | null; midiStatus?: string }) => (
    <div data-testid="browser-piano-roll">{midiStatus}:{midiData?.notes.length ?? 0}</div>
  ),
}));

jest.mock("./MidiThumbnailCarousel", () => ({
  __esModule: true,
  default: () => <div data-testid="midi-carousel" />,
}));

const useGeneratedMidiPreviewMock = useGeneratedMidiPreview as jest.MockedFunction<
  typeof useGeneratedMidiPreview
>;

const playback = {
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

describe("GeneratedPackVisualizer", () => {
  beforeEach(() => {
    useGeneratedMidiPreviewMock.mockReturnValue({
      error: null,
      preview: {
        data: {
          duration: 3.2,
          fileName: "generated_1.mid",
          maxMidi: 76,
          minMidi: 44,
          notes: [
            { duration: 0.5, midi: 60, name: "C4", time: 0, velocity: 0.8 },
            { duration: 0.5, midi: 64, name: "E4", time: 0.5, velocity: 0.8 },
          ],
          trackCount: 2,
        },
        fileName: "generated_1.mid",
        midiBuffer: new ArrayBuffer(16),
      },
      retry: jest.fn(),
      status: "ready",
    });
  });

  it("selects the first generated MIDI and gives its parsed preview to the piano roll", () => {
    render(
      <GeneratedPackVisualizer
        generation={{
          amount: 2,
          bpm: 146,
          createdAt: "2026-08-16T10:00:00Z",
          items: [
            {
              avgPitch: 60,
              bpm: 146,
              durationSeconds: null,
              fileName: "generated_1.mid",
              id: "item-1",
              index: 0,
              maxPitch: null,
              minPitch: null,
              noteCount: null,
              preview: { notes: [], truncated: false },
              trackCount: null,
            },
            {
              avgPitch: 61,
              bpm: 146,
              durationSeconds: 2,
              fileName: "generated_2.mid",
              id: "item-2",
              index: 1,
              maxPitch: 74,
              minPitch: 45,
              noteCount: 4,
              preview: { notes: [], truncated: false },
              trackCount: 1,
            },
          ],
          name: "Generated pack",
          octaves: 1,
          packId: "pack-1",
          pitch: 0,
          source: "FACTORY",
          totalGenerations: 1,
          type: "MELODY",
        }}
        onNewGeneration={jest.fn()}
        onStubStatus={jest.fn()}
        playback={playback}
        soundEngine={{ preset: "Soft Piano", sampleFile: null, volume: 0.8 }}
        token={null}
      />,
    );

    expect(useGeneratedMidiPreviewMock).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: "item-1", packId: "pack-1" }),
      true,
    );
    expect(screen.getByTestId("browser-piano-roll")).toHaveTextContent("ready:2");
    expect(screen.getByText((_, element) => element?.textContent === "2 notes")).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === "2 tracks")).toBeInTheDocument();
    expect(screen.getByText("3.2s")).toBeInTheDocument();
    expect(screen.queryByText("Choose a MIDI file to render a real piano roll.")).not.toBeInTheDocument();
  });
});
