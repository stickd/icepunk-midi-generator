import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import Home from "./page";
import { analyzeTempMidiFiles, generateMidiPack, getGenerationStats, getPublicUploadFeed } from "@/lib/api";

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
      downloadUrl: "https://cdn.example.com/custom.zip",
      totalGenerations: 43,
    });
  });

  it("renders the sketch workspace and modal generation flow", async () => {
    const { container } = render(<Home />);

    expect(
      await screen.findByRole("heading", {
        name: "Midis Generator",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate random" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "User Generations Feed" })).toBeInTheDocument();
    expect(screen.getByLabelText("Choose preview sound")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Upload MIDI Projects" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Help Shape IcePunk" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generate random" }));
    expect(screen.getByRole("dialog", { name: "Create pack" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next →" }));
    expect(screen.getByRole("dialog", { name: "Generated Midis" })).toBeInTheDocument();

    expect(container.querySelector("main")).toBeInTheDocument();
  });

  it("analyzes custom MIDI uploads and sends a CUSTOM_UPLOAD generation request", async () => {
    render(<Home />);

    fireEvent.click(await screen.findByLabelText(/Custom/i));
    const input = screen.getByLabelText("MIDI creation controls").querySelector("input[type='file']");
    expect(input).toBeInTheDocument();

    const midiFile = new File(["midi"], "custom.mid", { type: "audio/midi" });
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [midiFile] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze MIDIs" }));

    await waitFor(() => {
      expect(mockAnalyzeTempMidiFiles).toHaveBeenCalledWith([midiFile]);
    });
    expect(await screen.findByText(/Custom generation is ready/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generate random" }));
    fireEvent.click(screen.getByRole("button", { name: "Next →" }));
    fireEvent.click(screen.getByRole("button", { name: "Download and publish ↓" }));

    await waitFor(() => {
      expect(mockGenerateMidiPack).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 17,
          packName: "SteveMuis",
          source: "CUSTOM_UPLOAD",
          tempAnalysisId: "temp-analysis-1",
          type: "MELODY",
        }),
        null,
      );
    });
    expect(screen.getByText(/ZIP generated/i)).toBeInTheDocument();
    expect(screen.queryByText(/MIDI 1 ready/i)).not.toBeInTheDocument();
  });
});
