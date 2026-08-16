import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MidiThumbnailCarousel from "./MidiThumbnailCarousel";
import { GeneratedMidiItem } from "@/lib/api";
import { useGeneratedMidiPreview } from "@/hooks/useGeneratedMidiPreview";

jest.mock("@/hooks/useGeneratedMidiPreview", () => ({
  useGeneratedMidiPreview: jest.fn(() => ({
    error: null,
    preview: null,
    retry: jest.fn(),
    status: "idle",
  })),
}));

const useGeneratedMidiPreviewMock = useGeneratedMidiPreview as jest.MockedFunction<
  typeof useGeneratedMidiPreview
>;

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
  const observers: Array<{ callback: IntersectionObserverCallback; disconnect: jest.Mock }> = [];

  beforeEach(() => {
    observers.splice(0, observers.length);
    useGeneratedMidiPreviewMock.mockClear();
    global.IntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
      const observer = { callback, disconnect: jest.fn(), observe: jest.fn(), unobserve: jest.fn() };
      observers.push(observer);
      return observer;
    }) as unknown as typeof IntersectionObserver;
  });

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

  it("keeps a 17-MIDI pack bounded to the selected item and currently visible thumbnails", async () => {
    const largePack = Array.from({ length: 17 }, (_, index) => ({
      ...mockItems[index % mockItems.length],
      fileName: `pattern_${index + 1}.mid`,
      id: `item-${index + 1}`,
      index,
      preview: { notes: [], truncated: false },
    }));

    render(
      <MidiThumbnailCarousel
        activeIndex={0}
        items={largePack}
        onSelect={jest.fn()}
        packId="pack-17"
      />,
    );

    await waitFor(() => expect(observers.length).toBeGreaterThan(0));

    const initiallyEnabled = useGeneratedMidiPreviewMock.mock.calls
      .filter(([input, enabled]) => Boolean(input) && enabled)
      .map(([input]) => input?.itemId);
    expect(new Set(initiallyEnabled)).toEqual(new Set(["item-1"]));

    act(() => {
      observers.forEach(({ callback }) => callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ));
    });

    await waitFor(() => {
      const enabledIds = new Set(
        useGeneratedMidiPreviewMock.mock.calls
          .filter(([input, enabled]) => Boolean(input) && enabled)
          .map(([input]) => input?.itemId),
      );
      expect(enabledIds.size).toBeLessThanOrEqual(6);
      expect(enabledIds.has("item-17")).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Next items" }));
    expect(screen.getByRole("button", { name: "Select pattern_6.mid" })).toBeInTheDocument();
  });
});
