import { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--ice-bg)] text-ice-primary">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(94,234,212,0.12),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(34,211,238,0.08),transparent_28%),linear-gradient(180deg,#09090B_0%,#0B1017_48%,#09090B_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.014)_1px,transparent_1px)] bg-[size:72px_72px] opacity-35" />
      <div className="relative z-10">{children}</div>
    </main>
  );
}
