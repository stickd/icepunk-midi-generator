import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import UserGenerationsFeed from "./UserGenerationsFeed";
import { getPublicUploadFeed } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  getPublicUploadFeed: jest.fn(),
  getPublicUploadMidiPreviewUrl: (id: number) => `http://localhost:8081/uploads/projects/${id}/midi`,
}));

jest.mock("./BrowserPianoRoll", () => ({
  __esModule: true,
  default: ({ midiUrl }: { midiUrl?: string | null }) => (
    <div data-testid="mock-piano-roll">{midiUrl}</div>
  ),
}));

const getPublicUploadFeedMock = getPublicUploadFeed as jest.MockedFunction<
  typeof getPublicUploadFeed
>;

function feedResponse(items: Awaited<ReturnType<typeof getPublicUploadFeed>>["items"]) {
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
    getPublicUploadFeedMock.mockReset();
  });

  it("renders real public upload cards from the backend feed", async () => {
    getPublicUploadFeedMock.mockResolvedValue(
      feedResponse([
        {
          id: 11,
          metadata: { sampleOriginalFilename: "ice.wav" },
          midiUrl: "http://localhost:9010/icepunk-zips/user_uploads/11/lead.mid",
          ownerId: 7,
          ownerUsername: "nikul",
          sampleUrl: "http://localhost:9010/icepunk-zips/user_uploads/11/ice.wav",
          title: "Frozen Lead",
          uploadedAt: "2026-07-03T10:00:00Z",
          visibility: "PUBLIC",
        },
      ]),
    );

    render(<UserGenerationsFeed onStubStatus={jest.fn()} />);

    expect(await screen.findByText("Frozen Lead")).toBeInTheDocument();
    expect(screen.getByText("nikul")).toBeInTheDocument();
    expect(screen.getByText("Preview sound: ice.wav")).toBeInTheDocument();
    expect(screen.getByTestId("mock-piano-roll")).toHaveTextContent(
      "http://localhost:8081/uploads/projects/11/midi",
    );
    expect(screen.queryByText("Frozen arp pack")).not.toBeInTheDocument();
  });

  it("shows an honest empty state instead of demo cards", async () => {
    getPublicUploadFeedMock.mockResolvedValue(feedResponse([]));

    render(<UserGenerationsFeed onStubStatus={jest.fn()} />);

    expect(await screen.findByText("No public MIDI uploads yet.")).toBeInTheDocument();
    expect(screen.queryByText("Frozen arp pack")).not.toBeInTheDocument();
  });

  it("shows an error state and allows retrying the feed request", async () => {
    getPublicUploadFeedMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(feedResponse([]));

    render(<UserGenerationsFeed onStubStatus={jest.fn()} />);

    expect(await screen.findByText("Feed could not load.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(getPublicUploadFeedMock).toHaveBeenCalledTimes(2);
    });
  });
});
