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
  const match = error.message.match(/^HTTP_\d+:\s*(.*)$/);
  if (!match) return fallback;
  try {
    const parsed = JSON.parse(match[1]);
    return typeof parsed?.error === "string" ? parsed.error : fallback;
  } catch {
    return fallback;
  }
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
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl ?? "");
  const [selectedRing, setSelectedRing] = useState("periwinkle");
  const [statusMessage, setStatusMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prevOpenKey, setPrevOpenKey] = useState("");
  const openKey = isOpen ? username : "";
  if (prevOpenKey !== openKey) {
    setPrevOpenKey(openKey);
    if (isOpen && username) {
      setAvatarUrl(currentAvatarUrl ?? "");
      setSelectedRing(getProfileSettings(username).auraRingId);
    }
  }

  if (!isOpen) return null;

  const currentOption =
    AVATAR_RING_OPTIONS.find((opt) => opt.id === selectedRing) ?? AVATAR_RING_OPTIONS[0];

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !token) return;

    if (file.size > 2 * 1024 * 1024) {
      setStatusMessage("Image size must be under 2MB.");
      return;
    }

    setIsUploading(true);
    setStatusMessage("Uploading...");
    try {
      const me = await uploadAvatar(token, file);
      setAvatarUrl(me.profilePictureUrl ?? "");
      onAvatarUpdated(me.profilePictureUrl);
      setStatusMessage("Avatar image uploaded.");
    } catch (error) {
      setStatusMessage(extractErrorMessage(error, "Avatar upload failed. Please try again."));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!token) return;

    saveProfileSettings(username, { auraRingId: selectedRing });

    try {
      const me = await updateProfilePictureUrl(token, avatarUrl.trim());
      onAvatarUpdated(me.profilePictureUrl);
      if (onUpdated) {
        onUpdated(getProfileSettings(username));
      }
      setStatusMessage("Settings updated successfully.");
      setTimeout(() => {
        setStatusMessage("");
        onClose();
      }, 500);
    } catch (error) {
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
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={`${username}'s avatar`}
                    className="h-full w-full object-cover"
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
                    onClick={() => setAvatarUrl("")}
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
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              value={avatarUrl}
            />
          </FieldLabel>

          {/* Color Ring Picker */}
          <div className="grid gap-2">
            <span className="text-xs font-semibold text-ice-secondary">Aura Ring Color</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AVATAR_RING_OPTIONS.map((opt) => (
                <button
                  className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium transition duration-150 ease-out ${
                    selectedRing === opt.id
                      ? "border-white/20 bg-white/[0.08] text-ice-primary shadow-[0_0_12px_rgba(255,255,255,0.1)]"
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
          <p className="text-center text-xs font-medium text-emerald-400">
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
