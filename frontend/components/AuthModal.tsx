import { Button, FieldLabel, Input } from "@/components/ui";

type AuthMode = "login" | "register";

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
  onSubmit: () => void;
  onClose: () => void;
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
}: AuthModalProps) {
  return (
    <div
      aria-labelledby="auth-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-6 backdrop-blur-xl"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-[var(--ice-radius-card)] border border-white/[0.08] bg-[#0c0c16] p-8 shadow-[var(--ice-shadow-card)] backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.01em] text-ice-primary" id="auth-modal-title">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p className="mt-2 text-sm text-ice-secondary">
              {mode === "login"
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

        <div className="mt-7 grid gap-4">
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
              type="password"
              value={password}
            />
          </FieldLabel>

          <Button
            className="mt-2 w-full"
            disabled={isSubmitting}
            onClick={onSubmit}
            size="lg"
            type="button"
            variant="primary"
          >
            {isSubmitting ? "Please wait..." : mode === "login" ? "Login" : "Register"}
          </Button>

          {authStatus && (
            <p className="rounded-xl border border-[color:var(--ice-accent-border)] bg-[color:var(--ice-accent-soft)] px-4 py-3 text-center text-sm text-[color:var(--ice-accent-text)]">
              {authStatus}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
