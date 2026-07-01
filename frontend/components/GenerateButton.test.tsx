import { fireEvent, render, screen } from "@testing-library/react";

import GenerateButton from "./GenerateButton";

describe("GenerateButton", () => {
  it("calls onGenerate when clicked while idle", () => {
    const onGenerate = jest.fn();
    render(<GenerateButton isGenerating={false} onGenerate={onGenerate} />);

    fireEvent.click(screen.getByRole("button", { name: "Generate MIDI Pack" }));

    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("is disabled and shows a generating label while a generation is in progress", () => {
    const onGenerate = jest.fn();
    render(<GenerateButton isGenerating={true} onGenerate={onGenerate} />);

    const button = screen.getByRole("button", { name: "Generating..." });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onGenerate).not.toHaveBeenCalled();
  });
});
