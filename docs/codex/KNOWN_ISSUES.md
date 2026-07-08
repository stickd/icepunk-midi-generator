# Known Issues and Risks

## Confirmed Issues

- The ZIP retention sweep (`GeneratedZipCleanupService`) is age-based only — it does not check whether a `generated_packs` row still references the object it's about to delete. A pack's whole-ZIP download can start failing ~2 days after generation (`GENERATED_ZIP_RETENTION_DAYS` default) while its per-item downloads keep working indefinitely, because per-item objects live under a different prefix (`generated_midi_items/`) that no sweep touches.
- Guest-generated packs are never persisted as DB rows (by design), so guest per-item MIDI objects under `generated_midi_items/` have no automated cleanup at all today — not covered by the ZIP sweep, which only targets `generated_midi/`.
- There is no delete endpoint for user-uploaded projects, and no scheduled cleanup for user uploads or avatars.
- Large MIDI datasets, generated MIDI files, and analysis JSON artifacts are expensive to inspect and should not be loaded unless directly required.
- `docs/phase3-python-test-plan.md` and `docs/python-engine-code-review.md` describe an earlier monolithic root-level Python layout (`icepunk_midi_generator.py`, `icepunk_midi_analyzer.py`, `icepunk_midi_temp_analyzer.py`) that no longer exists — the engine now lives under `python/` as `generate_midi.py`/`midi_generator/`, `analyze_midi.py`/`midi_analyzer/`, and a standalone `temp_analyzer.py`. Both are dated audit snapshots from before the `python/` restructure and should be read with that caveat rather than treated as current; `docs/protocol.md` §7, §9.4, and §12 were updated on 2026-07-08 to match the current layout.

## Verification Risks / Not Yet Confirmed

- Failure-path testing for partial upload cleanup (compensating deletes when persistence fails partway through) should be re-verified whenever `GeneratedPackService`/`DatasetPresetService` change — the pattern (upload, track keys, delete-on-failure) is easy to silently break with an unrelated refactor.
- MIDI metadata extraction (`MidiMetadataExtractor`) should be validated against a wider set of real-world MIDI files before relying on it for public previews at scale.
- Uncommitted frontend work exists in the working tree as of 2026-07-08 (`SaveDatasetButton.tsx`, edits to `GeneratedPackVisualizer.tsx`/`CustomDatasetControls.tsx`/`RandomGeneratePanel.tsx`/`SketchThemeClient.tsx`) — verify tests pass and behavior is correct before treating it as done; check `git status` rather than assuming from this document.

Do not describe verification risks as confirmed bugs without reproducing them.
