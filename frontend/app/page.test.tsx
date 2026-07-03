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

  it("renders the workspace shell, generation controls, upload, and feedback sections together", async () => {
    const { container } = render(<Home />);

    expect(
      await screen.findByRole("heading", {
        name: "Generate MIDI packs with studio-grade control",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate MIDI Pack" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Upload MIDI Projects" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Help Shape IcePunk" })).toBeInTheDocument();

    expect(container.querySelector("#generate")).toBeInTheDocument();
    expect(container.querySelector("#upload")).toBeInTheDocument();
    expect(container.querySelector("#feedback")).toBeInTheDocument();
  });
});
