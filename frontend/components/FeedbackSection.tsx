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
    <section id="feedback" className="relative z-10 px-6 pb-24 pt-4 md:pt-8">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
        <div
          className="relative overflow-hidden rounded-[2rem] border border-cyan-100/15 bg-white/[0.035] p-8 shadow-[0_24px_90px_rgba(8,47,73,0.28)] backdrop-blur-xl md:p-10"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(56,189,248,0.035),rgba(255,255,255,0.02))]" />

          <div className="relative">
            <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-100/20 bg-cyan-100/10 text-cyan-100 shadow-[0_0_42px_rgba(125,211,252,0.18)]">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-100 shadow-[0_0_24px_rgba(125,211,252,0.95)]" />
            </div>

            <Badge className="mb-4" tone="accent">Community signal</Badge>

            <h2 className="max-w-xl bg-gradient-to-b from-white via-cyan-50 to-cyan-300 bg-clip-text text-4xl font-extrabold leading-tight text-transparent md:text-5xl">
              Help Shape IcePunk
            </h2>

            <p className="mt-6 max-w-lg text-base leading-7 text-slate-300/80">
              Have an idea, found a bug, or want a new feature? Send your
              feedback and help improve the generator.
            </p>

            <div className="mt-10 grid gap-3 text-sm text-slate-300/75 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 backdrop-blur">
                Product ideas
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 backdrop-blur">
                Generator bugs
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 backdrop-blur">
                Sound requests
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="relative overflow-hidden rounded-[2rem] border border-cyan-100/15 bg-slate-950/45 p-5 shadow-[0_24px_90px_rgba(8,47,73,0.26)] backdrop-blur-2xl md:p-7"
          aria-live="polite"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,252,0.12),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(2,6,23,0.06))]" />

          <div className="relative grid gap-4">
            <input
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FieldLabel>
                Name <span className="font-normal text-slate-400">(optional)</span>
                <Input
                  name="name"
                  autoComplete="name"
                  placeholder="Your name"
                  className="h-14 text-base"
                />
              </FieldLabel>

              <FieldLabel>
                Email <span className="font-normal text-slate-400">(optional)</span>
                <Input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-14 text-base"
                />
              </FieldLabel>
            </div>

            <FieldLabel>
              Feedback Type
              <Select
                name="feedbackType"
                defaultValue="Idea"
                className="h-14 text-base"
              >
                {feedbackTypes.map((type) => (
                  <option key={type} value={type} className="bg-slate-950">
                    {type}
                  </option>
                ))}
              </Select>
            </FieldLabel>

            <FieldLabel>
              Message
              <Textarea
                name="message"
                required
                minLength={10}
                rows={6}
                placeholder="Tell us what should be colder, sharper, or easier to use."
                className="min-h-40 text-base leading-7"
              />
            </FieldLabel>

            <Button
              type="submit"
              disabled={loading}
              variant="primary"
              size="lg"
              className="mt-2 w-full overflow-hidden font-black"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/25 border-t-slate-950" />
              )}
              {loading ? "Sending..." : "Send Feedback"}
            </Button>

            {status === "success" && (
              <p className="rounded-2xl border border-cyan-200/20 bg-cyan-200/10 px-4 py-3 text-center text-sm font-semibold text-cyan-50">
                Thanks for helping improve IcePunk.
              </p>
            )}

            {status === "error" && (
              <p className="rounded-2xl border border-rose-200/20 bg-rose-300/10 px-4 py-3 text-center text-sm font-semibold text-rose-100">
                {errorMessage || "Feedback could not be sent right now."}
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
