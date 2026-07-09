export type ProfileAuraRing = {
  id: string;
  label: string;
  color: string;
  shadow: string;
};

export const AVATAR_RING_OPTIONS: ProfileAuraRing[] = [
  {
    id: "periwinkle",
    label: "Periwinkle",
    color: "#8492ff",
    shadow: "shadow-[0_0_24px_rgba(132,146,255,0.65)] ring-[rgba(132,146,255,0.8)]",
  },
  {
    id: "cyan",
    label: "Ice Cyan",
    color: "#6ee7ff",
    shadow: "shadow-[0_0_24px_rgba(110,231,255,0.65)] ring-[rgba(110,231,255,0.8)]",
  },
  {
    id: "violet",
    label: "Cold Violet",
    color: "#bf8cff",
    shadow: "shadow-[0_0_24px_rgba(191,140,255,0.65)] ring-[rgba(191,140,255,0.8)]",
  },
  {
    id: "emerald",
    label: "Neon Emerald",
    color: "#44eaab",
    shadow: "shadow-[0_0_24px_rgba(68,234,171,0.65)] ring-[rgba(68,234,171,0.8)]",
  },
  {
    id: "ember",
    label: "Ember Gold",
    color: "#ff9e44",
    shadow: "shadow-[0_0_24px_rgba(255,158,68,0.65)] ring-[rgba(255,158,68,0.8)]",
  },
];

export type UserCustomSettings = {
  avatarUrl: string;
  auraRingId: string;
  theme: string;
};

const PROFILE_SETTINGS_PREFIX = "icepunk_profile_settings_";

export function getProfileSettings(username: string): UserCustomSettings {
  if (typeof window === "undefined") {
    return { avatarUrl: "", auraRingId: "periwinkle", theme: "original" };
  }
  try {
    const raw = localStorage.getItem(`${PROFILE_SETTINGS_PREFIX}${username.toLowerCase()}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        avatarUrl: parsed.avatarUrl ?? "",
        auraRingId: parsed.auraRingId ?? "periwinkle",
        theme: parsed.theme ?? "original",
      };
    }
  } catch {
    // Fallback on error
  }
  return { avatarUrl: "", auraRingId: "periwinkle", theme: "original" };
}

export function saveProfileSettings(
  username: string,
  settings: Partial<UserCustomSettings>,
): UserCustomSettings {
  const current = getProfileSettings(username);
  const updated: UserCustomSettings = {
    avatarUrl: settings.avatarUrl !== undefined ? settings.avatarUrl : current.avatarUrl,
    auraRingId: settings.auraRingId !== undefined ? settings.auraRingId : current.auraRingId,
    theme: settings.theme !== undefined ? settings.theme : current.theme,
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        `${PROFILE_SETTINGS_PREFIX}${username.toLowerCase()}`,
        JSON.stringify(updated),
      );
      window.dispatchEvent(
        new CustomEvent("icepunk-profile-updated", { detail: { username, updated } }),
      );
    } catch {
      // Ignore storage errors
    }
  }

  return updated;
}
