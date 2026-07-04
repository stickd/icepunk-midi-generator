"use client";

import { Button } from "@/components/ui";

type GuestLimitModalProps = {
  onClose: () => void;
  onLogin: () => void;
  onSignUp: () => void;
};

export default function GuestLimitModal({
  onClose,
  onLogin,
  onSignUp,
}: GuestLimitModalProps) {
  return (
    <div
      aria-labelledby="guest-limit-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-xl"
      role="dialog"
    >
      <section className="w-full max-w-md rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-[#0c0c16] p-8 shadow-[var(--ice-shadow-card)] backdrop-blur-2xl">
        <h2
          className="text-2xl font-semibold tracking-[-0.01em] text-ice-primary"
          id="guest-limit-title"
        >
          Free guest limit reached
        </h2>
        <p className="mt-2 text-sm text-ice-secondary">
          Create a free account to generate unlimited MIDI packs.
        </p>
        <div className="mt-7 flex flex-wrap justify-end gap-2">
          <Button
            onClick={onSignUp}
            type="button"
            variant="primary"
          >
            Sign up
          </Button>
          <Button
            onClick={onLogin}
            type="button"
          >
            Log in
          </Button>
          <Button
            onClick={onClose}
            type="button"
          >
            Close
          </Button>
        </div>
      </section>
    </div>
  );
}
