"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { verifyEmail } from "@/lib/api";

type State = "loading" | "verified" | "invalid" | "expired" | "already_used" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>(() => token ? "loading" : "invalid");
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    verifyEmail(token).then(async (response) => {
      const body = await response.json().catch(() => null);
      if (response.ok) setState("verified");
      else if (body?.status === "expired") setState("expired");
      else if (body?.status === "already_used") setState("already_used");
      else setState("invalid");
    }).catch(() => setState("error"));
  }, [token]);

  const copy: Record<State, [string, string]> = {
    loading: ["Verifying email", "Securing your ICEPUNK account…"],
    verified: ["Email verified", "Your account is ready. Log in to continue."],
    invalid: ["Invalid link", "This verification link is not valid. Request a new email from the sign-up screen."],
    expired: ["Link expired", "This verification link has expired. Request a fresh email from the sign-up screen."],
    already_used: ["Already verified", "This link was already used. You can log in now."],
    error: ["Unable to verify", "Try again shortly, or request a new verification email."],
  };
  const [title, description] = copy[state];
  return <main className="grid min-h-screen place-items-center bg-[#06111b] px-6 text-ice-primary">
    <section className="w-full max-w-lg rounded-[var(--ice-radius-card)] border border-cyan-100/10 bg-white/[0.045] p-9 shadow-[var(--ice-shadow-card)] backdrop-blur-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">ICEPUNK / ACCOUNT</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">{title}</h1>
      <p className="mt-3 leading-7 text-ice-secondary">{description}</p>
      {state !== "loading" && <Link className="mt-8 inline-flex rounded-xl bg-cyan-400 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-300" href="/">Go to ICEPUNK</Link>}
    </section>
  </main>;
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#06111b] text-ice-primary">Loading…</main>}><VerifyEmailContent /></Suspense>;
}
