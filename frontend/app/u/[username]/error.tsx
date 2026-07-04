"use client";

import Link from "next/link";
import { Button, Panel } from "@/components/ui";

export default function ProfileError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center p-6 text-center">
      <Panel className="grid w-full gap-4 p-6 border border-white/10 bg-[#0b0f19] shadow-2xl rounded-2xl">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/5 text-ice-accent border border-white/10">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Profile Unavailable</h2>
        <p className="text-sm text-ice-secondary">
          Could not load this user profile right now. The user might not exist or the backend is unreachable.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button onClick={() => reset()} type="button" variant="primary">
            Try Again
          </Button>
          <Link
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            href="/"
          >
            Go Home
          </Link>
        </div>
      </Panel>
    </main>
  );
}
