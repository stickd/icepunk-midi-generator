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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-md rounded-3xl border border-cyan-300/20 bg-slate-950 p-8">
        <h2 className="text-2xl font-black text-cyan-100">
          {mode === "login" ? "Login" : "Create account"}
        </h2>

        <div className="mt-6 flex flex-col gap-4">
          {mode === "register" && (
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="rounded-xl border border-cyan-300/20 bg-slate-900 px-4 py-3 text-white outline-none"
            />
          )}

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded-xl border border-cyan-300/20 bg-slate-900 px-4 py-3 text-white outline-none"
          />

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            className="rounded-xl border border-cyan-300/20 bg-slate-900 px-4 py-3 text-white outline-none"
          />

          <button
            onClick={onSubmit}
            className="rounded-xl bg-cyan-300 px-4 py-3 font-bold text-slate-950 hover:bg-white"
          >
            {mode === "login" ? "Login" : "Register"}
          </button>

          {authStatus && <p className="text-sm text-cyan-200">{authStatus}</p>}

          <button
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
