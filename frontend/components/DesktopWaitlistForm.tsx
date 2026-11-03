"use client";

import { FormEvent, useState } from "react";

type SubmissionState = "idle" | "sending" | "success" | "error";

export default function DesktopWaitlistForm() {
  const [email, setEmail] = useState("");
  const [consented, setConsented] = useState(false);
  const [state, setState] = useState<SubmissionState>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;

    setState("sending");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          feedbackType: "Desktop Waitlist",
          message: "Desktop waitlist signup. Contact consent received.",
        }),
      });

      if (!response.ok) throw new Error("WAITLIST_REQUEST_FAILED");
      setState("success");
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return <p className="desktop-waitlist-success" role="status">You&apos;re on the list. We&apos;ll write when Desktop is ready.</p>;
  }

  return (
    <form className="desktop-waitlist-form" onSubmit={submit}>
      <label className="desktop-waitlist-label" htmlFor="desktop-waitlist-email">Email address</label>
      <div>
        <input
          autoComplete="email"
          disabled={state === "sending"}
          id="desktop-waitlist-email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@email.com"
          required
          type="email"
          value={email}
        />
        <button disabled={state === "sending" || !consented} type="submit">
          {state === "sending" ? "Joining…" : "Join waitlist"}
        </button>
      </div>
      <label className="desktop-waitlist-consent">
        <input checked={consented} onChange={(event) => setConsented(event.target.checked)} required type="checkbox" />
        <span>I agree that iCEPUNK may email me about Desktop. I can ask to be removed at any time.</span>
      </label>
      {state === "error" ? <p className="desktop-waitlist-error" role="alert">Couldn&apos;t join right now. Please try again.</p> : null}
    </form>
  );
}
