import { render, screen } from "@testing-library/react";
import GuidePage from "./GuidePage";

describe("GuidePage", () => {
  it("renders a practical guide and returns readers to the studio", () => {
    render(
      <GuidePage
        dawName="Example DAW"
        title="How to import an ICEPUNK MIDI file."
        intro="A short guide."
        importStep="Import the downloaded MIDI file."
        arrangeStep="Choose a sound and arrange it."
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "How to import an ICEPUNK MIDI file." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Import it into Example DAW" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open web studio/i })).toHaveAttribute("href", "/#workspace");
    expect(screen.getByRole("link", { name: /Back to the MIDI generator/i })).toHaveAttribute("href", "/#workspace");
  });
});
