import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import FeedbackSection from "./FeedbackSection";

function fillMessage(container: HTMLElement, value: string) {
  fireEvent.change(container.querySelector('textarea[name="message"]')!, {
    target: { value },
  });
}

function fillEmail(container: HTMLElement, value: string) {
  fireEvent.change(container.querySelector('input[name="email"]')!, {
    target: { value },
  });
}

function submitForm(container: HTMLElement) {
  fireEvent.submit(container.querySelector("form")!);
}

describe("FeedbackSection", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe("form validation", () => {
    it("rejects a message shorter than 10 characters without calling the API", async () => {
      const { container } = render(<FeedbackSection />);
      fillMessage(container, "too short");
      submitForm(container);

      expect(
        await screen.findByText("Message should be at least 10 characters."),
      ).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects an invalid email format without calling the API", async () => {
      const { container } = render(<FeedbackSection />);
      fillMessage(container, "This message is long enough.");
      fillEmail(container, "not-an-email");
      submitForm(container);

      expect(
        await screen.findByText("Please enter a valid email or leave it empty."),
      ).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("allows submission when the optional name and email are left empty", async () => {
      fetchMock.mockResolvedValue({ ok: true });
      const { container } = render(<FeedbackSection />);
      fillMessage(container, "This message is long enough.");
      submitForm(container);

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    });
  });

  describe("honeypot field protection", () => {
    it("silently drops the submission when the hidden company field is filled", async () => {
      const { container } = render(<FeedbackSection />);
      fillMessage(container, "This message is long enough.");
      fireEvent.change(container.querySelector('input[name="company"]')!, {
        target: { value: "I am a bot" },
      });
      submitForm(container);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.queryByText("Thanks for helping improve IcePunk.")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Feedback could not be sent right now. Try again soon."),
      ).not.toBeInTheDocument();
    });
  });

  describe("successful form submission", () => {
    it("posts the form fields to /api/contact and shows the success message", async () => {
      fetchMock.mockResolvedValue({ ok: true });
      const { container } = render(<FeedbackSection />);

      fireEvent.change(container.querySelector('input[name="name"]')!, {
        target: { value: "Ada" },
      });
      fillEmail(container, "ada@example.com");
      fireEvent.change(container.querySelector('select[name="feedbackType"]')!, {
        target: { value: "Bug Report" },
      });
      fillMessage(container, "Something is broken in the generator.");
      submitForm(container);

      expect(await screen.findByText("Thanks for helping improve IcePunk.")).toBeInTheDocument();

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/contact",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Ada",
            email: "ada@example.com",
            feedbackType: "Bug Report",
            message: "Something is broken in the generator.",
          }),
        }),
      );
    });
  });

  describe("error handling when the request fails", () => {
    it("shows an error message when the API responds with a non-ok status", async () => {
      fetchMock.mockResolvedValue({ ok: false });
      const { container } = render(<FeedbackSection />);
      fillMessage(container, "This message is long enough.");
      submitForm(container);

      expect(
        await screen.findByText("Feedback could not be sent right now. Try again soon."),
      ).toBeInTheDocument();
    });

    it("shows an error message when the network request throws", async () => {
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
      const { container } = render(<FeedbackSection />);
      fillMessage(container, "This message is long enough.");
      submitForm(container);

      expect(
        await screen.findByText("Feedback could not be sent right now. Try again soon."),
      ).toBeInTheDocument();
    });
  });

  describe("success/error message display", () => {
    it("clears a previous error message once a corrected submission succeeds", async () => {
      const { container } = render(<FeedbackSection />);
      fillMessage(container, "too short");
      submitForm(container);

      expect(
        await screen.findByText("Message should be at least 10 characters."),
      ).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();

      fetchMock.mockResolvedValueOnce({ ok: true });
      fillMessage(container, "This message is long enough now.");
      submitForm(container);

      expect(await screen.findByText("Thanks for helping improve IcePunk.")).toBeInTheDocument();
      expect(
        screen.queryByText("Message should be at least 10 characters."),
      ).not.toBeInTheDocument();
    });

    it("shows a sending indicator while the request is in flight", async () => {
      let resolveFetch!: (value: { ok: boolean }) => void;
      fetchMock.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );

      const { container } = render(<FeedbackSection />);
      fillMessage(container, "This message is long enough.");
      submitForm(container);

      expect(await screen.findByText("Sending...")).toBeInTheDocument();

      resolveFetch({ ok: true });

      expect(await screen.findByText("Thanks for helping improve IcePunk.")).toBeInTheDocument();
    });
  });
});
