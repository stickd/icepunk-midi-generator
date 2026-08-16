import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import UploadProjectSection from "./UploadProjectSection";
import { TOKEN_KEY, uploadMidiProject } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  TOKEN_KEY: "icepunk_token",
  uploadMidiProject: jest.fn(),
}));

const uploadMidiProjectMock = uploadMidiProject as jest.MockedFunction<
  typeof uploadMidiProject
>;

function file(name: string, type: string, size = 4) {
  return new File([new Uint8Array(size)], name, { type });
}

function chooseFile(label: string, selectedFile: File) {
  fireEvent.change(screen.getByLabelText(label), {
    target: { files: [selectedFile] },
  });
}

function fillTitle(value: string) {
  fireEvent.change(screen.getByPlaceholderText("Frozen lead sketch"), {
    target: { value },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /upload project/i }));
}

describe("UploadProjectSection", () => {
  beforeEach(() => {
    localStorage.clear();
    uploadMidiProjectMock.mockReset();
  });

  it("shows a login error when the user submits without a token", async () => {
    render(<UploadProjectSection />);
    fillTitle("Frozen Lead");
    chooseFile("Choose MIDI file", file("lead.mid", "audio/midi"));
    chooseFile("Choose sample file", file("kick.wav", "audio/wav"));

    submit();

    expect(await screen.findByText("Log in to upload MIDI projects.")).toBeInTheDocument();
    expect(uploadMidiProjectMock).not.toHaveBeenCalled();
  });

  it("validates the MIDI file extension before calling the API", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    render(<UploadProjectSection />);
    fillTitle("Frozen Lead");
    chooseFile("Choose MIDI file", file("lead.txt", "audio/midi"));
    chooseFile("Choose sample file", file("kick.wav", "audio/wav"));

    submit();

    expect(await screen.findByText("MIDI file must use .mid extension.")).toBeInTheDocument();
    expect(uploadMidiProjectMock).not.toHaveBeenCalled();
  });

  it("validates the sample file extension before calling the API", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    render(<UploadProjectSection />);
    fillTitle("Frozen Lead");
    chooseFile("Choose MIDI file", file("lead.mid", "audio/midi"));
    chooseFile("Choose sample file", file("kick.aiff", "audio/aiff"));

    submit();

    expect(await screen.findByText("Sample must use .mp3 or .wav extension.")).toBeInTheDocument();
    expect(uploadMidiProjectMock).not.toHaveBeenCalled();
  });

  it("uploads selected files, renders progress, and shows success state", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    let resolveUpload!: (value: Awaited<ReturnType<typeof uploadMidiProject>>) => void;
    const uploadPromise = new Promise<Awaited<ReturnType<typeof uploadMidiProject>>>((resolve) => {
      resolveUpload = resolve;
    });

    uploadMidiProjectMock.mockImplementation((input) => {
      input.onProgress?.(56);

      return uploadPromise;
    });

    const uploadResponse: Awaited<ReturnType<typeof uploadMidiProject>> = {
        id: 7,
        ownerId: 42,
        title: "Frozen Lead",
        midiObjectKey: "user_uploads/42/lead.mid",
        midiUrl: "https://cdn.example/user_uploads/42/lead.mid",
        sampleObjectKey: "user_uploads/42/kick.wav",
        sampleUrl: "https://cdn.example/user_uploads/42/kick.wav",
        uploadedAt: "2026-07-02T21:00:00Z",
        visibility: "PUBLIC",
        metadata: {},
      };

    render(<UploadProjectSection />);

    fillTitle("Frozen Lead");
    chooseFile("Choose MIDI file", file("lead.mid", "audio/midi"));
    chooseFile("Choose sample file", file("kick.wav", "audio/wav"));
    fireEvent.change(screen.getByLabelText("Visibility"), {
      target: { value: "PUBLIC" },
    });

    expect(screen.getByText(/lead\.mid/)).toBeInTheDocument();
    expect(screen.getByText(/kick\.wav/)).toBeInTheDocument();

    submit();

    expect(await screen.findByText("Uploading...")).toBeInTheDocument();
    expect(await screen.findByText("56%")).toBeInTheDocument();

    await waitFor(() => {
      expect(uploadMidiProjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Frozen Lead",
          visibility: "PUBLIC",
          token: "token-123",
        }),
      );
    });

    resolveUpload(uploadResponse);

    expect(await screen.findByText('Uploaded "Frozen Lead" successfully.')).toBeInTheDocument();
  });

  it("shows a friendly error when the upload API rejects", async () => {
    localStorage.setItem(TOKEN_KEY, "token-123");
    uploadMidiProjectMock.mockRejectedValue(new Error("HTTP_504: timeout"));

    render(<UploadProjectSection />);
    fillTitle("Frozen Lead");
    chooseFile("Choose MIDI file", file("lead.mid", "audio/midi"));
    chooseFile("Choose sample file", file("kick.wav", "audio/wav"));

    submit();

    expect(await screen.findByText("Storage timed out. Try again in a moment.")).toBeInTheDocument();
  });
});
