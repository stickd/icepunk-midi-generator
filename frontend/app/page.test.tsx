import { render, screen } from "@testing-library/react";

import Home from "./page";
import { getGenerationStats } from "@/lib/api";

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");

  return {
    ...actual,
    getGenerationStats: jest.fn(),
  };
});

const mockGetGenerationStats = getGenerationStats as jest.Mock;

describe("Home page", () => {
  beforeEach(() => {
    mockGetGenerationStats.mockReset();
    mockGetGenerationStats.mockResolvedValue({ totalGenerations: 42 });
  });

  it("renders the hero, generation controls, snowfall, and feedback section together", async () => {
    const { container } = render(<Home />);

    expect(
      await screen.findByRole("heading", { name: "Generate icy MIDI packs" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate MIDI Pack" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Help Shape IcePunk" })).toBeInTheDocument();

    expect(container.querySelector('div[aria-hidden="true"]')).toBeInTheDocument();
  });
});
