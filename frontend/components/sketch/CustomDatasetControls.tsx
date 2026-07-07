"use client";

import { useEffect, useState } from "react";
import { Button, FieldLabel, Input, Modal } from "@/components/ui";
import { DatasetPreset, getDatasetPresets, saveDatasetPreset } from "@/lib/api";

const MAX_COMBINE_COUNT = 10;

type CustomDatasetControlsProps = {
  token: string | null;
  tempAnalysisId?: string;
  selectedDatasetIds: string[];
  includeFactoryPool: boolean;
  onSelectionChange: (datasetIds: string[], includeFactoryPool: boolean) => void;
  onStubStatus: (message: string) => void;
};

export default function CustomDatasetControls({
  token,
  tempAnalysisId,
  selectedDatasetIds,
  includeFactoryPool,
  onSelectionChange,
  onStubStatus,
}: CustomDatasetControlsProps) {
  const [presets, setPresets] = useState<DatasetPreset[]>([]);
  const [presetsStatus, setPresetsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      setPresets([]);
      setPresetsStatus("idle");
      return;
    }

    const controller = new AbortController();
    setPresetsStatus("loading");

    getDatasetPresets(token, controller.signal)
      .then((items) => {
        setPresets(items);
        setPresetsStatus("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPresetsStatus("error");
      });

    return () => controller.abort();
  }, [token]);

  if (!token) return null;

  const totalSelected = selectedDatasetIds.length + (includeFactoryPool ? 1 : 0);

  function toggleDataset(id: string) {
    const isSelected = selectedDatasetIds.includes(id);

    if (!isSelected && totalSelected >= MAX_COMBINE_COUNT) {
      onStubStatus(`You can combine up to ${MAX_COMBINE_COUNT} sources at once.`);
      return;
    }

    const nextIds = isSelected
      ? selectedDatasetIds.filter((datasetId) => datasetId !== id)
      : [...selectedDatasetIds, id];

    onSelectionChange(nextIds, includeFactoryPool);
  }

  function toggleFactoryPool() {
    if (!includeFactoryPool && totalSelected >= MAX_COMBINE_COUNT) {
      onStubStatus(`You can combine up to ${MAX_COMBINE_COUNT} sources at once.`);
      return;
    }

    onSelectionChange(selectedDatasetIds, !includeFactoryPool);
  }

  async function handleSaveDataset() {
    if (!token || !tempAnalysisId || !saveName.trim() || isSaving) return;

    try {
      setIsSaving(true);
      const saved = await saveDatasetPreset(token, saveName.trim(), tempAnalysisId);
      setPresets((current) => [saved, ...current]);
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
    <div className="grid gap-3">
      {tempAnalysisId ? (
        <Button
          className="mx-auto"
          onClick={() => setIsSaveOpen(true)}
          size="sm"
          type="button"
          variant="secondary"
        >
          Save as Dataset
        </Button>
      ) : null}

      {presetsStatus === "ready" && presets.length > 0 ? (
        <div className="grid gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
          <span className="text-xs font-medium text-ice-secondary">
            Or generate from saved datasets ({totalSelected}/{MAX_COMBINE_COUNT})
          </span>
          <div className="grid gap-1.5">
            <label className="flex items-center gap-2 text-xs text-ice-primary">
              <input
                checked={includeFactoryPool}
                onChange={toggleFactoryPool}
                type="checkbox"
              />
              Include Factory pool
            </label>
            {presets.map((preset) => (
              <label className="flex items-center gap-2 text-xs text-ice-primary" key={preset.id}>
                <input
                  checked={selectedDatasetIds.includes(preset.id)}
                  onChange={() => toggleDataset(preset.id)}
                  type="checkbox"
                />
                {preset.name}
                <span className="text-ice-muted">({preset.sourceMidiCount} MIDI)</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

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
    </div>
  );
}
