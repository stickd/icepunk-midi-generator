# Architecture

This document is intentionally architectural — for exact request/response contracts see
[docs/api.md](../api.md), and for a from-first-principles line-by-line walkthrough see
[docs/protocol.md](../protocol.md).

## Frontend

The frontend is a Next.js / React / TypeScript app under `frontend/`.

Important areas:

- `frontend/app/page.tsx` renders the generator workspace through `components/sketch/SketchThemeLayout`.
- `frontend/app/u/[username]/page.tsx` renders the public profile page through `components/profile/ProfileView`.
- `frontend/lib/api.ts` contains the browser API client (every backend endpoint has a typed wrapper) and `NEXT_PUBLIC_API_URL` handling.
- `frontend/hooks/useMidiGeneration.ts` owns generation request state and token usage.
- `frontend/hooks/useBrowserMidiPlayback.ts` synthesizes MIDI note events into audible sound client-side via Tone.js + `@tonejs/midi` (Web Audio API) — a `PolySynth` preset by default, or a `Tone.Sampler` if the user supplies a one-shot sample. The Python engine never renders audio; it only writes `.mid` files.
- `frontend/components/sketch/*` contains the generator UI: source selector (`RandomGeneratePanel`), custom-upload dropzone (`MidiDropZone`, 1–100 files), saved-dataset combination controls (`CustomDatasetControls`, up to 10 sources with the factory pool), post-generation result view with regenerate and save-dataset actions (`GeneratedPackVisualizer`, `SaveDatasetButton`), and the public feed (`FeedMountIsland` → `UserGenerationsFeed` → `GenerationFeedCard`).
- `frontend/components/profile/*` implements the profile page: `ProfileView` (Generated / Datasets / Packs / Favorites tabs, last two only on your own profile), `ProfileHeader`, `ProfileStats`, `ProfileSettingsModal`, `PackCard`.
- `frontend/components/FeedbackSection.tsx` and `frontend/app/api/contact/route.ts` implement the feedback form flow.
- `frontend/components/UploadProjectSection.tsx` implements authenticated upload UI for user MIDI projects.

Frontend must not show fake generated MIDI items as real backend output. Demo or placeholder areas must be visibly disabled or clearly identified. The one known exception, by design and documented as such: profile avatars are currently a per-browser `localStorage` cosmetic preview (`frontend/lib/profileStore.ts`), not shared server state — other users never see them.

## Backend

The backend is a Spring Boot API under `backend/`.

Responsibilities by controller (`backend/src/main/java/icepunk_backend/controller/`):

- `AuthController` — register/login, issues JWTs.
- `GenerateController` — `POST /generate`, `GET /generation-usage`; branches on guest (IP) vs. authenticated (JWT) identity.
- `GenerationStatsController` — `GET /generation-stats`, the global lifetime counter.
- `DatasetController` — `POST /datasets/analyze-temp`, the ephemeral (24h) custom-analysis workspace.
- `DatasetPresetController` — `POST/GET/DELETE /datasets`, permanent named dataset presets owned by a user.
- `GeneratedPackController` — pack feed, per-user "My Packs" listing, rename, visibility toggle, delete, proxied downloads.
- `UserUploadController` — public upload feed, MIDI streaming, authenticated project upload.
- `UserProfileController` — public profile stats, `/users/me`, bio/avatar editing, favorites (likes on uploaded projects), like/unlike.

Other layers:

- Authentication: stateless JWT via `AuthController`/`AuthService`/`JwtService` and `JwtAuthFilter`.
- Usage limits: `GenerationLimitService` handles guest (by IP) and user (currently unlimited by design) daily limits, `SELECT ... FOR UPDATE` guarded.
- Generation orchestration: `MidiGenerationService` (semaphore-guarded subprocess), `TempAnalysisService` (ephemeral analysis + validation + cleanup), `DatasetPresetService` (permanent presets, merges up to 10 sources for a generation).
- Storage integration: S3-compatible storage through `S3Config` and per-feature storage services (see [Storage & Lifecycle](#storage--lifecycle) below).
- Database interaction: Spring Data JPA repositories and Flyway migrations (`backend/src/main/resources/db/migration/`).

## Python

Python lives under `python/` (not at repo root — older docs referencing root-level
`icepunk_midi_generator.py`/`icepunk_midi_analyzer.py` describe a superseded layout):

- `python/generate_midi.py` — thin CLI entrypoint into the `python/midi_generator/` package. Reads an analysis JSON (factory or custom), procedurally generates note sequences with constrained randomness (pattern transposition + probability-gated mutation), and writes `.mid` files via `mido`. No audio rendering happens here — MIDI is instructions, not sound; actual audio only happens client-side (see Frontend, `useBrowserMidiPlayback`).
- `python/analyze_midi.py` — thin CLI entrypoint into the `python/midi_analyzer/` package. The full offline analyzer that produces the bundled `analysis_output/midi_analysis.json` from a reference MIDI corpus (chord events, call-response pairs, per-track stats, patterns) — not run at request time.
- `python/temp_analyzer.py` — a separate, standalone (not package-based) script invoked synchronously by `TempAnalysisService` for `/datasets/analyze-temp`. Produces a leaner per-file analysis shape than the full analyzer (no chord events/patterns), sufficient for one-off custom generation.

The generator defaults to `analysis_output/midi_analysis.json` unless Spring passes a custom analysis file path (temp analysis or one/more merged dataset presets).

## PostgreSQL

Confirmed tables from Flyway migrations (`V1`–`V5`) and entities:

- `users` (`V1`, extended in `V3`/`V4`): auth records plus `bio`, `credits`, `verified`, `created_at`, `profile_picture_url`.
- `guest_usage` (`V1`): per-IP guest generation usage.
- `generation_stats` (`V1`): global generation counter.
- `user_uploaded_projects` (`V2`, extended in `V3`): uploaded MIDI/sample project metadata, `download_count`.
- `project_likes` (`V3`): composite-key like table for uploaded projects; both FKs cascade.
- `generated_packs` / `generated_pack_items` (`V3`): one row per `/generate` call, per-file children; `owner_id` is `ON DELETE SET NULL` (deleting a user keeps their packs, now authorless), items cascade with the pack.
- `dataset_presets` (`V5`): permanent named per-user saved analysis presets; unique `(owner_id, name)`.

## MinIO / S3

Single shared bucket (`s3.bucket`, default `icepunk-zips`). Object key prefixes:

- `generated_midi/` — pack ZIPs.
- `generated_midi_items/` — individual generated MIDI items.
- `dataset_presets/` — saved dataset analysis JSON.
- `user_uploads/{ownerId}/...` — user-uploaded MIDI + sample pairs.
- `avatars/{ownerId}/...` — profile avatar images (falls back to local disk if the S3 upload throws).

Do not document or expose real credentials. Local development compose files contain local-only defaults (`minioadmin`/`minioadmin`).

## Storage & Lifecycle

Three different retention/cleanup stories coexist — know which one applies before assuming an object is either permanent or ephemeral:

1. **Guest-generated packs** are never written to the database at all — `GeneratedPackService.uploadGuestGeneratedPack()` uploads to S3 and returns an ephemeral response with a UUID that's never persisted. The only thing that reclaims these objects is the ZIP retention sweep below, and it only targets `generated_midi/`, not `generated_midi_items/` — guest per-item MIDI objects are not covered by any cleanup job today (a known orphan risk, not yet fixed).
2. **Owned generated packs** are deleted DB-row-first, then S3-object-best-effort (`deleteObjectQuietly`, logged not thrown) on `DELETE /generated-packs/{packId}`. Same DB-then-S3 order on dataset preset deletion.
3. **Scheduled sweeps** (`@Scheduled`, exactly two in the codebase):
   - `GeneratedZipCleanupService` — deletes objects under `generated_midi/` older than `GENERATED_ZIP_RETENTION_DAYS` (default 2). Age-based on S3 `lastModified`, **not** reference-based — it does not check whether a `generated_packs` row still points at the ZIP, so an owned pack's whole-ZIP download can start failing ~2 days after generation while its per-item downloads keep working indefinitely.
   - `TempAnalysisService.cleanupExpiredAnalyses()` — deletes local-disk temp-analysis workspaces (under `DATASETS_TEMP_DIR`) older than `DATASETS_TEMP_RETENTION_HOURS` (default 24).

There are no MinIO bucket-level lifecycle policies; all TTL enforcement is Java-side. User uploads and avatars have no scheduled cleanup and no delete endpoint today.

## Custom Datasets — Two Coexisting Mechanisms

- **Ephemeral temp analysis** (`POST /datasets/analyze-temp`): anonymous-friendly, 24h TTL, produces a `tempAnalysisId` usable directly in one `/generate` call.
- **Permanent dataset presets** (`POST/GET/DELETE /datasets`): a signed-in user promotes a `tempAnalysisId` into a named, owned `DatasetPreset` that persists indefinitely and can be reused (and combined, up to 10 sources, optionally blended with the factory pool via `includeFactoryPool`) across any number of future generations.

Both mechanisms are fully implemented — "custom generation is only temporary" is no longer accurate.

## Main Generation Flow

1. Frontend sends `POST /generate` with generation settings (source, amount, dataset selection, etc.).
2. Backend checks guest/user limit.
3. Backend resolves the analysis source: bundled factory data, a temp analysis, or one/more merged dataset presets.
4. `MidiGenerationService` acquires a concurrency slot (`ICEPUNK_GENERATOR_MAX_CONCURRENT`) and runs the Python generator.
5. Python writes MIDI files; the backend extracts metadata (duration, note/track counts, pitch range, BPM, capped preview notes) and zips them.
6. Backend uploads item(s) and ZIP to S3-compatible storage.
7. If the caller is authenticated, the backend persists a `GeneratedPack` + `GeneratedPackItem` rows (with upload-then-DB-write compensation: any already-uploaded object is deleted if a later step fails). Guest calls skip persistence entirely.
8. Backend increments usage and global generation stats only after the full flow succeeds.
9. Frontend receives the structured response and renders the result; a `FEED_REFRESH_EVENT` tells the public feed to refetch.

## API Boundaries

See [docs/api.md](../api.md) for the full, current endpoint reference (auth, generation, datasets,
generated packs, user uploads, profile/social) with request/response shapes. Keep *this* document
architectural — it should describe how the pieces fit together, not restate every field.
