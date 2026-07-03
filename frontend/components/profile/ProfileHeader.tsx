import { UserProfileResponse } from "@/lib/api";
import { Badge } from "@/components/ui";

type ProfileHeaderProps = {
  profile: UserProfileResponse;
};

export default function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <header className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
      <div
        aria-hidden="true"
        className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[color:var(--ice-accent-soft)] text-3xl font-semibold text-[color:var(--ice-accent-text)] ring-1 ring-[color:var(--ice-accent-border)]"
      >
        {profile.username.slice(0, 1).toUpperCase()}
      </div>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ice-primary">
            {profile.username}
          </h1>
          {profile.verified ? (
            <Badge tone="success">
              <svg
                aria-hidden="true"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Verified
            </Badge>
          ) : null}
        </div>

        {profile.bio ? (
          <p className="max-w-xl text-sm leading-6 text-ice-secondary">{profile.bio}</p>
        ) : null}
      </div>
    </header>
  );
}
