# Current State

- Last updated: 2026-07-08
- Current branch: `dev`
- Latest commits at update time:
  - `37a9609 File remaining top-level docs under docs/`
  - `bf14d11 Remove stale/junk files from repo cleanup`
  - `d924246 audits`
  - `799e2cd Fix stale guest-generation test to match ephemeral pack design`
  - `183169b Fix pre-existing test drift in GeneratedPackServiceTest and FlywayMigrationIntegrationTest`

Working tree at update time has in-progress, not-yet-committed frontend edits to
`CustomDatasetControls.tsx`, `GeneratedPackVisualizer.tsx`, `RandomGeneratePanel.tsx`,
`SketchThemeClient.tsx`, and a new `SaveDatasetButton.tsx` (save-dataset UX + regenerate button
work). Check `git status` before assuming these are committed.

## Fully Implemented and Committed

Everything below is confirmed from committed source (not "working tree state, not yet verified" —
that hedge applied to Generated Packs and profile features in early July and is no longer
accurate; both have been committed, tested, and iterated on since):

- **Auth**: JWT register/login, BCrypt passwords, per-IP rate limiting on register/login, `JWT_SECRET` fails closed (no fallback) under the `prod` profile (`774d665`).
- **Generation**: guest (by IP) and user daily limits, `GET /generation-usage` quota display, `GET /generation-stats` global counter, concurrency-guarded Python subprocess.
- **Generation sources**: `FACTORY` (bundled analysis), `CUSTOM_UPLOAD` via ephemeral temp analysis (`/datasets/analyze-temp`, 1-100 files, 24h TTL), and `CUSTOM_UPLOAD` via one-or-more **permanent dataset presets** (`/datasets`, up to 10 combined sources, optional factory-pool blend) — the preset feature landed `3856be6`..`3aabb00`.
- **Generated Packs**: every authenticated generation is persisted (`generated_packs` + `generated_pack_items`, `V3` migration); guest generations are intentionally ephemeral (S3-only, never a DB row). Full CRUD-ish surface: public feed, single-pack read, proxied ZIP/item downloads, owner-only rename/visibility-toggle/delete, "My Packs" listing (`GET /users/me/generated-packs`). IDOR fix for visibility enforcement on read/download landed `5b016c0`.
- **User uploads**: authenticated MIDI+sample project upload, public feed, streamed MIDI preview (increments download count), like/unlike (`project_likes`, `V3`).
- **Profiles**: public profile stats (`/users/{username}/profile`), `/users/me`, bio/avatar editing (server-side S3 upload with local-disk fallback), favorites (liked uploaded projects), profile page with Generated/Datasets/Packs/Favorites tabs.
- **Storage lifecycle**: two `@Scheduled` sweeps — ZIP retention (`generated_midi/`, age-based, default 2 days) and temp-analysis cleanup (default 24h). Owned-pack and dataset-preset deletion do DB-first-then-S3-best-effort cleanup. See [ARCHITECTURE.md § Storage & Lifecycle](ARCHITECTURE.md#storage--lifecycle) for the known gaps (guest per-item MIDI objects aren't swept; ZIP sweep is age-based, not reference-checked).
- **Frontend**: client-side MIDI playback via Tone.js (`useBrowserMidiPlayback`, no server-side audio rendering ever), real public feed with shared playback across generator/feed/profile, regenerate button (replays the last generation request), save-as-dataset button on custom-upload results, profile page with real tabs.

## Verification last observed

- `backend ./mvnw test`: passing as of `183169b`/`799e2cd` (test-drift fixes for the ephemeral-guest-pack design and generated-pack service).
- Frontend typecheck/lint/build: passing as of the last full verification pass referenced in `d924246`.
- Security audit `docs/security-audit-2026-07-07.md` and performance audit `docs/performance-audit-2026-07-07.md` are dated snapshots — treat as historical, re-run before relying on them for a new release decision.

Re-run the relevant suite before trusting any of the above on a session that touches that area —
this section records what was last confirmed, not a live status.

## Current Product Boundaries

Not implemented:

- Credits/payment/private-paid-download economy (the `credits` column exists and displays, but has no earn/spend mechanics).
- Likes/ratings/favorites *for Generated Packs specifically* (uploaded projects already have this).
- Delete endpoint for user-uploaded projects.
- Reference-checked (vs. purely age-based) storage retention for generated ZIPs.
- Scheduled cleanup for guest per-item MIDI objects, user uploads, or avatars.

## Next Recommended Action

Check `git status` for the uncommitted `SaveDatasetButton`/`GeneratedPackVisualizer`/
`SketchThemeClient` frontend work noted above and decide whether to finish, test, and commit it
before starting unrelated work.
