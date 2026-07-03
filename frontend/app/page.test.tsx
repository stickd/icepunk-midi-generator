import { fireEvent, render, screen } from "@testing-library/react";

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

    fireEvent.click(screen.getByRole("button", { name: "Generate random" }));
    expect(screen.getByRole("dialog", { name: "Create pack" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next →" }));
    expect(screen.getByRole("dialog", { name: "Generated Midis" })).toBeInTheDocument();

    expect(container.querySelector("main")).toBeInTheDocument();
  });
});
