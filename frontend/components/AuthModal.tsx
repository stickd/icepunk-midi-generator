type AuthMode = "login" | "register";

type AuthModalProps = {
  mode: AuthMode;
  email: string;
  username: string;
  password: string;
  authStatus: string;
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
  setEmail,
  setUsername,
  setPassword,
  onSubmit,
  onClose,
}: AuthModalProps) {
  const inputClass =
    "rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-200/40 focus:bg-white/[0.09] focus:ring-4 focus:ring-cyan-300/10";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-xl"
    >
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/80 p-8 shadow-[0_0_100px_rgba(103,232,249,0.18)] backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="auth-modal-title" className="text-3xl font-black tracking-tight text-white">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {mode === "login"
                ? "Login to generate your next MIDI pack."
                : "Start generating cold melodic ideas."}
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mt-7 flex flex-col gap-4">
          {mode === "register" && (
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className={inputClass}
            />
          )}

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className={inputClass}
          />

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            className={inputClass}
          />

          <button
            onClick={onSubmit}
            className="mt-2 rounded-2xl bg-white px-4 py-3 font-bold text-slate-950 shadow-[0_0_40px_rgba(103,232,249,0.22)] transition hover:scale-[1.02] hover:bg-cyan-50 active:scale-[0.98]"
          >
            {mode === "login" ? "Login" : "Register"}
          </button>

          {authStatus && (
            <p className="rounded-2xl border border-cyan-300/10 bg-cyan-300/5 px-4 py-3 text-sm text-cyan-100">
              {authStatus}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
