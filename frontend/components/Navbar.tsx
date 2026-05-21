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
    <nav className="relative z-20 flex items-center justify-between px-6 py-5">
      <div className="font-black tracking-[0.35em] text-cyan-200">iCEPUNK</div>

      <div className="flex gap-3">
        {isLoggedIn ? (
          <button
            onClick={onLogoutClick}
            className="rounded-full border border-cyan-300/30 px-5 py-2 text-sm text-cyan-100 hover:bg-cyan-300/10"
          >
            Logout
          </button>
        ) : (
          <>
            <button
              onClick={onLoginClick}
              className="rounded-full border border-cyan-300/30 px-5 py-2 text-sm text-cyan-100 hover:bg-cyan-300/10"
            >
              Login
            </button>

            <button
              onClick={onRegisterClick}
              className="rounded-full bg-cyan-300 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-white"
            >
              Sign up
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
