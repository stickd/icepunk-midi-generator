import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import UserGenerationsFeed from "./UserGenerationsFeed";
import { getPublicGeneratedPackFeed } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  getPublicGeneratedPackFeed: jest.fn(),
}));

jest.mock("./BrowserPianoRoll", () => ({
  __esModule: true,
  default: ({ midiUrl }: { midiUrl?: string | null }) => (
    <div data-testid="mock-piano-roll">{midiUrl}</div>
  ),
}));

const getPublicGeneratedPackFeedMock = getPublicGeneratedPackFeed as jest.MockedFunction<
  typeof getPublicGeneratedPackFeed
>;

function feedResponse(items: Awaited<ReturnType<typeof getPublicGeneratedPackFeed>>["items"]) {
  return {
    hasNext: false,
    items,
    page: 0,
    size: 5,
    totalItems: items.length,
    totalPages: items.length > 0 ? 1 : 0,
  };
}

describe("UserGenerationsFeed", () => {
  beforeEach(() => {
    getPublicGeneratedPackFeedMock.mockReset();
  });

  it("renders real public generated pack cards from the backend feed", async () => {
    getPublicGeneratedPackFeedMock.mockResolvedValue(
      feedResponse([
        {
          amount: 5,
          bpm: 140,
          createdAt: "2026-07-03T10:00:00Z",
          items: [
            {
              avgPitch: 60,
              bpm: 140,
              downloadUrl: "http://localhost:8081/download/item1",
              durationSeconds: 2,
              fileName: "lead.mid",
              id: "item1",
              index: 0,
              maxPitch: 72,
              minPitch: 48,
              noteCount: 16,
              preview: { notes: [], truncated: false },
              trackCount: 1,
            },
          ],
          name: "Frozen Lead Pack",
          octaves: 2,
          ownerId: 7,
          ownerUsername: "nikul",
          packDownloadUrl: "http://localhost:8081/download/pack1",
          packId: "pack1",
          pitch: 0,
          source: "FACTORY",
          type: "MELODY",
          visibility: "PUBLIC",
        },
      ]),
    );

    render(
      <UserGenerationsFeed
        onStubStatus={jest.fn()}
        soundEngine={{ preset: "Soft Piano", sampleFile: null, volume: 0.8 }}
      />,
    );

    expect(await screen.findByText("Frozen Lead Pack")).toBeInTheDocument();
    expect(screen.getByText("nikul")).toBeInTheDocument();
    expect(screen.getByText("Generated melody")).toBeInTheDocument();
  });

  it("shows an honest empty state when there are no generated packs", async () => {
    getPublicGeneratedPackFeedMock.mockResolvedValue(feedResponse([]));

    render(
      <UserGenerationsFeed
        onStubStatus={jest.fn()}
        soundEngine={{ preset: "Soft Piano", sampleFile: null, volume: 0.8 }}
      />,
    );

    expect(await screen.findByText("No public generated MIDI packs yet.")).toBeInTheDocument();
  });

  it("shows an error state and allows retrying the feed request", async () => {
    getPublicGeneratedPackFeedMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(feedResponse([]));

    render(
      <UserGenerationsFeed
        onStubStatus={jest.fn()}
        soundEngine={{ preset: "Soft Piano", sampleFile: null, volume: 0.8 }}
      />,
    );

    expect(await screen.findByText("Feed could not load.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(getPublicGeneratedPackFeedMock).toHaveBeenCalledTimes(2);
    });
  });
});
