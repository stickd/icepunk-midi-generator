import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import HomeControls from "./HomeControls";
import { authUser, getGenerationStats, TOKEN_KEY } from "@/lib/api";

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");

  return {
    ...actual,
    authUser: jest.fn(),
    getGenerationStats: jest.fn(),
    generateMidiPack: jest.fn(),
  };
});

const mockAuthUser = authUser as jest.Mock;
const mockGetGenerationStats = getGenerationStats as jest.Mock;

function mockAuthResponse(overrides: Partial<Response> = {}): Response {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as Response;
}

function findModal(headingName: string) {
  return screen.findByRole("heading", { name: headingName }).then((heading) => {
    const root = heading.closest('div[class*="fixed"]');
    if (!root) throw new Error(`Could not find modal root for heading "${headingName}"`);
    return within(root as HTMLElement);
  });
}

describe("HomeControls", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockAuthUser.mockReset();
    mockGetGenerationStats.mockReset();
    mockGetGenerationStats.mockResolvedValue({ totalGenerations: 12 });
  });

  describe("authentication modal rendering and interaction", () => {
    it("opens the login modal from the navbar and closes it via the close button", async () => {
      render(<HomeControls />);

      fireEvent.click(screen.getByRole("button", { name: "Login" }));

      expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();

      const modal = await findModal("Welcome back");
      fireEvent.click(modal.getByRole("button", { name: "Close" }));

      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: "Welcome back" })).not.toBeInTheDocument();
      });
    });

    it("opens the register modal from the navbar", async () => {
      render(<HomeControls />);

      fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

      expect(await screen.findByRole("heading", { name: "Create account" })).toBeInTheDocument();
    });

    it("switches from login to register mode and resets the auth status", async () => {
      mockAuthUser.mockResolvedValue(mockAuthResponse({ ok: false, status: 400 }));

      render(<HomeControls />);
      fireEvent.click(screen.getByRole("button", { name: "Login" }));
      const loginModal = await findModal("Welcome back");

      fireEvent.change(loginModal.getByPlaceholderText("Email"), {
        target: { value: "a@b.com" },
      });
      fireEvent.change(loginModal.getByPlaceholderText("Password"), {
        target: { value: "wrong" },
      });
      fireEvent.click(loginModal.getByRole("button", { name: "Login" }));

      expect(
        await screen.findByText("Check your email, username, and password length."),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

      expect(await screen.findByRole("heading", { name: "Create account" })).toBeInTheDocument();
      expect(
        screen.queryByText("Check your email, username, and password length."),
      ).not.toBeInTheDocument();
    });
  });

  describe("token save functionality", () => {
    it("saves the token, closes the modal, and shows the logout button after a successful login", async () => {
      mockAuthUser.mockResolvedValue(
        mockAuthResponse({ json: jest.fn().mockResolvedValue({ token: "jwt-123" }) }),
      );

      render(<HomeControls />);
      fireEvent.click(screen.getByRole("button", { name: "Login" }));
      const modal = await findModal("Welcome back");

      fireEvent.change(modal.getByPlaceholderText("Email"), { target: { value: "a@b.com" } });
      fireEvent.change(modal.getByPlaceholderText("Password"), {
        target: { value: "secret123" },
      });
      fireEvent.click(modal.getByRole("button", { name: "Login" }));

      await waitFor(() => {
        expect(window.localStorage.getItem(TOKEN_KEY)).toBe("jwt-123");
      });

      expect(screen.queryByRole("heading", { name: "Welcome back" })).not.toBeInTheDocument();
      expect(await screen.findByRole("button", { name: "Logout" })).toBeInTheDocument();
      expect(screen.getByText("You are logged in.")).toBeInTheDocument();
    });

    it("does not save a token or close the modal when the response has no token", async () => {
      mockAuthUser.mockResolvedValue(
        mockAuthResponse({ json: jest.fn().mockResolvedValue({}) }),
      );

      render(<HomeControls />);
      fireEvent.click(screen.getByRole("button", { name: "Login" }));
      const modal = await findModal("Welcome back");

      fireEvent.change(modal.getByPlaceholderText("Email"), { target: { value: "a@b.com" } });
      fireEvent.change(modal.getByPlaceholderText("Password"), {
        target: { value: "secret123" },
      });
      fireEvent.click(modal.getByRole("button", { name: "Login" }));

      expect(await screen.findByText("Auth failed. Token was not returned.")).toBeInTheDocument();
      expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    });
  });

  describe("token clear functionality", () => {
    it("clears the token and shows a logged-out message when logging out", async () => {
      window.localStorage.setItem(TOKEN_KEY, "existing-jwt");

      render(<HomeControls />);

      const logoutButton = await screen.findByRole("button", { name: "Logout" });
      fireEvent.click(logoutButton);

      expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(await screen.findByRole("button", { name: "Login" })).toBeInTheDocument();
      expect(screen.getByText("You are logged out.")).toBeInTheDocument();
    });
  });

  describe("generation counter display during loading", () => {
    it("shows a loading state until stats resolve, then shows the total", async () => {
      let resolveStats!: (value: { totalGenerations: number }) => void;
      mockGetGenerationStats.mockReturnValue(
        new Promise((resolve) => {
          resolveStats = resolve;
        }),
      );

      render(<HomeControls />);

      expect(screen.getByText("Loading")).toBeInTheDocument();

      await act(async () => {
        resolveStats({ totalGenerations: 7 });
      });

      await waitFor(() => {
        expect(screen.queryByText("Loading")).not.toBeInTheDocument();
      });
      expect(screen.getByText("7")).toBeInTheDocument();
    });
  });

  describe("generation counter display on failure", () => {
    it("falls back to the placeholder when fetching generation stats fails", async () => {
      mockGetGenerationStats.mockRejectedValue(new Error("network down"));

      render(<HomeControls />);

      await waitFor(() => {
        expect(screen.queryByText("Loading")).not.toBeInTheDocument();
      });
      expect(screen.getByText("...")).toBeInTheDocument();
    });
  });

  describe("state transitions", () => {
    it("keeps the modal open and shows an error message when registration returns a conflict", async () => {
      mockAuthUser.mockResolvedValue(mockAuthResponse({ ok: false, status: 409 }));

      render(<HomeControls />);
      fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
      const modal = await findModal("Create account");

      fireEvent.change(modal.getByPlaceholderText("Username"), { target: { value: "newman" } });
      fireEvent.change(modal.getByPlaceholderText("Email"), { target: { value: "a@b.com" } });
      fireEvent.change(modal.getByPlaceholderText("Password"), {
        target: { value: "secret123" },
      });
      fireEvent.click(modal.getByRole("button", { name: "Register" }));

      expect(
        await screen.findByText("An account with that email or username already exists."),
      ).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Create account" })).toBeInTheDocument();
      expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it("shows a busy message and does not throw when auth requests are rate-limited", async () => {
      mockAuthUser.mockResolvedValue(mockAuthResponse({ ok: false, status: 429 }));

      render(<HomeControls />);
      fireEvent.click(screen.getByRole("button", { name: "Login" }));
      const modal = await findModal("Welcome back");

      fireEvent.change(modal.getByPlaceholderText("Email"), { target: { value: "a@b.com" } });
      fireEvent.change(modal.getByPlaceholderText("Password"), {
        target: { value: "secret123" },
      });
      fireEvent.click(modal.getByRole("button", { name: "Login" }));

      expect(
        await screen.findByText("Too many attempts. Please try again later."),
      ).toBeInTheDocument();
    });

    it("shows a backend-unavailable message when the auth request itself fails", async () => {
      mockAuthUser.mockRejectedValue(new TypeError("Failed to fetch"));

      render(<HomeControls />);
      fireEvent.click(screen.getByRole("button", { name: "Login" }));
      const modal = await findModal("Welcome back");

      fireEvent.change(modal.getByPlaceholderText("Email"), { target: { value: "a@b.com" } });
      fireEvent.change(modal.getByPlaceholderText("Password"), {
        target: { value: "secret123" },
      });
      fireEvent.click(modal.getByRole("button", { name: "Login" }));

      expect(
        await screen.findByText("Backend is not available right now."),
      ).toBeInTheDocument();
    });
  });
});
