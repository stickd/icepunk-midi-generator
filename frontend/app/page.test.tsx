import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import Home from "./page";
import {
  analyzeTempMidiFiles,
  generateMidiPack,
  getGenerationStats,
  getPublicUploadFeed,
} from "@/lib/api";

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");

  return {
    ...actual,
    analyzeTempMidiFiles: jest.fn(),
    generateMidiPack: jest.fn(),
    getGenerationStats: jest.fn(),
    getPublicUploadFeed: jest.fn(),
  };
});

jest.mock("@/hooks/useBrowserMidiPlayback", () => ({
  useBrowserMidiPlayback: jest.fn(() => ({
    activeSourceId: null,
    isLoading: false,
    isPaused: false,
    isPlaying: false,
    message: "",
    pause: jest.fn(),
    play: jest.fn(),
    positionSeconds: 0,
    status: "idle",
    stop: jest.fn(),
    updateSettings: jest.fn(),
  })),
}));

const mockAnalyzeTempMidiFiles = analyzeTempMidiFiles as jest.Mock;
const mockGenerateMidiPack = generateMidiPack as jest.Mock;
const mockGetGenerationStats = getGenerationStats as jest.Mock;
const mockGetPublicUploadFeed = getPublicUploadFeed as jest.Mock;

describe("Home page", () => {
  beforeEach(() => {
    mockGetGenerationStats.mockReset();
    mockGetGenerationStats.mockResolvedValue({ totalGenerations: 42 });
    mockGetPublicUploadFeed.mockReset();
    mockGetPublicUploadFeed.mockResolvedValue({
      hasNext: false,
      items: [],
      page: 0,
      size: 5,
      totalItems: 0,
      totalPages: 0,
    });
    mockAnalyzeTempMidiFiles.mockReset();
    mockAnalyzeTempMidiFiles.mockResolvedValue({
      fileCount: 1,
      metadata: {},
      tempAnalysisId: "temp-analysis-1",
    });
    mockGenerateMidiPack.mockReset();
    mockGenerateMidiPack.mockResolvedValue({
      amount: 17,
      bpm: 146,
      createdAt: "2026-07-03T12:00:00Z",
      downloadUrl: "/generated-packs/pack-1/download",
      items: [
        {
          avgPitch: 61,
          bpm: 146,
          downloadUrl: "/generated-packs/pack-1/items/item-1/download",
          durationSeconds: 4.5,
          fileName: "icepunk_001.mid",
          id: "item-1",
          index: 0,
          maxPitch: 72,
          minPitch: 48,
          noteCount: 12,
          preview: {
            notes: [
              { duration: 0.5, pitch: 60, start: 0, velocity: 96 },
              { duration: 0.75, pitch: 64, start: 0.5, velocity: 88 },
            ],
            truncated: false,
          },
          trackCount: 1,
        },
      ],
      name: "SteveMuis",
      octaves: 1,
      packDownloadUrl: "/generated-packs/pack-1/download",
      packId: "pack-1",
      pitch: 0,
      source: "CUSTOM_UPLOAD",
      totalGenerations: 43,
      type: "MELODY",
    });
  });

  it("renders the sketch workspace and inline generation flow", async () => {
    const { container } = render(<Home />);

    expect(
      await screen.findByRole("heading", {
        name: "Generator",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Feed" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Factory" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Custom" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    const createDialog = await screen.findByRole("dialog", { name: "Create pack" });
    expect(createDialog).toBeInTheDocument();

    fireEvent.click(within(createDialog).getByRole("button", { name: /Next/i }));

    await waitFor(() => {
      expect(mockGenerateMidiPack).toHaveBeenCalled();
    });
    expect(await screen.findByRole("button", { name: "New generation" })).toBeInTheDocument();

    expect(container.querySelector("main")).toBeInTheDocument();
  });

  it("analyzes custom MIDI uploads and renders real generated pack items", async () => {
    render(<Home />);

    fireEvent.click(await screen.findByRole("tab", { name: "Custom" }));
    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose a MIDI file to render a real piano roll/i)).not.toBeInTheDocument();

    const generateButton = screen.getByRole("button", { name: "Generate" });
    expect(generateButton).toBeDisabled();

    const input = (await screen.findByText("Upload your MIDIs")).closest("label")?.querySelector("input[type='file']");
    expect(input).toBeInTheDocument();

    const analyzeButton = screen.getByRole("button", { name: "Analyze" });
    expect(analyzeButton).toBeDisabled();

    const midiFile = new File(["midi"], "custom.mid", { type: "audio/midi" });
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [midiFile] },
    });
    expect(screen.getByRole("button", { name: "Analyze" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await waitFor(() => {
      expect(mockAnalyzeTempMidiFiles).toHaveBeenCalledWith([midiFile]);
    });
    expect(await screen.findByText(/Custom generation is ready/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Create pack" })).getByRole("button", { name: /Next/i }));

    await waitFor(() => {
      expect(mockGenerateMidiPack).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 17,
          packName: expect.any(String),
          source: "CUSTOM_UPLOAD",
          tempAnalysisId: "temp-analysis-1",
          type: "MELODY",
        }),
        null,
      );
    });
    expect(await screen.findByText("icepunk_001.mid")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download whole pack (ZIP)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
  });

  it("rejects invalid custom MIDI selections before analysis", async () => {
    render(<Home />);

    fireEvent.click(await screen.findByRole("tab", { name: "Custom" }));
    const input = (await screen.findByText("Upload your MIDIs")).closest("label")?.querySelector("input[type='file']");

    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(["text"], "notes.txt", { type: "text/plain" })] },
    });

    expect(await screen.findByText("Only .mid and .midi files are supported.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(mockAnalyzeTempMidiFiles).not.toHaveBeenCalled();
  });

  it("rejects more than 100 custom MIDI files before analysis", async () => {
    render(<Home />);

    fireEvent.click(await screen.findByRole("tab", { name: "Custom" }));
    const input = (await screen.findByText("Upload your MIDIs")).closest("label")?.querySelector("input[type='file']");
    const files = Array.from(
      { length: 101 },
      (_, index) => new File(["midi"], `custom-${index}.mid`, { type: "audio/midi" }),
    );

    fireEvent.change(input as HTMLInputElement, {
      target: { files },
    });

    expect(await screen.findByText("Upload no more than 100 MIDI files.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    expect(mockAnalyzeTempMidiFiles).not.toHaveBeenCalled();
  });
});
