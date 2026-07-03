"use client";

import { FormEvent, useState } from "react";
import { Badge, Button, FieldLabel, Input, Select, Textarea } from "@/components/ui";

type FeedbackStatus = null | "success" | "error";

const feedbackTypes = [
  "Bug Report",
  "Feature Request",
  "Idea",
  "Other",
] as const;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function FeedbackSection() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<FeedbackStatus>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const feedbackType = String(formData.get("feedbackType") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();

    setStatus(null);
    setErrorMessage("");

    if (formData.get("company")) {
      return;
    }

    if (email && !isValidEmail(email)) {
      setStatus("error");
      setErrorMessage("Please enter a valid email or leave it empty.");
      return;
    }

    if (!feedbackTypes.includes(feedbackType as (typeof feedbackTypes)[number])) {
      setStatus("error");
      setErrorMessage("Choose a feedback type.");
      return;
    }

    if (message.length < 10) {
      setStatus("error");
      setErrorMessage("Message should be at least 10 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          feedbackType,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
      setErrorMessage("Feedback could not be sent right now. Try again soon.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative z-10 px-6 pb-24 pt-4 md:pt-8" id="feedback">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
        <div className="relative overflow-hidden rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-[color:var(--ice-surface)] p-8 shadow-[var(--ice-shadow-card)] backdrop-blur-xl md:p-10">
          <div className="relative">
            <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--ice-accent-border)] bg-[color:var(--ice-accent-soft)]">
              <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--ice-accent)]" />
            </div>

            <Badge className="mb-4" tone="accent">Community signal</Badge>

            <h2 className="max-w-xl text-4xl font-medium leading-tight tracking-[-0.01em] text-ice-primary md:text-5xl">
              Help Shape IcePunk
            </h2>

            <p className="mt-6 max-w-lg text-base leading-7 text-ice-secondary">
              Have an idea, found a bug, or want a new feature? Send your
              feedback and help improve the generator.
            </p>

            <div className="mt-10 grid gap-3 text-sm text-ice-secondary sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-xl border border-white/[0.08] bg-black/10 px-4 py-3">
                Product ideas
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/10 px-4 py-3">
                Generator bugs
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/10 px-4 py-3">
                Sound requests
              </div>
            </div>
          </div>
        </div>

        <form
          aria-live="polite"
          className="relative overflow-hidden rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-[color:var(--ice-surface)] p-5 shadow-[var(--ice-shadow-card)] backdrop-blur-2xl md:p-7"
          onSubmit={handleSubmit}
        >
          <div className="relative grid gap-4">
            <input
              autoComplete="off"
              className="hidden"
              name="company"
              tabIndex={-1}
              type="text"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel>
                Name <span className="font-normal text-ice-muted">(optional)</span>
                <Input
                  autoComplete="name"
                  className="h-14 text-base"
                  name="name"
                  placeholder="Your name"
                />
              </FieldLabel>

              <FieldLabel>
                Email <span className="font-normal text-ice-muted">(optional)</span>
                <Input
                  autoComplete="email"
                  className="h-14 text-base"
                  name="email"
                  placeholder="you@example.com"
                  type="email"
                />
              </FieldLabel>
            </div>

            <FieldLabel>
              Feedback Type
              <Select className="h-14 text-base" defaultValue="Idea" name="feedbackType">
                {feedbackTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </FieldLabel>

            <FieldLabel>
              Message
              <Textarea
                className="min-h-40 text-base leading-7"
                minLength={10}
                name="message"
                placeholder="Tell us what should be colder, sharper, or easier to use."
                required
                rows={6}
              />
            </FieldLabel>

            <Button
              className="mt-2 w-full"
              disabled={loading}
              size="lg"
              type="submit"
              variant="primary"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
              )}
              {loading ? "Sending..." : "Send Feedback"}
            </Button>

            {status === "success" && (
              <p className="rounded-xl border border-[color:var(--ice-success)]/25 bg-[color:var(--ice-success)]/10 px-4 py-3 text-center text-sm font-medium text-[color:var(--ice-success)]">
                Thanks for helping improve IcePunk.
              </p>
            )}

            {status === "error" && (
              <p className="rounded-xl border border-[color:var(--ice-error)]/25 bg-[color:var(--ice-error)]/10 px-4 py-3 text-center text-sm font-medium text-[color:var(--ice-error)]">
                {errorMessage || "Feedback could not be sent right now."}
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
