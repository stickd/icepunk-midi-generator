import { render } from "@testing-library/react";
import PianoRollPreview from "./PianoRollPreview";

describe("PianoRollPreview", () => {
  it("renders notes with palette colors", () => {
    const notes = [
      { duration: 0.5, pitch: 60, start: 0, velocity: 100 },
      { duration: 0.5, pitch: 64, start: 0.5, velocity: 90 },
      { duration: 0.5, pitch: 67, start: 1, velocity: 80 },
    ];

    const { container } = render(
      <PianoRollPreview label="Test Palette MIDI" notes={notes} />,
    );

    const rects = container.querySelectorAll("rect");
    expect(rects).toHaveLength(3);

    const colors = Array.from(rects).map((rect) => rect.getAttribute("fill"));
    expect(colors.every((c) => Boolean(c))).toBe(true);
    expect(colors[0]).toMatch(/^url\(#note-grad-/);
  });
});
