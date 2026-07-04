"use client";

import Link from "next/link";
import { Badge, Button, UserAvatar } from "@/components/ui";
import type { AuthMode } from "./useSketchAuth";
import type { GenerationUsageResponse, MeResponse } from "@/lib/api";

type SketchTopNavProps = {
  handleLogout: () => void;
  me: MeResponse | null;
  setAuthMode: (mode: AuthMode) => void;
  setAuthStatus: (message: string) => void;
  token: string | null;
  usage: GenerationUsageResponse | null;
};

export default function SketchTopNav({
  handleLogout,
  me,
  setAuthMode,
  setAuthStatus,
  token,
  usage,
}: SketchTopNavProps) {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-4">
      <Link
        className="text-sm font-bold tracking-[0.04em] text-white outline-none transition-colors duration-150 ease-out hover:text-ice-accent focus-visible:ring-2 focus-visible:ring-[rgba(100,120,255,0.45)]"
        href="/"
      >
        iCEPUNK
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        {!token ? (
          <Badge
            title={
              usage
                ? `${usage.used} of ${usage.limit} used today`
                : undefined
            }
            tone="accent"
          >
            {usage
              ? `${Math.max(0, usage.limit - usage.used)} left today`
              : "5/day"}
          </Badge>
        ) : null}

        {me ? (
          <Link
            className="flex items-center gap-2 text-sm font-medium text-ice-primary outline-none transition-colors duration-150 ease-out hover:text-white focus-visible:ring-2 focus-visible:ring-[rgba(100,120,255,0.45)]"
            href={`/u/${encodeURIComponent(me.username)}`}
          >
            <UserAvatar sizeClassName="h-7 w-7 text-xs" username={me.username} />
            {me.username}
          </Link>
        ) : (
          <span className="text-sm text-ice-muted">guest</span>
        )}

        <div className="flex flex-wrap gap-2">
          {token ? (
            <Button onClick={handleLogout} size="sm" type="button">
              Logout
            </Button>
          ) : (
            <>
              <Button
                onClick={() => {
                  setAuthStatus("");
                  setAuthMode("login");
                }}
                size="sm"
                type="button"
              >
                Login
              </Button>
              <Button
                onClick={() => {
                  setAuthStatus("");
                  setAuthMode("register");
                }}
                size="sm"
                type="button"
                variant="primary"
              >
                Sign up
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
