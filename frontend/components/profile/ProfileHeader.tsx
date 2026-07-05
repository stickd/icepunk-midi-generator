"use client";

import { useEffect, useState } from "react";
import { UserProfileResponse } from "@/lib/api";
import { Badge, Button } from "@/components/ui";
import {
  AVATAR_RING_OPTIONS,
  getProfileSettings,
  UserCustomSettings,
} from "@/lib/profileStore";
import ProfileSettingsModal from "./ProfileSettingsModal";

type ProfileHeaderProps = {
  profile: UserProfileResponse;
  isOwnProfile: boolean;
  token: string | null;
};

export default function ProfileHeader({ profile, isOwnProfile, token }: ProfileHeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile.profilePictureUrl);
  const [customSettings, setCustomSettings] = useState<UserCustomSettings>(() =>
    getProfileSettings(profile.username),
  );
  const [prevUsername, setPrevUsername] = useState(profile.username);
  if (prevUsername !== profile.username) {
    setPrevUsername(profile.username);
    setCustomSettings(getProfileSettings(profile.username));
    setAvatarUrl(profile.profilePictureUrl);
  }

  useEffect(() => {
    const handleProfileUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ username: string; updated: UserCustomSettings }>;
      if (customEvent.detail?.username?.toLowerCase() === profile.username.toLowerCase()) {
        setCustomSettings(customEvent.detail.updated);
      }
    };

    window.addEventListener("icepunk-profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("icepunk-profile-updated", handleProfileUpdate);
    };
  }, [profile.username]);

  const currentRing =
    AVATAR_RING_OPTIONS.find((opt) => opt.id === customSettings.auraRingId) ??
    AVATAR_RING_OPTIONS[0];

  return (
    <>
      <header className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-5">
          {/* Avatar Picture with Glowing Aura Ring */}
          <div
            aria-hidden="true"
            className={`grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-[color:var(--ice-accent-soft)] text-3xl font-semibold text-[color:var(--ice-accent-text)] ring-2 transition-all duration-300 ${currentRing.shadow}`}
            style={{ borderColor: currentRing.color }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={`${profile.username}'s profile picture`}
                className="h-full w-full object-cover"
                src={avatarUrl}
              />
            ) : (
              profile.username.slice(0, 1).toUpperCase()
            )}
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
        </div>

        {isOwnProfile ? (
          <Button
            onClick={() => setIsSettingsOpen(true)}
            size="sm"
            type="button"
            variant="secondary"
          >
            <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 12a3 30 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Settings
          </Button>
        ) : null}
      </header>

      {isOwnProfile ? (
        <ProfileSettingsModal
          currentAvatarUrl={avatarUrl}
          isOpen={isSettingsOpen}
          onAvatarUpdated={setAvatarUrl}
          onClose={() => setIsSettingsOpen(false)}
          onUpdated={(updated) => setCustomSettings(updated)}
          token={token}
          username={profile.username}
        />
      ) : null}
    </>
  );
}
