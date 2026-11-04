"use client";

import { FormEvent, useState } from "react";

type State = "idle" | "sending" | "sent" | "error";

export default function ImpressumContactForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<State>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;
    setState("sending");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, feedbackType: "Other", message }),
      });
      if (!response.ok) throw new Error("CONTACT_REQUEST_FAILED");
      setMessage("");
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return <section aria-labelledby="impressum-contact-title" className="rounded-2xl border border-[color:var(--ice-border)] bg-[color:var(--ice-surface)] p-5">
    <h2 className="text-lg text-ice-primary" id="impressum-contact-title">Schneller Kontakt</h2>
    <p className="mt-2 text-sm">Sie können uns auch über dieses Formular direkt erreichen.</p>
    {state === "sent" ? <p className="mt-4 text-sm text-[color:var(--ice-success)]" role="status">Nachricht gesendet. Wir melden uns so schnell wie möglich.</p> : <form className="mt-4 grid gap-3" onSubmit={submit}>
      <label className="grid gap-1 text-sm">E-Mail-Adresse<input required autoComplete="email" className="rounded-lg border border-[color:var(--ice-border-strong)] bg-transparent px-3 py-2 text-ice-primary" disabled={state === "sending"} onChange={(event) => setEmail(event.target.value)} type="email" value={email} /></label>
      <label className="grid gap-1 text-sm">Nachricht<textarea required className="min-h-28 rounded-lg border border-[color:var(--ice-border-strong)] bg-transparent px-3 py-2 text-ice-primary" disabled={state === "sending"} maxLength={5000} minLength={10} onChange={(event) => setMessage(event.target.value)} value={message} /></label>
      <button className="w-fit rounded-full bg-[color:var(--ice-accent)] px-5 py-2 font-medium text-[#06111b] disabled:opacity-60" disabled={state === "sending"} type="submit">{state === "sending" ? "Wird gesendet…" : "Nachricht senden"}</button>
      {state === "error" ? <p className="text-sm text-[color:var(--ice-error)]" role="alert">Die Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es später erneut oder schreiben Sie eine E-Mail.</p> : null}
    </form>}
  </section>;
}
