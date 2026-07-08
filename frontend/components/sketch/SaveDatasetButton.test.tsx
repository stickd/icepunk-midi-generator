import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import SaveDatasetButton from "./SaveDatasetButton";
import { saveDatasetPreset } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  saveDatasetPreset: jest.fn(),
}));

const saveDatasetPresetMock = saveDatasetPreset as jest.MockedFunction<
  typeof saveDatasetPreset
>;

function openModal() {
  fireEvent.click(screen.getByRole("button", { name: /save as dataset/i }));
}

describe("SaveDatasetButton", () => {
  beforeEach(() => {
    saveDatasetPresetMock.mockReset();
  });

  it("renders nothing when there is no auth token", () => {
    const { container } = render(
      <SaveDatasetButton
        token={null}
        tempAnalysisId="temp-1"
        onStubStatus={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no tempAnalysisId", () => {
    const { container } = render(
      <SaveDatasetButton
        token="token-123"
        tempAnalysisId={undefined}
        onStubStatus={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("opens a modal with a disabled Save button until a name is entered", () => {
    render(
      <SaveDatasetButton
        token="token-123"
        tempAnalysisId="temp-1"
        onStubStatus={jest.fn()}
      />,
    );

    openModal();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const saveButton = screen.getByRole("button", { name: /^save$/i });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("e.g. Dark loops"), {
      target: { value: "Dark Loops" },
    });

    expect(saveButton).toBeEnabled();
  });

  it("saves the dataset, closes the modal, and reports success", async () => {
    saveDatasetPresetMock.mockResolvedValue({
      id: "preset-1",
      name: "Dark Loops",
      sourceMidiCount: 4,
      createdAt: "2026-07-08T12:00:00Z",
    });
    const onStubStatus = jest.fn();

    render(
      <SaveDatasetButton
        token="token-123"
        tempAnalysisId="temp-1"
        onStubStatus={onStubStatus}
      />,
    );

    openModal();
    fireEvent.change(screen.getByPlaceholderText("e.g. Dark loops"), {
      target: { value: "Dark Loops" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(saveDatasetPresetMock).toHaveBeenCalledWith(
        "token-123",
        "Dark Loops",
        "temp-1",
      );
    });

    await waitFor(() => {
      expect(onStubStatus).toHaveBeenCalledWith('Dataset "Dark Loops" saved.');
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a friendly duplicate-name message on HTTP_409 and keeps the modal open", async () => {
    saveDatasetPresetMock.mockRejectedValue(new Error("HTTP_409: duplicate"));
    const onStubStatus = jest.fn();

    render(
      <SaveDatasetButton
        token="token-123"
        tempAnalysisId="temp-1"
        onStubStatus={onStubStatus}
      />,
    );

    openModal();
    fireEvent.change(screen.getByPlaceholderText("e.g. Dark loops"), {
      target: { value: "Dark Loops" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(onStubStatus).toHaveBeenCalledWith(
        "A dataset with that name already exists.",
      );
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows a generic error message for other failures", async () => {
    saveDatasetPresetMock.mockRejectedValue(new Error("HTTP_500: boom"));
    const onStubStatus = jest.fn();

    render(
      <SaveDatasetButton
        token="token-123"
        tempAnalysisId="temp-1"
        onStubStatus={onStubStatus}
      />,
    );

    openModal();
    fireEvent.change(screen.getByPlaceholderText("e.g. Dark loops"), {
      target: { value: "Dark Loops" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(onStubStatus).toHaveBeenCalledWith(
        "Could not save dataset. Try again.",
      );
    });
  });
});
