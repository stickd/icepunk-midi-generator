import { render, screen } from "@testing-library/react";
import PianoRollPreview from "./PianoRollPreview";
import BrowserPianoRoll from "./BrowserPianoRoll";
jest.mock("./BrowserPianoRoll", () => ({ __esModule: true, default: jest.fn(() => <div>Shared piano roll</div>) }));
it("adapts thumbnail notes to the same renderer used by generator and feed", () => {
  render(<PianoRollPreview compact label="Reference" notes={[{ pitch: 60, start: .5, duration: 1, velocity: 127 }]} />);
  expect(screen.getByText("Shared piano roll")).toBeInTheDocument();
  const props = jest.mocked(BrowserPianoRoll).mock.calls.at(-1)![0];
  expect(props.size).toBe("compact");
  expect(props.midiData?.duration).toBe(1.5);
  expect(props.midiData?.notes[0]).toMatchObject({ midi: 60, time: .5, duration: 1, velocity: 1 });
});
