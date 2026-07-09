"use client";

import { ChangeEvent, useRef, useState } from "react";
import { Button, FieldLabel, Input, Modal } from "@/components/ui";
import { updateProfilePictureUrl, uploadAvatar } from "@/lib/api";
import {
  AVATAR_RING_OPTIONS,
  getProfileSettings,
  saveProfileSettings,
  UserCustomSettings,
} from "@/lib/profileStore";

const THEME_OPTIONS = [
  { id: "original", label: "IcePunk (Original)", color: "#8492ff", gradient: "linear-gradient(135deg, #8492ff, #6ee7ff, #bf8cff)" },
  { id: "white-anemone", label: "White Anemone", color: "#ff4e00", gradient: "linear-gradient(135deg, #ff4e00, #ff9100, #ffffff)" },
  { id: "blue-jay", label: "Blue Jay", color: "#1e88e5", gradient: "linear-gradient(135deg, #1e88e5, #00c8e6, #7c4dff)" },
  { id: "turquoise-bird", label: "Jade Stone", color: "#12b59d", gradient: "linear-gradient(135deg, #12b59d, #4ade80, #020b0e)" },
  { id: "bronze", label: "Brass", color: "#d97706", gradient: "linear-gradient(135deg, #d97706, #ffc800, #be2d00)" },
];

type ProfileSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  token: string | null;
  currentAvatarUrl: string | null;
  onAvatarUpdated: (url: string | null) => void;
  onUpdated?: (updated: UserCustomSettings) => void;
};

function extractErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  if (!error.message) return fallback;

  const match = error.message.match(/^HTTP_\d+:\s*(.*)$/);
  if (match && match[1]) {
    const raw = match[1].trim();
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.error === "string" && parsed.error) return parsed.error;
      if (typeof parsed?.message === "string" && parsed.message) return parsed.message;
      if (typeof parsed?.details === "string" && parsed.details) return parsed.details;
    } catch {
      if (raw && !raw.startsWith("<")) return raw;
    }
  }

  if (error.message && !error.message.startsWith("HTTP_")) {
    return error.message;
  }

  return fallback;
}

export default function ProfileSettingsModal({
  isOpen,
  onClose,
  username,
  token,
  currentAvatarUrl,
  onAvatarUpdated,
  onUpdated,
}: ProfileSettingsModalProps) {
  const [selectedRing, setSelectedRing] = useState<string>("periwinkle");
  const [selectedTheme, setSelectedTheme] = useState<string>("original");
  const [avatarUrl, setAvatarUrl] = useState<string>(currentAvatarUrl ?? "");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");
  const [isUploading, setIsUploading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [prevOpenKey, setPrevOpenKey] = useState("");
  const openKey = isOpen ? username : "";
  if (prevOpenKey !== openKey) {
    setPrevOpenKey(openKey);
    if (isOpen && username) {
      setAvatarUrl(currentAvatarUrl ?? "");
      setImgError(false);
      const settings = getProfileSettings(username);
      setSelectedRing(settings.auraRingId);
      setSelectedTheme(settings.theme || "original");
    }
  }

  if (!isOpen) return null;

  const currentOption =
    AVATAR_RING_OPTIONS.find((opt) => opt.id === selectedRing) ?? AVATAR_RING_OPTIONS[0];

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!token) {
      setStatusType("error");
      setStatusMessage("You must be logged in to upload an avatar.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setStatusType("error");
      setStatusMessage("Image size must be under 2MB.");
      return;
    }

    setIsUploading(true);
    setStatusType("success");
    setStatusMessage("Uploading...");
    try {
      const me = await uploadAvatar(token, file);
      setAvatarUrl(me.profilePictureUrl ?? "");
      setImgError(false);
      onAvatarUpdated(me.profilePictureUrl);
      setStatusType("success");
      setStatusMessage("Avatar image uploaded.");
    } catch (error) {
      setStatusType("error");
      setStatusMessage(extractErrorMessage(error, "Avatar upload failed. Please try again."));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!token) return;

    saveProfileSettings(username, { auraRingId: selectedRing, theme: selectedTheme });
    localStorage.setItem("icepunk_theme", selectedTheme);
    window.dispatchEvent(new Event("icepunk-theme-change"));

    try {
      const me = await updateProfilePictureUrl(token, avatarUrl.trim());
      setImgError(false);
      onAvatarUpdated(me.profilePictureUrl);
      if (onUpdated) {
        onUpdated(getProfileSettings(username));
      }
      setStatusType("success");
      setStatusMessage("Settings updated successfully.");
      setTimeout(() => {
        setStatusMessage("");
        onClose();
      }, 500);
    } catch (error) {
      setStatusType("error");
      setStatusMessage(extractErrorMessage(error, "Could not save settings. Please try again."));
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profile Settings">
      <div className="grid gap-6 py-2">
        {/* Avatar Preview & Image Upload Section */}
        <div className="grid gap-3">
          <h3 className="text-sm font-semibold tracking-[0.02em] text-ice-primary">
            Profile Picture & Aura Glow
          </h3>

          <div className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-md">
            {/* Live Avatar Preview with Aura Ring */}
            <div className="relative shrink-0">
              <div
                className={`grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-[color:var(--ice-accent-soft)] text-2xl font-bold text-[color:var(--ice-accent-text)] ring-2 transition-all duration-300 ${currentOption.shadow}`}
                style={{ borderColor: currentOption.color }}
              >
                {avatarUrl && !imgError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={`${username}'s avatar`}
                    className="h-full w-full object-cover"
                    onError={() => setImgError(true)}
                    src={avatarUrl}
                  />
                ) : (
                  username.slice(0, 1).toUpperCase()
                )}
              </div>
            </div>

            <div className="grid min-w-0 gap-2">
              <div>
                <p className="text-sm font-semibold text-ice-primary">{username}</p>
                <p className="text-xs text-ice-muted">
                  Upload a profile picture and customize your studio aura ring glow.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  disabled={isUploading}
                  onChange={handleFileUpload}
                  type="file"
                />
                <Button
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {isUploading ? "Uploading..." : "Upload Photo"}
                </Button>
                {avatarUrl && (
                  <button
                    className="text-xs text-ice-muted hover:text-red-400 transition"
                    onClick={() => {
                      setAvatarUrl("");
                      setImgError(false);
                    }}
                    type="button"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Optional Avatar Image URL Input */}
          <FieldLabel htmlFor="avatar-url">
            Image URL (Optional)
            <Input
              id="avatar-url"
              onChange={(e) => {
                setAvatarUrl(e.target.value);
                setImgError(false);
              }}
              placeholder="https://..."
              value={avatarUrl}
            />
          </FieldLabel>

          {/* App Color Theme Grid Selection */}
          <div className="grid gap-2">
            <span className="text-xs font-semibold text-ice-secondary">App Color Theme</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {THEME_OPTIONS.map((opt) => (
                <button
                  className={`settings-picker-btn flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium transition duration-150 ease-out ${
                    selectedTheme === opt.id
                      ? "border-white/20 bg-white/[0.08] text-ice-primary shadow-[0_0_12px_rgba(255,255,255,0.1)] selected"
                      : "border-white/[0.06] bg-white/[0.02] text-ice-secondary hover:bg-white/[0.05]"
                  }`}
                  key={opt.id}
                  onClick={() => setSelectedTheme(opt.id as UserCustomSettings["theme"])}
                  type="button"
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full shrink-0 ring-1 ring-white/20"
                    style={{ background: opt.gradient, boxShadow: `0 0 10px ${opt.color}` }}
                  />
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color Ring Picker */}
          <div className="grid gap-2">
            <span className="text-xs font-semibold text-ice-secondary">Aura Ring Color</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AVATAR_RING_OPTIONS.map((opt) => (
                <button
                  className={`ring-picker-btn flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium transition duration-150 ease-out ${
                    selectedRing === opt.id
                      ? "border-white/20 bg-white/[0.08] text-ice-primary shadow-[0_0_12px_rgba(255,255,255,0.1)] selected"
                      : "border-white/[0.06] bg-white/[0.02] text-ice-secondary hover:bg-white/[0.05]"
                  }`}
                  key={opt.id}
                  onClick={() => setSelectedRing(opt.id)}
                  type="button"
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full shrink-0 ring-1 ring-white/20"
                    style={{ backgroundColor: opt.color, boxShadow: `0 0 10px ${opt.color}` }}
                  />
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {statusMessage ? (
          <p className={`text-center text-xs font-medium ${statusType === "error" ? "text-red-400" : "text-emerald-400"}`}>
            {statusMessage}
          </p>
        ) : null}

        {/* Modal Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
          <Button onClick={onClose} size="sm" type="button" variant="secondary">
            Cancel
          </Button>
          <Button disabled={isUploading} onClick={handleSave} size="sm" type="button" variant="primary">
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
