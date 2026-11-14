"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Button, FieldLabel, Input, Modal } from "@/components/ui";
import {
  deleteGeneratedPack,
  getMyGeneratedPacks,
  OwnedGeneratedPack,
  requestAccountDeletion,
  updateGeneratedPackVisibility,
  updateProfilePictureUrl,
  uploadAvatar,
} from "@/lib/api";
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
  onAccountDeletionRequested: () => void;
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

function safeAvatarUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const isLocalDevelopmentUrl =
      url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    return url.protocol === "https:" || isLocalDevelopmentUrl ? url.href : null;
  } catch {
    return null;
  }
}

export default function ProfileSettingsModal({
  isOpen,
  onClose,
  username,
  token,
  currentAvatarUrl,
  onAvatarUpdated,
  onAccountDeletionRequested,
  onUpdated,
}: ProfileSettingsModalProps) {
  const [selectedRing, setSelectedRing] = useState<string>("periwinkle");
  const [avatarUrl, setAvatarUrl] = useState<string>(currentAvatarUrl ?? "");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");
  const [isUploading, setIsUploading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [generatedPacks, setGeneratedPacks] = useState<OwnedGeneratedPack[] | null>(null);
  const [packActionId, setPackActionId] = useState<string | null>(null);
  const [packDeleteConfirmationId, setPackDeleteConfirmationId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [prevOpenKey, setPrevOpenKey] = useState("");
  const openKey = isOpen ? username : "";
  if (prevOpenKey !== openKey) {
    setPrevOpenKey(openKey);
    if (isOpen && username) {
      setAvatarUrl(currentAvatarUrl ?? "");
      setImgError(false);
      setSelectedRing(getProfileSettings(username).auraRingId);
    }
  }

  useEffect(() => {
    if (!isOpen || !token) return;
    const controller = new AbortController();
    getMyGeneratedPacks(token, controller.signal)
      .then((packs) => setGeneratedPacks(packs))
      .catch(() => setGeneratedPacks([]));
    return () => controller.abort();
  }, [isOpen, token]);

  if (!isOpen) return null;

  const currentOption =
    AVATAR_RING_OPTIONS.find((opt) => opt.id === selectedRing) ?? AVATAR_RING_OPTIONS[0];
  const avatarPreviewUrl = safeAvatarUrl(avatarUrl);

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
      saveProfileSettings(username, { avatarUrl: me.profilePictureUrl ?? "" });
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

    const normalizedAvatarUrl = avatarUrl.trim();
    if (normalizedAvatarUrl && !safeAvatarUrl(normalizedAvatarUrl)) {
      setStatusType("error");
      setStatusMessage("Avatar image URLs must use HTTPS.");
      return;
    }

    saveProfileSettings(username, { avatarUrl: normalizedAvatarUrl, auraRingId: selectedRing });

    try {
      const me = await updateProfilePictureUrl(token, normalizedAvatarUrl);
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

  async function handleAccountDeletion() {
    if (!token || isDeletingAccount) return;
    setIsDeletingAccount(true);
    setStatusType("success");
    setStatusMessage("Deleting account...");
    try {
      await requestAccountDeletion(token);
      setStatusMessage("Your account has been disabled and deletion has started.");
      onAccountDeletionRequested();
    } catch (error) {
      setStatusType("error");
      setStatusMessage(extractErrorMessage(error, "Could not start account deletion. Please try again."));
      setIsDeletingAccount(false);
    }
  }

  async function handlePackVisibility(pack: OwnedGeneratedPack) {
    if (!token || packActionId) return;
    const visibility = pack.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC";
    setPackActionId(pack.packId);
    try {
      const updated = await updateGeneratedPackVisibility(token, pack.packId, visibility);
      setGeneratedPacks((packs) => packs?.map((item) => item.packId === pack.packId ? { ...item, visibility: updated.visibility } : item) ?? null);
    } catch (error) {
      setStatusType("error");
      setStatusMessage(extractErrorMessage(error, "Could not change pack visibility."));
    } finally {
      setPackActionId(null);
    }
  }

  async function handlePackDeletion(packId: string) {
    if (!token || packActionId) return;
    setPackActionId(packId);
    try {
      await deleteGeneratedPack(token, packId);
      setGeneratedPacks((packs) => packs?.filter((pack) => pack.packId !== packId) ?? null);
      setPackDeleteConfirmationId(null);
    } catch (error) {
      setStatusType("error");
      setStatusMessage(extractErrorMessage(error, "Could not delete this pack."));
    } finally {
      setPackActionId(null);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profile Settings">
      <a href="/moderation" className="block p-2 underline">Moderation decisions and appeals</a>
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
                {avatarPreviewUrl && !imgError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={`${username}'s avatar`}
                    className="h-full w-full object-cover"
                    onError={() => setImgError(true)}
                    src={avatarPreviewUrl}
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

        <section className="grid gap-3 border-t border-white/[0.06] pt-5" aria-labelledby="midi-packs-title">
          <div>
            <h3 className="text-sm font-semibold text-ice-primary" id="midi-packs-title">Your generated MIDI packs</h3>
            <p className="mt-1 text-xs text-ice-secondary">Publish or hide a pack at any time. Public packs are shown in Community.</p>
          </div>
          {generatedPacks === null ? <p className="text-xs text-ice-muted">Loading packs...</p> : generatedPacks.length === 0 ? (
            <p className="text-xs text-ice-muted">No generated packs yet.</p>
          ) : (
            <div className="grid max-h-52 gap-2 overflow-y-auto pr-1">
              {generatedPacks.map((pack) => (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3" key={pack.packId}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0"><p className="truncate text-sm text-ice-primary">{pack.name}</p><p className="text-xs text-ice-muted">{pack.visibility === "PUBLIC" ? "Community" : "Private"}</p></div>
                    <Button disabled={Boolean(packActionId)} onClick={() => handlePackVisibility(pack)} size="sm" type="button" variant="secondary">
                      {packActionId === pack.packId ? "Saving..." : pack.visibility === "PUBLIC" ? "Make private" : "Publish"}
                    </Button>
                  </div>
                  {packDeleteConfirmationId === pack.packId ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2"><span className="w-full text-xs text-red-200">Delete this MIDI pack permanently?</span><Button disabled={Boolean(packActionId)} onClick={() => handlePackDeletion(pack.packId)} size="sm" type="button" variant="ghost">Delete</Button><Button disabled={Boolean(packActionId)} onClick={() => setPackDeleteConfirmationId(null)} size="sm" type="button" variant="secondary">Cancel</Button></div>
                  ) : <button className="mt-3 text-xs text-red-300 hover:text-red-200" onClick={() => setPackDeleteConfirmationId(pack.packId)} type="button">Delete pack</button>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-3 border-t border-red-400/20 pt-5" aria-labelledby="delete-account-title">
          <div>
            <h3 className="text-sm font-semibold text-red-300" id="delete-account-title">Delete account</h3>
            <p className="mt-1 text-xs leading-5 text-ice-secondary">
              This immediately disables your account, hides your public content, and starts deletion of your profile, MIDI packs, uploads and stored files. Backups are removed on their normal retention cycle.
            </p>
          </div>
          {deleteConfirmationOpen ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/[0.06] p-3">
              <p className="w-full text-xs text-red-100">This cannot be undone. Start deleting this account?</p>
              <Button disabled={isDeletingAccount} onClick={handleAccountDeletion} size="sm" type="button" variant="ghost">
                {isDeletingAccount ? "Deleting..." : "Yes, delete my account"}
              </Button>
              <Button disabled={isDeletingAccount} onClick={() => setDeleteConfirmationOpen(false)} size="sm" type="button" variant="secondary">
                Keep account
              </Button>
            </div>
          ) : (
            <Button onClick={() => setDeleteConfirmationOpen(true)} size="sm" type="button" variant="ghost">
              Delete account
            </Button>
          )}
        </section>

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
