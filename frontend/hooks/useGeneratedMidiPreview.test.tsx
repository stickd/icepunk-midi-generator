import { act, render, screen, waitFor } from "@testing-library/react";
import {
  __resetGeneratedMidiPreviewCacheForTests,
  useGeneratedMidiPreview,
} from "./useGeneratedMidiPreview";
import { getGeneratedItemPreviewUrl } from "@/lib/api";
import { parseMidiArrayBuffer } from "./useMidiPianoRoll";

jest.mock("@/lib/api", () => ({
  getGeneratedItemPreviewUrl: jest.fn(),
}));

jest.mock("./useMidiPianoRoll", () => ({
  parseMidiArrayBuffer: jest.fn(),
}));

const getGeneratedItemPreviewUrlMock = getGeneratedItemPreviewUrl as jest.MockedFunction<
  typeof getGeneratedItemPreviewUrl
>;
const parseMidiArrayBufferMock = parseMidiArrayBuffer as jest.MockedFunction<
  typeof parseMidiArrayBuffer
>;
const fetchMock = jest.fn();

const parsedMidi = {
  duration: 2.5,
  fileName: "generated_1.mid",
  maxMidi: 72,
  minMidi: 48,
  notes: [{ duration: 0.5, midi: 60, name: "C4", time: 0, velocity: 0.8 }],
  trackCount: 2,
};

function midiResponse(status = 200) {
  return {
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(16)),
    ok: status >= 200 && status < 300,
    status,
  } as unknown as Response;
}

function PreviewProbe({
  itemId,
  enabled = true,
  label = itemId,
  packId = "pack-1",
}: {
  itemId: string;
  enabled?: boolean;
  label?: string;
  packId?: string;
}) {
  const preview = useGeneratedMidiPreview(
    { fileName: `${itemId}.mid`, itemId, packId, token: null },
    enabled,
  );

  return (
    <div>
      <span data-testid={`preview-${label}`}>
        {preview.status}:{preview.preview?.data.notes.length ?? 0}:{preview.preview?.data.trackCount ?? 0}:{preview.preview?.data.duration ?? 0}
      </span>
      <span data-testid={`error-${label}`}>{preview.error ?? ""}</span>
      <button onClick={preview.retry} type="button">Retry {label}</button>
    </div>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("useGeneratedMidiPreview", () => {
  beforeEach(() => {
    __resetGeneratedMidiPreviewCacheForTests();
    getGeneratedItemPreviewUrlMock.mockReset();
    parseMidiArrayBufferMock.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock;

    getGeneratedItemPreviewUrlMock.mockResolvedValue({
      expiresAt: "2026-08-16T12:00:00Z",
      url: "http://storage.test/generated.mid",
    });
    fetchMock.mockResolvedValue(midiResponse());
    parseMidiArrayBufferMock.mockResolvedValue(parsedMidi);
  });

  afterEach(() => {
    __resetGeneratedMidiPreviewCacheForTests();
  });

  it("starts loading the selected generated MIDI automatically", async () => {
    render(<PreviewProbe itemId="selected" />);

    await waitFor(() => expect(screen.getByTestId("preview-selected")).toHaveTextContent("ready:1:2:2.5"));
    expect(getGeneratedItemPreviewUrlMock).toHaveBeenCalledWith("pack-1", "selected", null, expect.any(AbortSignal));
  });

  it("does not request MIDI for an offscreen card", async () => {
    render(<PreviewProbe enabled={false} itemId="offscreen" />);

    await act(async () => {});
    expect(getGeneratedItemPreviewUrlMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts loading as soon as a visible card becomes eligible", async () => {
    const view = render(<PreviewProbe enabled={false} itemId="visible" />);
    view.rerender(<PreviewProbe enabled itemId="visible" />);

    await waitFor(() => expect(screen.getByTestId("preview-visible")).toHaveTextContent("ready:1:2:2.5"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reuses a cached parsed result after a card remounts", async () => {
    const first = render(<PreviewProbe itemId="cached" />);
    await waitFor(() => expect(screen.getByTestId("preview-cached")).toHaveTextContent("ready:1:2:2.5"));
    first.unmount();

    render(<PreviewProbe itemId="cached" />);
    await waitFor(() => expect(screen.getByTestId("preview-cached")).toHaveTextContent("ready:1:2:2.5"));

    expect(getGeneratedItemPreviewUrlMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(parseMidiArrayBufferMock).toHaveBeenCalledTimes(1);
  });

  it("shares one request when a visible feed thumbnail and its selected big preview need the same MIDI", async () => {
    render(
      <>
        <PreviewProbe itemId="shared-feed-item" label="feed-thumbnail" />
        <PreviewProbe itemId="shared-feed-item" label="feed-selected" />
      </>,
    );

    await waitFor(() => expect(screen.getByTestId("preview-feed-thumbnail")).toHaveTextContent("ready:1:2:2.5"));
    await waitFor(() => expect(screen.getByTestId("preview-feed-selected")).toHaveTextContent("ready:1:2:2.5"));

    expect(getGeneratedItemPreviewUrlMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(parseMidiArrayBufferMock).toHaveBeenCalledTimes(1);
  });

  it("keeps same-index item identities isolated between different feed packs", async () => {
    render(
      <>
        <PreviewProbe itemId="item-1" label="pack-a" packId="pack-a" />
        <PreviewProbe itemId="item-1" label="pack-b" packId="pack-b" />
      </>,
    );

    await waitFor(() => expect(screen.getByTestId("preview-pack-a")).toHaveTextContent("ready:1:2:2.5"));
    await waitFor(() => expect(screen.getByTestId("preview-pack-b")).toHaveTextContent("ready:1:2:2.5"));

    expect(getGeneratedItemPreviewUrlMock).toHaveBeenCalledTimes(2);
    expect(getGeneratedItemPreviewUrlMock).toHaveBeenCalledWith("pack-a", "item-1", null, expect.any(AbortSignal));
    expect(getGeneratedItemPreviewUrlMock).toHaveBeenCalledWith("pack-b", "item-1", null, expect.any(AbortSignal));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps loading distinct from an actual preview error", async () => {
    const pendingParse = deferred<typeof parsedMidi>();
    parseMidiArrayBufferMock.mockReturnValueOnce(pendingParse.promise);
    render(<PreviewProbe itemId="loading" />);

    await waitFor(() => expect(screen.getByTestId("preview-loading")).toHaveTextContent("loading:0:0:0"));
    expect(screen.getByTestId("error-loading")).toHaveTextContent("");

    await act(async () => pendingParse.resolve(parsedMidi));
    await waitFor(() => expect(screen.getByTestId("preview-loading")).toHaveTextContent("ready:1:2:2.5"));
  });

  it("uses parsed MIDI metadata instead of leaving notes, tracks, and duration unknown", async () => {
    render(<PreviewProbe itemId="metadata" />);

    await waitFor(() => expect(screen.getByTestId("preview-metadata")).toHaveTextContent("ready:1:2:2.5"));
    expect(parseMidiArrayBufferMock).toHaveBeenCalledWith(expect.any(ArrayBuffer), "metadata.mid");
  });

  it("contains one item failure without blocking another MIDI preview", async () => {
    getGeneratedItemPreviewUrlMock.mockImplementation(async (_packId, itemId) => ({
      expiresAt: "2026-08-16T12:00:00Z",
      url: `http://storage.test/${itemId}.mid`,
    }));
    fetchMock.mockImplementation(async (url: string) => midiResponse(url.includes("broken") ? 500 : 200));

    render(<><PreviewProbe itemId="broken" /><PreviewProbe itemId="healthy" /></>);

    await waitFor(() => expect(screen.getByTestId("preview-broken")).toHaveTextContent("error:0:0:0"));
    await waitFor(() => expect(screen.getByTestId("preview-healthy")).toHaveTextContent("ready:1:2:2.5"));
    expect(screen.getByTestId("error-broken")).toHaveTextContent("Could not load this MIDI preview.");
  });

  it("ignores a stale response after the user selects another MIDI", async () => {
    const firstParse = deferred<typeof parsedMidi>();
    const secondParse = deferred<typeof parsedMidi>();
    parseMidiArrayBufferMock
      .mockReturnValueOnce(firstParse.promise)
      .mockReturnValueOnce(secondParse.promise);

    const view = render(<PreviewProbe itemId="first" />);
    await waitFor(() => expect(parseMidiArrayBufferMock).toHaveBeenCalledTimes(1));
    view.rerender(<PreviewProbe itemId="second" />);
    await waitFor(() => expect(parseMidiArrayBufferMock).toHaveBeenCalledTimes(2));

    await act(async () => secondParse.resolve({ ...parsedMidi, fileName: "second.mid", trackCount: 3 }));
    await waitFor(() => expect(screen.getByTestId("preview-second")).toHaveTextContent("ready:1:3:2.5"));
    await act(async () => firstParse.resolve(parsedMidi));

    expect(screen.getByTestId("preview-second")).toHaveTextContent("ready:1:3:2.5");
    expect(screen.queryByTestId("preview-first")).not.toBeInTheDocument();
  });

  it("refreshes an expired presigned URL once before reporting an error", async () => {
    getGeneratedItemPreviewUrlMock
      .mockResolvedValueOnce({ expiresAt: "2026-08-16T11:00:00Z", url: "http://storage.test/expired.mid" })
      .mockResolvedValueOnce({ expiresAt: "2026-08-16T12:00:00Z", url: "http://storage.test/fresh.mid" });
    fetchMock
      .mockResolvedValueOnce(midiResponse(403))
      .mockResolvedValueOnce(midiResponse(200));

    render(<PreviewProbe itemId="expired" />);

    await waitFor(() => expect(screen.getByTestId("preview-expired")).toHaveTextContent("ready:1:2:2.5"));
    expect(getGeneratedItemPreviewUrlMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
