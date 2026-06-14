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
    <nav className="fixed left-0 top-0 z-30 flex w-full items-center justify-between px-8 py-7 md:px-14">
      <div className="bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-sm font-black tracking-[0.42em] text-transparent">
        iCEPUNK
      </div>

      <div className="flex items-center gap-4">
        {isLoggedIn ? (
          <button
            onClick={onLogoutClick}
            className="text-sm font-semibold text-white/75 transition hover:text-white active:scale-95"
          >
            Logout
          </button>
        ) : (
          <>
            <button
              onClick={onLoginClick}
              className="text-sm font-semibold text-white/75 transition hover:text-white active:scale-95"
            >
              Login
            </button>

            <button
              onClick={onRegisterClick}
              className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 shadow-[0_10px_35px_rgba(255,255,255,0.12)] transition hover:scale-105 hover:bg-cyan-50 active:scale-95"
            >
              Sign up
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
