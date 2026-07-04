"use client";

import { useEffect, useState } from "react";
import {
  AVATAR_RING_OPTIONS,
  getProfileSettings,
  UserCustomSettings,
} from "@/lib/profileStore";

type UserAvatarProps = {
  username: string;
  sizeClassName?: string;
};

export default function UserAvatar({
  username,
  sizeClassName = "h-8 w-8 text-xs",
}: UserAvatarProps) {
  const [settings, setSettings] = useState<UserCustomSettings>(() =>
    getProfileSettings(username),
  );

  useEffect(() => {
    setSettings(getProfileSettings(username));

    const handleProfileUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        username: string;
        updated: UserCustomSettings;
      }>;
      if (customEvent.detail?.username?.toLowerCase() === username.toLowerCase()) {
        setSettings(customEvent.detail.updated);
      }
    };

    window.addEventListener("icepunk-profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("icepunk-profile-updated", handleProfileUpdate);
    };
  }, [username]);

  const currentRing =
    AVATAR_RING_OPTIONS.find((opt) => opt.id === settings.auraRingId) ??
    AVATAR_RING_OPTIONS[0];

  const letter = username ? username.slice(0, 1).toUpperCase() : "G";

  return (
    <div
      aria-hidden="true"
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-[color:var(--ice-accent-soft)] font-bold text-[color:var(--ice-accent-text)] ring-2 transition-all duration-300 ${sizeClassName} ${currentRing.shadow}`}
      style={{ borderColor: currentRing.color }}
    >
      {settings.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`${username}'s avatar`}
          className="h-full w-full object-cover"
          src={settings.avatarUrl}
        />
      ) : (
        letter
      )}
    </div>
  );
}
