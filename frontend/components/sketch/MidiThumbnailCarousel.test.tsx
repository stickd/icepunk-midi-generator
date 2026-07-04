import { render, screen, fireEvent } from "@testing-library/react";
import MidiThumbnailCarousel from "./MidiThumbnailCarousel";
import { GeneratedMidiItem } from "@/lib/api";

const mockItems: GeneratedMidiItem[] = [
  {
    id: "item-1",
    index: 0,
    fileName: "pattern_1.mid",
    downloadUrl: "/test-1.mid",
    durationSeconds: 3.5,
    noteCount: 12,
    trackCount: 1,
    minPitch: 36,
    maxPitch: 72,
    avgPitch: 60,
    bpm: 140,
    preview: {
      notes: [{ pitch: 60, start: 0, duration: 1, velocity: 100 }],
      truncated: false,
    },
  },
  {
    id: "item-2",
    index: 1,
    fileName: "pattern_2.mid",
    downloadUrl: "/test-2.mid",
    durationSeconds: 4.0,
    noteCount: 16,
    trackCount: 1,
    minPitch: 40,
    maxPitch: 80,
    avgPitch: 64,
    bpm: 140,
    preview: {
      notes: [{ pitch: 64, start: 0, duration: 1, velocity: 100 }],
      truncated: false,
    },
  },
];

describe("MidiThumbnailCarousel", () => {
  it("renders thumbnails and triggers onSelect when clicked", () => {
    const onSelect = jest.fn();
    render(
      <MidiThumbnailCarousel
        activeIndex={0}
        items={mockItems}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText("Pack MIDIs")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    const secondThumbnail = screen.getByRole("button", { name: "Select pattern_2.mid" });
    fireEvent.click(secondThumbnail);

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("does not render when items list has 1 or fewer items", () => {
    const { container } = render(
      <MidiThumbnailCarousel
        activeIndex={0}
        items={[mockItems[0]]}
        onSelect={jest.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
