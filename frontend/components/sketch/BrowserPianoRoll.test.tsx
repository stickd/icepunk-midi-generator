import { render } from "@testing-library/react";
import BrowserPianoRoll from "./BrowserPianoRoll";

const data = {
  duration: 4, fileName: "reference.mid", minMidi: 48, maxMidi: 72, trackCount: 1,
  notes: [{ time: 0, duration: 1, midi: 60, name: "C4", velocity: .8 }],
};

it("moves the transport cursor without repainting notes on each playback update", () => {
  const fill = jest.fn();
  const context = { fillRect: jest.fn(), fillText: jest.fn(), setTransform: jest.fn(), clearRect: jest.fn(), beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(), stroke: jest.fn(), roundRect: jest.fn(), fill };
  const getContext = jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const width = jest.spyOn(HTMLCanvasElement.prototype, "clientWidth", "get").mockReturnValue(600);
  const height = jest.spyOn(HTMLCanvasElement.prototype, "clientHeight", "get").mockReturnValue(135);
  const originalObserver = global.ResizeObserver;
  global.ResizeObserver = jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn(), unobserve: jest.fn() })) as unknown as typeof ResizeObserver;
  try {
    const { container, rerender, unmount } = render(<BrowserPianoRoll isPlaying midiData={data} midiFile={null} playbackPositionSeconds={0} />);
    const originalPaints = fill.mock.calls.length;
    expect(originalPaints).toBeGreaterThan(0);
    for (let frame = 1; frame <= 60; frame++) {
      rerender(<BrowserPianoRoll isPlaying midiData={data} midiFile={null} playbackPositionSeconds={frame / 30} />);
    }
    expect(fill).toHaveBeenCalledTimes(originalPaints);
    expect(container.querySelector('.midi-playhead-track')).toHaveStyle({ transform: 'translateX(50%)' });
    unmount();
  } finally {
    getContext.mockRestore(); width.mockRestore(); height.mockRestore(); global.ResizeObserver = originalObserver;
  }
});

