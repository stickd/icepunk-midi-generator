# Current State

- Last updated: 2026-07-04
- Current branch: `dev`
- Working tree state at update time: Fixed SVG gradient ID collisions in `PianoRollPreview.tsx`, aligned item label key ordering across thumbnail carousel and main preview for 100% color matching, added animated playback playhead line during preview, and removed UNLIMITED badge when logged in. All 9 test suites and production build passing 100%.
- Latest commits at update time:
  - `23699ed Implement`
  - `2d154e6 Connect`
  - `1a82b8d feat: add public MIDI upload feed`
  - `8922398 feat: sync piano roll with playback`
  - `ee8d518 feat: add MIDI piano roll visualization`

## Phase 1 - Generation Source Flow

Confirmed from Git history and current code:

- Commit `23699ed` exists on local `dev`.
- `POST /generate` accepts a typed JSON body through `GenerationRequest`.
- `FACTORY` generation uses bundled `analysis_output/midi_analysis.json` by resolving no custom analysis path.
- `CUSTOM_UPLOAD` generation uses an analysis file referenced by `tempAnalysisId`.
- `CUSTOM_UPLOAD` without a valid `tempAnalysisId` is rejected by `TempAnalysisService.resolveAnalysisFile`.
- `POST /datasets/analyze-temp` accepts temporary custom MIDI uploads and returns a `tempAnalysisId`.
- Temporary custom analysis cleanup exists in `TempAnalysisService`.
- Frontend sends source-specific request bodies through `frontend/lib/api.ts` and `useMidiGeneration`.
- The sketch UI has Factory / Custom source selection.

Previously reported Phase 1 verification, not rerun for this documentation task:

- Backend unit suite excluding integration tests: 100 tests passed.
- Targeted Phase 1/API tests: 27 passed.
- Frontend tests: 57 passed (8 test suites).
- Frontend typecheck passed.

## Phase 2 / P1 - Generated Packs & MIDI Items

Confirmed from current working tree, not from committed Git history at update time:

- `GenerationResponse` exists with `packId`, `packDownloadUrl`, `downloadUrl`, `items`, and `totalGenerations`.
- Generated pack DTOs exist: `GeneratedPackResponse`, `GeneratedMidiItemResponse`, `MidiPreviewResponse`, `MidiPreviewNoteResponse`.
- Migration `V3__generated_packs.sql` exists with `generated_packs` and `generated_pack_items`.
- Entities/repositories exist for generated packs and items.
- `GeneratedPackService` persists generated packs/items and maps public download URLs without exposing object keys in DTOs.
- `GeneratedPackStorageService` uploads ZIPs under `generated_midi/` and individual MIDI items under `generated_midi_items/`.
- `MidiGenerationService.generateFiles(...)` runs the Python generator once, keeps generated `.mid` files available before cleanup, creates a ZIP, and returns a `GeneratedFiles` handle.
- `MidiMetadataExtractor` extracts duration, note count, track count, pitch range, BPM, and capped preview notes.
- `GenerateController` calls `GeneratedPackService.persistGeneratedPack(...)`, then increments usage and global stats after successful pack persistence.
- `GeneratedPackController` contains `GET /generated-packs/{packId}` and `GET /generated-packs/{packId}/items/{itemId}/download`.
- `SecurityConfig` permits `/generated-packs/**`.
- Frontend `GeneratedMidisModal` renders real generated item data from `lastGeneration.items`.
- Frontend `PianoRollPreview` renders SVG notes from backend preview data and shows a fallback when preview notes are absent.
- `useMidiGeneration` stores the structured response and no longer auto-clicks a download link.

Important status:

Phase 2 / P1 implementation exists in the working tree, but it requires dedicated end-to-end verification before being considered safe to commit/push, unless future Git history shows that verification and commit already happened.

Verification observed earlier in this same working tree but not part of this documentation task:

- `backend ./mvnw test`: 117 passed.
- `frontend npm test -- --runInBand`: 78 passed.
- `frontend npm run typecheck`: passed.
- `frontend npm run lint`: passed.
- `frontend npm run build`: passed.
- `venv/bin/python -m pytest -q`: 69 passed.

Treat those as useful context, not a replacement for a dedicated Phase 2 / P1 e2e verification session.

## Current Product Boundaries

Implemented or partially implemented:

- Auth register/login with JWT.
- Guest and user generation limits.
- Global generation counter.
- Factory and custom temporary analysis generation sources.
- Public uploaded project feed.
- Browser MIDI visualization/playback for uploaded MIDI contexts.
- Feedback form.
- Generated ZIP cleanup for `generated_midi/` ZIP objects.

Not fully implemented:

- Credits/payment/private pack economy.
- Favorites, likes, ratings, comments, social ranking.
- Full market/profile/library pages.
- Permanent custom dataset saving.
- Full generated-pack ownership/access-control model.
- Full retention audit for generated individual MIDI files.

## Next Recommended Action

Start a new Codex session dedicated only to Phase 2 / P1 end-to-end verification. Cover:

- FACTORY lifecycle,
- CUSTOM_UPLOAD lifecycle,
- DB persistence,
- MinIO object persistence,
- response integrity,
- ownership,
- failure consistency,
- MIDI metadata integrity,
- preview safety,
- frontend integration,
- regression tests,
- storage retention audit.

Do not combine that verification with unrelated feature work.
