"use client";

import { useState } from "react";
import { Button, FieldLabel, Input, Modal } from "@/components/ui";
import { saveDatasetPreset } from "@/lib/api";

type SaveDatasetButtonProps = {
  token: string | null;
  tempAnalysisId?: string;
  onStubStatus: (message: string) => void;
};

export default function SaveDatasetButton({
  token,
  tempAnalysisId,
  onStubStatus,
}: SaveDatasetButtonProps) {
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!token || !tempAnalysisId) return null;

  async function handleSaveDataset() {
    if (!token || !tempAnalysisId || !saveName.trim() || isSaving) return;

    try {
      setIsSaving(true);
      const saved = await saveDatasetPreset(token, saveName.trim(), tempAnalysisId);
      setIsSaveOpen(false);
      setSaveName("");
      onStubStatus(`Dataset "${saved.name}" saved.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      onStubStatus(
        message.includes("HTTP_409")
          ? "A dataset with that name already exists."
          : "Could not save dataset. Try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button
        className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-md transition duration-150 ease-out hover:border-white/20 hover:bg-white/[0.12] hover:shadow-[0_0_16px_rgba(255,255,255,0.15)]"
        onClick={() => setIsSaveOpen(true)}
        type="button"
      >
        <svg className="h-3.5 w-3.5 text-ice-accent" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Save as Dataset</span>
      </button>

      <Modal
        isOpen={isSaveOpen}
        onClose={() => setIsSaveOpen(false)}
        title="Save as Dataset"
      >
        <div className="grid gap-4">
          <FieldLabel>
            Name
            <Input
              autoFocus
              onChange={(event) => setSaveName(event.target.value)}
              placeholder="e.g. Dark loops"
              value={saveName}
            />
          </FieldLabel>
          <Button
            disabled={!saveName.trim() || isSaving}
            onClick={handleSaveDataset}
            type="button"
            variant="primary"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
