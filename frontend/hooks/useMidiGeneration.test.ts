import { act, renderHook } from "@testing-library/react";

import { useMidiGeneration } from "./useMidiGeneration";
import { GenerateMidiResponse, generateMidiPack, TOKEN_KEY } from "@/lib/api";

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");

  return {
    ...actual,
    generateMidiPack: jest.fn(),
  };
});

const mockGenerateMidiPack = generateMidiPack as jest.Mock;
const factoryRequest = {
  amount: 10,
  bpm: 146,
  octaves: 1,
  packName: "Test Pack",
  pitch: 0,
  publishMode: "PUBLIC" as const,
  source: "FACTORY" as const,
  type: "MELODY" as const,
};

function generatedResponse(overrides: Partial<GenerateMidiResponse> = {}): GenerateMidiResponse {
  return {
    amount: 10,
    bpm: 146,
    createdAt: "2026-07-03T12:00:00Z",
    downloadUrl: "/generated-packs/pack-1/download",
    items: [],
    name: "Test Pack",
    octaves: 1,
    packDownloadUrl: "/generated-packs/pack-1/download",
    packId: "pack-1",
    pitch: 0,
    source: "FACTORY",
    totalGenerations: 5,
    type: "MELODY",
    ...overrides,
  };
}

describe("useMidiGeneration", () => {
  beforeEach(() => {
    mockGenerateMidiPack.mockReset();
    window.localStorage.clear();
  });

  it("performs a successful generation, stores the pack response, and reports the total", async () => {
    const response = generatedResponse();
    mockGenerateMidiPack.mockResolvedValue(response);
    const onGenerated = jest.fn();

    const { result } = renderHook(() => useMidiGeneration(undefined, onGenerated));

    await act(async () => {
      await result.current.handleGenerateMidi(factoryRequest);
    });

    expect(mockGenerateMidiPack).toHaveBeenCalledWith(factoryRequest, null);
    expect(onGenerated).toHaveBeenCalledWith(5);
    expect(result.current.status).toBe("MIDI pack generated. Download links are ready.");
    expect(result.current.lastGeneration).toEqual(response);
    expect(result.current.isGenerating).toBe(false);
  });

  it("passes the stored token to generateMidiPack for authenticated users", async () => {
    window.localStorage.setItem(TOKEN_KEY, "jwt-abc");
    mockGenerateMidiPack.mockResolvedValue(generatedResponse({ totalGenerations: 1 }));

    const { result } = renderHook(() => useMidiGeneration());

    await act(async () => {
      await result.current.handleGenerateMidi(factoryRequest);
    });

    expect(mockGenerateMidiPack).toHaveBeenCalledWith(factoryRequest, "jwt-abc");
  });

  it("shows a friendly message and does not log out on a guest daily-limit error", async () => {
    mockGenerateMidiPack.mockRejectedValue(new Error("Guest daily generation limit reached"));
    const onUnauthorized = jest.fn();

    const { result } = renderHook(() => useMidiGeneration(onUnauthorized));

    await act(async () => {
      await result.current.handleGenerateMidi(factoryRequest);
    });

    expect(result.current.status).toBe(
      "You've used your guest generation limit. Log in or create an account to unlock unlimited generations.",
    );
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(result.current.isGenerating).toBe(false);
  });

  it("shows a friendly message on an authenticated user's daily-limit error", async () => {
    mockGenerateMidiPack.mockRejectedValue(new Error("User daily generation limit reached"));

    const { result } = renderHook(() => useMidiGeneration());

    await act(async () => {
      await result.current.handleGenerateMidi(factoryRequest);
    });

    expect(result.current.status).toBe(
      "You've reached today's generation limit. Log in or create an account to unlock unlimited generations.",
    );
  });

  it("clears the token and triggers logout on a 401 response", async () => {
    window.localStorage.setItem(TOKEN_KEY, "stale-jwt");
    mockGenerateMidiPack.mockRejectedValue(new Error("HTTP_401: unauthorized"));
    const onUnauthorized = jest.fn();

    const { result } = renderHook(() => useMidiGeneration(onUnauthorized));

    await act(async () => {
      await result.current.handleGenerateMidi(factoryRequest);
    });

    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("Your session expired. Please log in again.");
  });

  it("does not trigger logout on a 401 when generation was sent without a token", async () => {
    mockGenerateMidiPack.mockRejectedValue(new Error("HTTP_401: unauthorized"));
    const onUnauthorized = jest.fn();

    const { result } = renderHook(() => useMidiGeneration(onUnauthorized));

    await act(async () => {
      await result.current.handleGenerateMidi(factoryRequest);
    });

    expect(mockGenerateMidiPack).toHaveBeenCalledWith(factoryRequest, null);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(result.current.status).toBe("Generation failed. Please try again.");
  });

  it("removes placeholder tokens without triggering logout or sending authorization", async () => {
    window.localStorage.setItem(TOKEN_KEY, "undefined");
    mockGenerateMidiPack.mockResolvedValue(generatedResponse({ totalGenerations: 1 }));
    const onUnauthorized = jest.fn();

    const { result } = renderHook(() => useMidiGeneration(onUnauthorized));

    await act(async () => {
      await result.current.handleGenerateMidi(factoryRequest);
    });

    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(mockGenerateMidiPack).toHaveBeenCalledWith(factoryRequest, null);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("shows a busy message on a 429 / server-busy response", async () => {
    mockGenerateMidiPack.mockRejectedValue(new Error("HTTP_429: Server is busy"));

    const { result } = renderHook(() => useMidiGeneration());

    await act(async () => {
      await result.current.handleGenerateMidi(factoryRequest);
    });

    expect(result.current.status).toBe(
      "The generator is busy right now. Please try again in a moment.",
    );
  });

  it("sets isGenerating true while in flight and false once resolved", async () => {
    let resolveGeneration!: (value: GenerateMidiResponse) => void;
    mockGenerateMidiPack.mockReturnValue(
      new Promise((resolve) => {
        resolveGeneration = resolve;
      }),
    );

    const { result } = renderHook(() => useMidiGeneration());

    let generatePromise!: Promise<void>;
    act(() => {
      generatePromise = result.current.handleGenerateMidi(factoryRequest);
    });

    expect(result.current.isGenerating).toBe(true);
    expect(result.current.status).toBe("Generating frozen MIDI patterns...");

    await act(async () => {
      resolveGeneration(generatedResponse({ totalGenerations: 1 }));
      await generatePromise;
    });

    expect(result.current.isGenerating).toBe(false);
  });

  it("resets isGenerating to false after a failure so a retry can succeed", async () => {
    mockGenerateMidiPack.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useMidiGeneration());

    await act(async () => {
      await result.current.handleGenerateMidi(factoryRequest);
    });

    expect(result.current.isGenerating).toBe(false);
    expect(result.current.status).toBe("Generation failed. Please try again.");

    mockGenerateMidiPack.mockResolvedValueOnce(
      generatedResponse({
        downloadUrl: "/generated-packs/pack-1/download",
        packDownloadUrl: "/generated-packs/pack-1/download",
        totalGenerations: 9,
      }),
    );

    await act(async () => {
      await result.current.handleGenerateMidi(factoryRequest);
    });

    expect(result.current.status).toBe("MIDI pack generated. Download links are ready.");
    expect(result.current.isGenerating).toBe(false);
    expect(mockGenerateMidiPack).toHaveBeenCalledTimes(2);
  });
});
