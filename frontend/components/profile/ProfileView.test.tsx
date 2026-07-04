import { render, screen, waitFor } from "@testing-library/react";
import ProfileView from "./ProfileView";
import {
  getFavorites,
  getMe,
  getUserGeneratedPacksFeed,
  getUserPacks,
  getUserProfile,
} from "@/lib/api";

jest.mock("@/lib/api", () => ({
  getFavorites: jest.fn(),
  getMe: jest.fn(),
  getUserGeneratedPacksFeed: jest.fn(),
  getUserPacks: jest.fn(),
  getUserProfile: jest.fn(),
  TOKEN_KEY: "icepunk-token",
}));

jest.mock("@/components/sketch/GenerationFeedCard", () => ({
  __esModule: true,
  default: ({ generation }: { generation: { title: string; username: string } }) => (
    <div data-testid="mock-generation-card">
      <span>{generation.title}</span>
      <span>{generation.username}</span>
    </div>
  ),
}));

const getUserProfileMock = getUserProfile as jest.MockedFunction<typeof getUserProfile>;
const getUserPacksMock = getUserPacks as jest.MockedFunction<typeof getUserPacks>;
const getUserGeneratedPacksFeedMock = getUserGeneratedPacksFeed as jest.MockedFunction<
  typeof getUserGeneratedPacksFeed
>;
const getMeMock = getMe as jest.MockedFunction<typeof getMe>;
const getFavoritesMock = getFavorites as jest.MockedFunction<typeof getFavorites>;

describe("ProfileView", () => {
  beforeEach(() => {
    jest.resetAllMocks();

    getUserProfileMock.mockResolvedValue({
      createdAt: "2026-01-01T00:00:00Z",
      id: 1,
      joinedAt: "2026-01-01T00:00:00Z",
      packCount: 2,
      totalDownloads: 15,
      totalLikes: 5,
      username: "testuser",
    });

    getUserPacksMock.mockResolvedValue({
      hasNext: false,
      items: [],
      page: 0,
      size: 12,
      totalItems: 0,
      totalPages: 0,
    });

    getUserGeneratedPacksFeedMock.mockResolvedValue({
      hasNext: false,
      items: [],
      page: 0,
      size: 6,
      totalItems: 0,
      totalPages: 0,
    });
  });

  it("renders user profile and defaults to Generated tab", async () => {
    getUserGeneratedPacksFeedMock.mockResolvedValue({
      hasNext: false,
      items: [
        {
          bpm: 140,
          createdAt: "2026-07-04T00:00:00Z",
          items: [
            {
              id: "item-1",
              filename: "lead.mid",
              previewUrl: "http://localhost:8081/preview/1",
              downloadUrl: "http://localhost:8081/download/1",
            },
          ],
          name: "Cold Melodies Pack",
          ownerUsername: "testuser",
          packDownloadUrl: "http://localhost:8081/pack/1",
          packId: "pack-1",
          type: "MELODY",
        },
      ],
      page: 0,
      size: 6,
      totalItems: 1,
      totalPages: 1,
    });

    render(<ProfileView username="testuser" />);

    expect(await screen.findByRole("heading", { name: "testuser" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Generated/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByText("Cold Melodies Pack")).toBeInTheDocument();
    expect(getUserGeneratedPacksFeedMock).toHaveBeenCalledWith("testuser", 0, 6, expect.any(AbortSignal));
  });

  it("renders empty state when user has no generated packs", async () => {
    getUserGeneratedPacksFeedMock.mockResolvedValue({
      hasNext: false,
      items: [],
      page: 0,
      size: 6,
      totalItems: 0,
      totalPages: 0,
    });

    render(<ProfileView username="testuser" />);

    expect(await screen.findByText("No generated packs yet")).toBeInTheDocument();
  });
});
