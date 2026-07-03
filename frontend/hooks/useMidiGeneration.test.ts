import { act, renderHook } from "@testing-library/react";

import { useMidiGeneration } from "./useMidiGeneration";
import { generateMidiPack, TOKEN_KEY } from "@/lib/api";

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");

  return {
    ...actual,
    generateMidiPack: jest.fn(),
  };
});

const mockGenerateMidiPack = generateMidiPack as jest.Mock;

describe("useMidiGeneration", () => {
  let clickSpy: jest.SpyInstance;
  let clickedAnchor: { href: string; target: string; rel: string } | null;

  beforeEach(() => {
    mockGenerateMidiPack.mockReset();
    window.localStorage.clear();
    clickedAnchor = null;
    clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clickedAnchor = { href: this.href, target: this.target, rel: this.rel };
      });
  });

  afterEach(() => {
    clickSpy.mockRestore();
  });

  it("performs a successful generation, triggers the download, and reports the total", async () => {
    mockGenerateMidiPack.mockResolvedValue({
      downloadUrl: "https://cdn.example.com/zips/pack.zip",
      totalGenerations: 5,
    });
    const onGenerated = jest.fn();

    const { result } = renderHook(() => useMidiGeneration(undefined, onGenerated));

    await act(async () => {
      await result.current.handleGenerateMidi();
    });

    expect(mockGenerateMidiPack).toHaveBeenCalledWith(null);
    expect(clickedAnchor).toEqual({
      href: "https://cdn.example.com/zips/pack.zip",
      target: "_blank",
      rel: "noreferrer",
    });
    expect(onGenerated).toHaveBeenCalledWith(5);
    expect(result.current.status).toBe("MIDI pack downloaded.");
    expect(result.current.lastGeneration).toEqual({
      downloadUrl: "https://cdn.example.com/zips/pack.zip",
      totalGenerations: 5,
    });
    expect(result.current.isGenerating).toBe(false);
  });

  it("passes the stored token to generateMidiPack for authenticated users", async () => {
    window.localStorage.setItem(TOKEN_KEY, "jwt-abc");
    mockGenerateMidiPack.mockResolvedValue({
      downloadUrl: "https://cdn.example.com/zips/pack.zip",
      totalGenerations: 1,
    });

    const { result } = renderHook(() => useMidiGeneration());

    await act(async () => {
      await result.current.handleGenerateMidi();
    });

    expect(mockGenerateMidiPack).toHaveBeenCalledWith("jwt-abc");
  });

  it("shows a friendly message and does not log out on a guest daily-limit error", async () => {
    mockGenerateMidiPack.mockRejectedValue(new Error("Guest daily generation limit reached"));
    const onUnauthorized = jest.fn();

    const { result } = renderHook(() => useMidiGeneration(onUnauthorized));

    await act(async () => {
      await result.current.handleGenerateMidi();
    });

    expect(result.current.status).toBe(
      "You've used your free daily generation. Log in or create an account to unlock more generations.",
    );
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(result.current.isGenerating).toBe(false);
  });

  it("shows a friendly message on an authenticated user's daily-limit error", async () => {
    mockGenerateMidiPack.mockRejectedValue(new Error("User daily generation limit reached"));

    const { result } = renderHook(() => useMidiGeneration());

    await act(async () => {
      await result.current.handleGenerateMidi();
    });

    expect(result.current.status).toBe(
      "You've reached today's generation limit. Please try again tomorrow.",
    );
  });

  it("clears the token and triggers logout on a 401 response", async () => {
    window.localStorage.setItem(TOKEN_KEY, "stale-jwt");
    mockGenerateMidiPack.mockRejectedValue(new Error("HTTP_401: unauthorized"));
    const onUnauthorized = jest.fn();

    const { result } = renderHook(() => useMidiGeneration(onUnauthorized));

    await act(async () => {
      await result.current.handleGenerateMidi();
    });

    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("Your session expired. Please log in again.");
  });

  it("shows a busy message on a 429 / server-busy response", async () => {
    mockGenerateMidiPack.mockRejectedValue(new Error("HTTP_429: Server is busy"));

    const { result } = renderHook(() => useMidiGeneration());

    await act(async () => {
      await result.current.handleGenerateMidi();
    });

    expect(result.current.status).toBe(
      "The generator is busy right now. Please try again in a moment.",
    );
  });

  it("sets isGenerating true while in flight and false once resolved", async () => {
    let resolveGeneration!: (value: {
      downloadUrl: string;
      totalGenerations: number;
    }) => void;
    mockGenerateMidiPack.mockReturnValue(
      new Promise((resolve) => {
        resolveGeneration = resolve;
      }),
    );

    const { result } = renderHook(() => useMidiGeneration());

    let generatePromise!: Promise<void>;
    act(() => {
      generatePromise = result.current.handleGenerateMidi();
    });

    expect(result.current.isGenerating).toBe(true);
    expect(result.current.status).toBe("Generating frozen MIDI patterns...");

    await act(async () => {
      resolveGeneration({ downloadUrl: "https://cdn.example.com/zips/pack.zip", totalGenerations: 1 });
      await generatePromise;
    });

    expect(result.current.isGenerating).toBe(false);
  });

  it("resets isGenerating to false after a failure so a retry can succeed", async () => {
    mockGenerateMidiPack.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useMidiGeneration());

    await act(async () => {
      await result.current.handleGenerateMidi();
    });

    expect(result.current.isGenerating).toBe(false);
    expect(result.current.status).toBe("Generation failed. Please try again.");

    mockGenerateMidiPack.mockResolvedValueOnce({
      downloadUrl: "https://cdn.example.com/zips/retry.zip",
      totalGenerations: 9,
    });

    await act(async () => {
      await result.current.handleGenerateMidi();
    });

    expect(result.current.status).toBe("MIDI pack downloaded.");
    expect(result.current.isGenerating).toBe(false);
    expect(mockGenerateMidiPack).toHaveBeenCalledTimes(2);
  });
});
