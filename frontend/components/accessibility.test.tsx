import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

import HomeControls from "./HomeControls";
import { getGenerationStats } from "@/lib/api";

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");

  return {
    ...actual,
    authUser: jest.fn(),
    getGenerationStats: jest.fn(),
    generateMidiPack: jest.fn(),
  };
});

const mockGetGenerationStats = getGenerationStats as jest.Mock;

// jsdom cannot compute real rendered colors, so "color-contrast" produces
// unreliable results here; contrast is covered instead by the axe scan in
// the Playwright e2e suite (e2e/accessibility.spec.ts), which runs in a
// real browser. These tests focus on structural/semantic a11y.
const axeOptions = { rules: { "color-contrast": { enabled: false } } };

describe("accessibility", () => {
  beforeEach(() => {
    mockGetGenerationStats.mockReset();
    mockGetGenerationStats.mockResolvedValue({ totalGenerations: 12 });
  });

  it("the landing controls have no structural accessibility violations", async () => {
    const { container } = render(<HomeControls />);
    await screen.findByText("MIDI packs generated");

    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("the login modal has no structural accessibility violations", async () => {
    const { container } = render(<HomeControls />);
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    await screen.findByRole("dialog");

    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("the register modal has no structural accessibility violations", async () => {
    const { container } = render(<HomeControls />);
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    await screen.findByRole("dialog");

    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });
});
