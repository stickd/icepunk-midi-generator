type NavbarProps = {
  isLoggedIn: boolean;
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onLogoutClick: () => void;
};

export default function Navbar({
  isLoggedIn,
  onLoginClick,
  onRegisterClick,
  onLogoutClick,
}: NavbarProps) {
  return (
    <nav className="fixed left-0 top-0 z-30 w-full px-4 py-4 md:px-8">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between rounded-full border border-white/10 bg-[#09090B]/70 px-4 shadow-[0_18px_56px_rgba(0,0,0,0.24)] backdrop-blur-2xl md:px-5">
        <a
          href="#generate"
          className="bg-gradient-to-r from-white via-slate-100 to-cyan-200 bg-clip-text text-sm font-black tracking-[0.36em] text-transparent"
        >
          iCEPUNK
        </a>

        <div className="hidden items-center gap-1 rounded-full border border-white/8 bg-white/[0.035] p-1 md:flex">
          <a
            href="#generate"
            className="rounded-full px-4 py-2 text-sm font-semibold text-ice-secondary transition hover:bg-white/[0.055] hover:text-ice-primary"
          >
            Generate
          </a>
          <a
            href="#upload"
            className="rounded-full px-4 py-2 text-sm font-semibold text-ice-secondary transition hover:bg-white/[0.055] hover:text-ice-primary"
          >
            Upload
          </a>
          <a
            href="#feedback"
            className="rounded-full px-4 py-2 text-sm font-semibold text-ice-secondary transition hover:bg-white/[0.055] hover:text-ice-primary"
          >
            Feedback
          </a>
        </div>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <button
              onClick={onLogoutClick}
              className="rounded-full border border-white/10 bg-white/[0.055] px-4 py-2 text-sm font-semibold text-ice-secondary transition hover:bg-white/[0.08] hover:text-ice-primary active:scale-95"
            >
              Logout
            </button>
          ) : (
            <>
              <button
                onClick={onLoginClick}
                className="rounded-full px-4 py-2 text-sm font-semibold text-ice-secondary transition hover:bg-white/[0.055] hover:text-ice-primary active:scale-95"
              >
                Login
              </button>

              <button
                onClick={onRegisterClick}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-black text-slate-950 shadow-[0_10px_35px_rgba(255,255,255,0.12)] transition hover:-translate-y-0.5 hover:bg-cyan-50 active:translate-y-0 active:scale-95"
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
