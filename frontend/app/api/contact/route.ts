const feedbackTypes = new Set([
  "Bug Report",
  "Feature Request",
  "Idea",
  "Other",
]);

type FeedbackPayload = {
  name?: unknown;
  email?: unknown;
  feedbackType?: unknown;
  message?: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as FeedbackPayload;

    const name = clean(body.name);
    const email = clean(body.email);
    const feedbackType = clean(body.feedbackType);
    const message = clean(body.message);

    if (name.length > 100) {
      return Response.json({ error: "Name is too long." }, { status: 400 });
    }

    if (email.length > 254) {
      return Response.json({ error: "Email is too long." }, { status: 400 });
    }

    if (email && !isValidEmail(email)) {
      return Response.json({ error: "Invalid email." }, { status: 400 });
    }

    if (!feedbackTypes.has(feedbackType)) {
      return Response.json({ error: "Invalid feedback type." }, { status: 400 });
    }

    if (message.length < 10) {
      return Response.json(
        { error: "Message should be at least 10 characters." },
        { status: 400 },
      );
    }

    if (message.length > 5000) {
      return Response.json(
        { error: "Message should be 5000 characters or less." },
        { status: 400 },
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.FEEDBACK_TO_EMAIL;
    const fromEmail = process.env.FEEDBACK_FROM_EMAIL;

    if (!resendApiKey && process.env.NODE_ENV !== "production") {
      console.info("IcePunk feedback received:", {
        name,
        email,
        feedbackType,
        message,
      });

      return Response.json({ success: true });
    }

    if (!resendApiKey || !toEmail || !fromEmail) {
      console.error("Feedback email env is not configured.");

      return Response.json(
        { error: "Feedback email is not configured." },
        { status: 500 },
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: `IcePunk feedback: ${feedbackType}`,
        reply_to: email || undefined,
        html: `
          <h2>IcePunk feedback</h2>
          <p><strong>Type:</strong> ${escapeHtml(feedbackType)}</p>
          <p><strong>Name:</strong> ${escapeHtml(name || "Anonymous")}</p>
          <p><strong>Email:</strong> ${escapeHtml(email || "Not provided")}</p>
          <p><strong>Message:</strong></p>
          <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Error sending IcePunk feedback:", error);

      return Response.json(
        { error: "Feedback could not be sent." },
        { status: 502 },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error handling IcePunk feedback:", error);

    return Response.json(
      { error: "Feedback could not be sent." },
      { status: 500 },
    );
  }
}
