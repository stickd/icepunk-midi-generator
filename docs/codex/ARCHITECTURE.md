# Architecture

## Frontend

The frontend is a Next.js / React / TypeScript app under `frontend/`.

Important areas:

- `frontend/app/page.tsx` renders the sketch workspace through `components/sketch/SketchThemeLayout`.
- `frontend/lib/api.ts` contains the browser API client and `NEXT_PUBLIC_API_URL` handling.
- `frontend/hooks/useMidiGeneration.ts` owns generation request state and token usage.
- `frontend/components/sketch/*` contains the experimental sketch-style generator UI, source selector, upload/dropzone UI, generated modal, browser piano-roll components, and feed cards.
- `frontend/components/FeedbackSection.tsx` and `frontend/app/api/contact/route.ts` implement the feedback form flow.
- `frontend/components/UploadProjectSection.tsx` implements authenticated upload UI for user MIDI projects.

Frontend must not show fake generated MIDI items as real backend output. Demo or placeholder areas must be visibly disabled or clearly identified.

## Backend

The backend is a Spring Boot API under `backend/`.

Confirmed responsibilities:

- API layer: controllers in `backend/src/main/java/icepunk_backend/controller`.
- Authentication: JWT auth through auth controller/service and `JwtAuthFilter`.
- Generation orchestration: `GenerateController`, `MidiGenerationService`, `TempAnalysisService`, and generation limit/stat services.
- Usage limits: `GenerationLimitService` handles guest and user daily limits.
- Storage integration: S3-compatible storage through `S3Config` and storage services.
- Database interaction: Spring Data JPA repositories and Flyway migrations.
- User uploads: `UserUploadController`, `UserUploadService`, `UserUploadStorageService`, and `user_uploaded_projects`.

The current working tree also contains generated pack persistence services and controllers; confirm commit state before relying on them.

## Python

Python scripts live at repository root:

- `icepunk_midi_analyzer.py`: analyzes MIDI datasets and writes analysis data.
- `icepunk_midi_temp_analyzer.py`: analyzes temporary custom user-uploaded MIDI files for generation.
- `icepunk_midi_generator.py`: reads analysis data and writes generated MIDI files to an output directory.

The generator defaults to `analysis_output/midi_analysis.json` unless Spring passes a custom analysis file path.

## PostgreSQL

Confirmed tables from migrations and entities include:

- `users`: auth user records and per-user generation usage fields.
- `guest_usage`: per-IP guest generation usage.
- `generation_stats`: global generation counter.
- `user_uploaded_projects`: uploaded MIDI/sample project metadata for authenticated users.

The current working tree also contains `generated_packs` and `generated_pack_items` migration/entity code. Treat it as Phase 2 / P1 working tree state unless a future commit makes it part of history.

## MinIO / S3

Object storage is used for:

- Generated ZIP files under `generated_midi/`.
- User uploaded MIDI/sample files under user upload prefixes.
- In the current Phase 2 / P1 working tree, generated individual MIDI files under `generated_midi_items/`.

Do not document or expose real credentials. Local development compose files may contain local-only defaults.

## Main Generation Flow

High-level current flow:

1. Frontend sends `POST /generate` with generation settings.
2. Backend checks guest/user limit.
3. Backend resolves generation source.
4. `MidiGenerationService` acquires a concurrency slot and runs the Python generator.
5. Python writes MIDI files and backend zips them.
6. Backend uploads generated artifact(s) to S3-compatible storage.
7. Backend increments usage and global generation stats only after successful generation/upload flow.
8. Frontend receives download data and displays the result.

### FACTORY

`FACTORY` uses the bundled analysis data (`analysis_output/midi_analysis.json`) by passing no custom analysis file to the Python generator.

### CUSTOM_UPLOAD

`CUSTOM_UPLOAD` requires a valid `tempAnalysisId` from `POST /datasets/analyze-temp`. The backend resolves that ID to a temporary analysis file and passes it to the Python generator.

## API Boundaries

Important confirmed endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `POST /generate`
- `GET /generation-stats`
- `POST /datasets/analyze-temp`
- `POST /uploads/projects`
- `GET /uploads/feed`
- `GET /uploads/projects/{id}/midi`

Current Phase 2 / P1 working tree also contains:

- `GET /generated-packs/{packId}`
- `GET /generated-packs/{packId}/items/{itemId}/download`

Keep this document architectural. Use code and tests for exact request/response contracts.
