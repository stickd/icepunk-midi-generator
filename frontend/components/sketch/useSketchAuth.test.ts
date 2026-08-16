import { renderHook, waitFor } from "@testing-library/react";

import { getMe, TOKEN_KEY } from "@/lib/api";
import { useSketchAuth } from "./useSketchAuth";

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");

  return {
    ...actual,
    authUser: jest.fn(),
    getMe: jest.fn(),
  };
});

const mockGetMe = getMe as jest.Mock;

describe("useSketchAuth", () => {
  beforeEach(() => {
    mockGetMe.mockReset();
    window.localStorage.clear();
  });

  it("clears an invalid stored token when the authenticated profile request returns 401", async () => {
    window.localStorage.setItem(TOKEN_KEY, "stale-jwt");
    mockGetMe.mockRejectedValue(new Error("HTTP_401: unauthorized"));

    const { result } = renderHook(() => useSketchAuth({ setStatus: jest.fn() }));

    await waitFor(() => {
      expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.me).toBeNull();
    });
  });

  it("keeps the stored token when the profile request fails without an auth error", async () => {
    window.localStorage.setItem(TOKEN_KEY, "jwt-abc");
    mockGetMe.mockRejectedValue(new TypeError("Failed to fetch"));

    const { result } = renderHook(() => useSketchAuth({ setStatus: jest.fn() }));

    await waitFor(() => expect(mockGetMe).toHaveBeenCalledWith("jwt-abc", expect.any(AbortSignal)));

    expect(window.localStorage.getItem(TOKEN_KEY)).toBe("jwt-abc");
    expect(result.current.token).toBe("jwt-abc");
  });
});
