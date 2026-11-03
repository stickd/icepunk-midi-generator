/**
 * @jest-environment node
 */
import { POST } from "./route";

const ORIGINAL_ENV = { ...process.env };

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  name: "Ada",
  email: "ada@example.com",
  feedbackType: "Bug Report",
  message: "Something is broken in the generator.",
};

describe("POST /api/contact", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.RESEND_API_KEY = "resend-key";
    process.env.FEEDBACK_TO_EMAIL = "team@icepunk.dev";
    process.env.FEEDBACK_FROM_EMAIL = "noreply@icepunk.dev";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe("form validation", () => {
    it("rejects a name longer than 100 characters", async () => {
      const response = await POST(makeRequest({ ...validPayload, name: "a".repeat(101) }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Name is too long." });
    });

    it("rejects an email longer than 254 characters", async () => {
      const longEmail = `${"a".repeat(250)}@a.com`;
      const response = await POST(makeRequest({ ...validPayload, email: longEmail }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Email is too long." });
    });

    it("rejects an invalid email format", async () => {
      const response = await POST(makeRequest({ ...validPayload, email: "not-an-email" }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid email." });
    });

    it("rejects a feedback type outside the allowed set", async () => {
      const response = await POST(makeRequest({ ...validPayload, feedbackType: "Complaint" }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid feedback type." });
    });

    it("rejects a message shorter than 10 characters", async () => {
      const response = await POST(makeRequest({ ...validPayload, message: "short" }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Message should be at least 10 characters.",
      });
    });

    it("rejects a message longer than 5000 characters", async () => {
      const response = await POST(
        makeRequest({ ...validPayload, message: "a".repeat(5001) }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Message should be 5000 characters or less.",
      });
    });

    it("does not call Resend when validation fails", async () => {
      await POST(makeRequest({ ...validPayload, message: "short" }));
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("successful submission via Resend", () => {
    it("sends the email through Resend and returns success", async () => {
      fetchMock.mockResolvedValue({ ok: true });

      const response = await POST(makeRequest(validPayload));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer resend-key",
            "Content-Type": "application/json",
          },
        }),
      );

      const [, options] = fetchMock.mock.calls[0];
      const sentBody = JSON.parse(options.body);
      expect(sentBody.from).toBe("noreply@icepunk.dev");
      expect(sentBody.to).toEqual(["team@icepunk.dev"]);
      expect(sentBody.subject).toBe("IcePunk feedback: Bug Report");
      expect(sentBody.reply_to).toBe("ada@example.com");
    });

    it("falls back to logging and returns success when Resend is not configured outside production", async () => {
      delete process.env.RESEND_API_KEY;
      Object.assign(process.env, { NODE_ENV: "test" });

      const response = await POST(makeRequest(validPayload));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("error handling when Resend fails", () => {
    it("returns 502 when Resend responds with a non-ok status", async () => {
      fetchMock.mockResolvedValue({ ok: false, text: jest.fn().mockResolvedValue("bad request") });

      const response = await POST(makeRequest(validPayload));

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: "Feedback could not be sent." });
    });

    it("returns 500 when the Resend request throws", async () => {
      fetchMock.mockRejectedValue(new Error("network down"));

      const response = await POST(makeRequest(validPayload));

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Feedback could not be sent." });
    });

    it("returns 500 when Resend env vars are missing in production", async () => {
      delete process.env.RESEND_API_KEY;
      Object.assign(process.env, { NODE_ENV: "production" });

      const response = await POST(makeRequest(validPayload));

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Feedback email is not configured." });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns 500 when the request body is not valid JSON", async () => {
      const badRequest = new Request("http://localhost/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });

      const response = await POST(badRequest);

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Feedback could not be sent." });
    });
  });

  describe("data sanitization", () => {
    it("escapes HTML in the name and message before sending to Resend", async () => {
      fetchMock.mockResolvedValue({ ok: true });

      await POST(
        makeRequest({
          ...validPayload,
          name: '<script>alert("x")</script>',
          message: "Line one <b>bold</b> & 'quoted'\nLine two",
        }),
      );

      const [, options] = fetchMock.mock.calls[0];
      const sentBody = JSON.parse(options.body);

      expect(sentBody.html).not.toContain("<script>");
      expect(sentBody.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
      expect(sentBody.html).toContain("Line one &lt;b&gt;bold&lt;/b&gt; &amp; &#39;quoted&#39;");
      expect(sentBody.html).toContain("<br />");
    });

    it("trims whitespace from all fields before validation and sending", async () => {
      fetchMock.mockResolvedValue({ ok: true });

      const response = await POST(
        makeRequest({
          name: "  Ada  ",
          email: "  ada@example.com  ",
          feedbackType: "  Bug Report  ",
          message: "  Something is broken in the generator.  ",
        }),
      );

      expect(response.status).toBe(200);
      const [, options] = fetchMock.mock.calls[0];
      const sentBody = JSON.parse(options.body);
      expect(sentBody.html).toContain("<strong>Name:</strong> Ada<");
      expect(sentBody.reply_to).toBe("ada@example.com");
    });
  });
});
