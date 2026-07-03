const ORIGINAL_API_URL = process.env.NEXT_PUBLIC_API_URL;

function mockResponse(overrides: Partial<Response> = {}): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: jest.fn().mockResolvedValue(""),
    json: jest.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as Response;
}

describe("lib/api", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    if (ORIGINAL_API_URL === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = ORIGINAL_API_URL;
    }
  });

  describe("API URL configuration", () => {
    it("falls back to localhost:8081 when NEXT_PUBLIC_API_URL is unset", async () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      const { getGenerationStats } = await import("./api");
      fetchMock.mockResolvedValue(
        mockResponse({ json: jest.fn().mockResolvedValue({ totalGenerations: 1 }) }),
      );

      await getGenerationStats();

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8081/generation-stats",
        expect.any(Object),
      );
    });

    it("uses NEXT_PUBLIC_API_URL when set", async () => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
      const { getGenerationStats } = await import("./api");
      fetchMock.mockResolvedValue(
        mockResponse({ json: jest.fn().mockResolvedValue({ totalGenerations: 1 }) }),
      );

      await getGenerationStats();

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/generation-stats",
        expect.any(Object),
      );
    });
  });

  describe("authentication calls", () => {
    it("includes a Bearer authorization header when a token is provided", async () => {
      const { generateMidiPack } = await import("./api");
      fetchMock.mockResolvedValue(
        mockResponse({
          json: jest.fn().mockResolvedValue({ downloadUrl: "x", totalGenerations: 2 }),
        }),
      );

      await generateMidiPack("abc123");

      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers).toEqual({ Authorization: "Bearer abc123" });
    });

    it("omits the authorization header when no token is provided", async () => {
      const { generateMidiPack } = await import("./api");
      fetchMock.mockResolvedValue(
        mockResponse({
          json: jest.fn().mockResolvedValue({ downloadUrl: "x", totalGenerations: 2 }),
        }),
      );

      await generateMidiPack(null);

      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers).toEqual({});
    });

    it("sends JSON content-type and body for loginUser", async () => {
      const { loginUser } = await import("./api");
      fetchMock.mockResolvedValue(mockResponse());

      await loginUser({ email: "a@b.com", password: "pw" });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("http://localhost:8081/auth/login");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
      expect(init.body).toBe(JSON.stringify({ email: "a@b.com", password: "pw" }));
    });

    it("authUser dispatches to registerUser in register mode", async () => {
      const { authUser } = await import("./api");
      fetchMock.mockResolvedValue(mockResponse());

      await authUser("register", { username: "u", email: "a@b.com", password: "pw" });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe("http://localhost:8081/auth/register");
    });

    it("authUser dispatches to loginUser in login mode", async () => {
      const { authUser } = await import("./api");
      fetchMock.mockResolvedValue(mockResponse());

      await authUser("login", { email: "a@b.com", password: "pw" });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe("http://localhost:8081/auth/login");
    });

    it("builds a backend MIDI preview URL for public upload visualization", async () => {
      const { getPublicUploadMidiPreviewUrl } = await import("./api");

      expect(getPublicUploadMidiPreviewUrl(42)).toBe(
        "http://localhost:8081/uploads/projects/42/midi",
      );
    });
  });

  describe("error handling and response parsing", () => {
    it("resolves parsed JSON when getGenerationStats succeeds", async () => {
      const { getGenerationStats } = await import("./api");
      fetchMock.mockResolvedValue(
        mockResponse({ json: jest.fn().mockResolvedValue({ totalGenerations: 42 }) }),
      );

      await expect(getGenerationStats()).resolves.toEqual({ totalGenerations: 42 });
    });

    it("throws HTTP_<status>: <body> when getGenerationStats response is not ok", async () => {
      const { getGenerationStats } = await import("./api");
      fetchMock.mockResolvedValue(
        mockResponse({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: jest.fn().mockResolvedValue("boom"),
        }),
      );

      await expect(getGenerationStats()).rejects.toThrow("HTTP_500: boom");
    });

    it("falls back to statusText when the error body is empty", async () => {
      const { getGenerationStats } = await import("./api");
      fetchMock.mockResolvedValue(
        mockResponse({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          text: jest.fn().mockResolvedValue(""),
        }),
      );

      await expect(getGenerationStats()).rejects.toThrow("HTTP_503: Service Unavailable");
    });

    it("throws HTTP_<status>: <body> when generateMidiPack response is not ok", async () => {
      const { generateMidiPack } = await import("./api");
      fetchMock.mockResolvedValue(
        mockResponse({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          text: jest.fn().mockResolvedValue("Server is busy"),
        }),
      );

      await expect(generateMidiPack("tok")).rejects.toThrow("HTTP_429: Server is busy");
    });

    it("resolves parsed JSON when generateMidiPack succeeds", async () => {
      const { generateMidiPack } = await import("./api");
      fetchMock.mockResolvedValue(
        mockResponse({
          json: jest.fn().mockResolvedValue({ downloadUrl: "d", totalGenerations: 3 }),
        }),
      );

      await expect(generateMidiPack("tok")).resolves.toEqual({
        downloadUrl: "d",
        totalGenerations: 3,
      });
    });

    it("loginUser resolves the raw Response without throwing on a non-2xx status", async () => {
      const { loginUser } = await import("./api");
      fetchMock.mockResolvedValue(mockResponse({ ok: false, status: 409 }));

      const response = await loginUser({ email: "a@b.com", password: "pw" });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(409);
    });
  });

  describe("timeout and network error handling", () => {
    it("attaches an AbortSignal to every request", async () => {
      const { getGenerationStats } = await import("./api");
      fetchMock.mockResolvedValue(
        mockResponse({ json: jest.fn().mockResolvedValue({ totalGenerations: 0 }) }),
      );

      await getGenerationStats();

      const [, init] = fetchMock.mock.calls[0];
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it("combines a caller-provided signal with the request timeout", async () => {
      const { getGenerationStats } = await import("./api");
      fetchMock.mockResolvedValue(
        mockResponse({ json: jest.fn().mockResolvedValue({ totalGenerations: 0 }) }),
      );
      const controller = new AbortController();

      await getGenerationStats(controller.signal);

      const [, init] = fetchMock.mock.calls[0];
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(init.signal).not.toBe(controller.signal);
    });

    it("aborts the request when the caller-provided signal is aborted", async () => {
      const { getGenerationStats } = await import("./api");
      const controller = new AbortController();
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      );

      const promise = getGenerationStats(controller.signal);
      controller.abort();

      await expect(promise).rejects.toThrow("Aborted");
    });

    it("propagates a network error from a rejected fetch for getGenerationStats", async () => {
      const { getGenerationStats } = await import("./api");
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(getGenerationStats()).rejects.toThrow("Failed to fetch");
    });

    it("propagates a network error from a rejected fetch for generateMidiPack", async () => {
      const { generateMidiPack } = await import("./api");
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(generateMidiPack("tok")).rejects.toThrow("Failed to fetch");
    });
  });
});
