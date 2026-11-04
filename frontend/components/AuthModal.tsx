import { Button, FieldLabel, Input } from "@/components/ui";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import Link from "next/link";
import { useState } from "react";

type AuthMode = "login" | "register" | "verify";
type RegistrationAcceptance = { termsAccepted: true; ageConfirmed: true };

type AuthModalProps = {
  mode: AuthMode;
  email: string;
  username: string;
  password: string;
  authStatus: string;
  isSubmitting?: boolean;
  setEmail: (value: string) => void;
  setUsername: (value: string) => void;
  setPassword: (value: string) => void;
  onSubmit: (acceptance?: RegistrationAcceptance) => void;
  onClose: () => void;
  onResend?: () => void;
};

export default function AuthModal({
  mode,
  email,
  username,
  password,
  authStatus,
  isSubmitting = false,
  setEmail,
  setUsername,
  setPassword,
  onSubmit,
  onClose,
  onResend,
}: AuthModalProps) {
  const dialogRef = useDialogFocus(onClose);
  const [termsAccepted, setTermsAccepted] = useState(false);
  return (
    <div
      ref={(element) => { dialogRef.current = element; }}
      tabIndex={-1}
      aria-labelledby="auth-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-6 backdrop-blur-xl"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-[#0c0c16] p-8 shadow-[var(--ice-shadow-card)] backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.01em] text-ice-primary" id="auth-modal-title">
              {mode === "login" ? "Welcome back" : mode === "verify" ? "Check your email" : "Create account"}
            </h2>
            <p className="mt-2 text-sm text-ice-secondary">
              {mode === "verify" ? "If your account needs verification, open the link in your email, then log in to continue."
                : mode === "login"
                ? "Login to generate your next MIDI pack."
                : "Start generating cold melodic ideas."}
            </p>
          </div>

          <button
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ice-secondary transition-colors duration-150 ease-out hover:bg-white/[0.08] hover:text-ice-primary"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        {mode === "verify" ? <div className="mt-7 grid gap-4">
          <p className="text-sm text-ice-secondary">Use the email address entered during registration.</p>
          <Button className="w-full" disabled={isSubmitting} onClick={onResend} size="lg" type="button" variant="primary">{isSubmitting ? "Please wait..." : "Resend verification email"}</Button>
          {authStatus && <p className="rounded-xl border border-[color:var(--ice-accent-border)] bg-[color:var(--ice-accent-soft)] px-4 py-3 text-center text-sm text-[color:var(--ice-accent-text)]">{authStatus}</p>}
        </div> : <form className="mt-7 grid gap-4" onSubmit={(event) => { event.preventDefault(); if (!isSubmitting && (mode !== "register" || termsAccepted)) onSubmit(mode === "register" ? { termsAccepted: true, ageConfirmed: true } : undefined); }}>
          {mode === "register" && (
            <FieldLabel>
              Username
              <Input
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Username"
                value={username}
              />
            </FieldLabel>
          )}

          <FieldLabel>
            {mode === "login" ? "Email or Username" : "Email"}
            <Input
              onChange={(event) => setEmail(event.target.value)}
              placeholder={mode === "login" ? "Email or Username" : "Email"}
              value={email}
            />
          </FieldLabel>

          <FieldLabel>
            Password
            <Input
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              minLength={mode === "register" ? 12 : undefined}
              type="password"
              value={password}
            />
          </FieldLabel>

          <Button
            className="mt-2 w-full"
            disabled={isSubmitting || (mode === "register" && !termsAccepted)}
            size="lg"
            type="submit"
            variant="primary"
          >
            {isSubmitting ? "Please wait..." : mode === "login" ? "Login" : "Register"}
          </Button>

          {mode === "register" && <label className="flex gap-2 text-xs text-ice-secondary"><input checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} type="checkbox" />I confirm that I am at least 16 and accept the <Link className="text-[color:var(--ice-accent)]" href="/terms" target="_blank">Terms of Service</Link>. See <Link className="text-[color:var(--ice-accent)]" href="/datenschutz" target="_blank">Privacy Policy</Link>.</label>}

          {authStatus && (
            <p className="rounded-xl border border-[color:var(--ice-accent-border)] bg-[color:var(--ice-accent-soft)] px-4 py-3 text-center text-sm text-[color:var(--ice-accent-text)]">
              {authStatus}
            </p>
          )}
        </form>}
      </div>
    </div>
  );
}
