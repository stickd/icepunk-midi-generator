import { act, renderHook, waitFor } from "@testing-library/react";

import { authUser, getMe, TOKEN_KEY } from "@/lib/api";
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
const mockAuthUser = authUser as jest.Mock;

describe("useSketchAuth", () => {
  it("explains registration rate limiting instead of blaming account data", async () => {
    mockAuthUser.mockResolvedValue({ ok: false, status: 429 });
    const { result } = renderHook(() => useSketchAuth({ setStatus: jest.fn() }));
    await act(async () => { result.current.setAuthMode("register"); });
    await act(async () => { await result.current.handleAuth(); });
    expect(result.current.authStatus).toBe("Too many attempts. Please wait before trying again.");
    expect(result.current.authMode).toBe("register");
  });
  beforeEach(() => {
    mockGetMe.mockReset();
    mockAuthUser.mockReset();
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

  it("moves an unverified login into the verification flow with the email intact", async () => {
    mockAuthUser.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ code: "EMAIL_UNVERIFIED" }),
    });
    const { result } = renderHook(() => useSketchAuth({ setStatus: jest.fn() }));

    await act(async () => {
      result.current.setAuthMode("login");
      result.current.setEmail("pending@example.com");
      result.current.setPassword("secret123");
    });
    await act(async () => {
      await result.current.handleAuth();
    });

    await waitFor(() => {
      expect(result.current.authMode).toBe("verify");
      expect(result.current.authStatus).toBe("Please verify your email before continuing.");
      expect(result.current.email).toBe("pending@example.com");
    });
  });
});
