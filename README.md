# iCEPUNK MIDI Generator

Full-stack MIDI pack generator for dark, cold melodic loops inspired by the iCEPUNK sound. The app combines a Python MIDI pattern engine, a Spring Boot API, PostgreSQL, S3-compatible object storage, and a Next.js frontend.

## Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: Spring Boot, Spring Security, JWT, JPA
- Storage: S3-compatible object storage, locally MinIO
- Database: PostgreSQL
- MIDI engine: Python with `mido`

## Project Structure

```text
backend/                  Spring Boot API
frontend/                 Next.js app
analysis_output/          Required generator analysis data
generated_midi/           Generated output, ignored by git
python/                   MIDI generation/analysis engine, tests, and Python tooling config
python/generate_midi.py   MIDI generation engine entrypoint
python/analyze_midi.py    Dataset analysis entrypoint
python/requirements.txt   Python generator dependencies
```

## Local Development

Requirements:

- Java 21
- Node.js 20+
- Python 3.10+
- Docker or compatible container runtime

Start local infrastructure:

```bash
docker compose up -d
```

Install Python dependencies:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r python/requirements.txt
```

Run backend:

```bash
cd backend
./mvnw spring-boot:run
```

Run frontend:

```bash
cd frontend
npm install
npm run dev
```

Local URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8081`
- MinIO API: `http://localhost:9010`
- MinIO console: `http://localhost:9011`

Local frontend config can live in `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8081
RESEND_API_KEY=optional_resend_key
FEEDBACK_TO_EMAIL=you@example.com
FEEDBACK_FROM_EMAIL=IcePunk <feedback@your-domain.com>
```

`.env*` files are ignored by git.

## API

- `POST /generate` creates a generated pack, uploads the whole ZIP plus each generated `.mid` item, persists pack/item metadata, and returns a structured generated pack response. The response keeps `downloadUrl` as a temporary backward-compatible alias for `packDownloadUrl`.
- `POST /datasets/analyze-temp` accepts 1-8 `.mid/.midi` files, creates a temporary compatible analysis dataset, and returns `{ "tempAnalysisId": "...", "fileCount": 1, "metadata": {...} }`.
- `GET /generated-packs/{packId}` returns generated pack metadata and generated MIDI items.
- `GET /generated-packs/{packId}/items/{itemId}/download` validates that the item belongs to the pack and redirects to the storage download URL.
- `GET /generation-stats` returns `{ "totalGenerations": 123 }`.
- `POST /auth/register` creates a user account and returns a JWT token.
- `POST /auth/login` returns a JWT token.
- `POST /uploads/projects` uploads an authenticated user's MIDI project and one-shot sample.
- `GET /uploads/feed?page=0&size=10` returns newest public uploaded projects for the discovery feed.
- `GET /uploads/projects/{id}/midi` streams a public uploaded MIDI file through the backend for browser piano-roll visualization.

Guests and logged-in users have daily generation limits. Usage is counted only after successful MIDI generation, storage upload, and generated pack persistence.

The sketch feed uses real public uploaded projects only. Empty feeds show an empty state instead of demo cards, and feed MIDI previews are rendered by parsing the backend MIDI preview endpoint in the browser.

## Generation Sources

The sketch generator supports two real generation sources:

- `FACTORY`: uses the bundled `analysis_output/midi_analysis.json`.
- `CUSTOM_UPLOAD`: uploads 1-8 MIDI files to `/datasets/analyze-temp`, then sends the returned `tempAnalysisId` to `/generate`.

Temporary custom analysis files are stored under `DATASETS_TEMP_DIR`, defaulting to `temp_analysis` inside the generator project directory.

```env
ICEPUNK_TEMP_ANALYZER_SCRIPT_NAME=python/temp_analyzer.py
DATASETS_TEMP_DIR=/app/temp_analysis
DATASETS_TEMP_MIDI_MAX_SIZE_BYTES=2097152
DATASETS_TEMP_RETENTION_HOURS=24
```

## Generated ZIP Retention

Generated MIDI ZIP files are temporary download artifacts. New generated ZIPs are stored in the S3/MinIO bucket under the `generated_midi/` prefix and are automatically cleaned up by the backend after the configured retention period.

The default retention period is 2 days. Change it with:

```env
GENERATED_ZIP_RETENTION_DAYS=2
```

The cleanup task only deletes objects inside `generated_midi/` and never deletes files newer than the configured number of days.

## Generated Packs

Generation output is stored separately from user-uploaded projects:

- `generated_packs`: one row per generation request, including owner if logged in, source type, generation type, controls, ZIP object key, visibility, timestamps, and metadata.
- `generated_pack_items`: one row per generated `.mid`, linked to its pack with `ON DELETE CASCADE`, including object key, file name, duration, note count, track count, pitch range, BPM, and capped preview-note metadata.

Current `/generate` response shape:

```json
{
  "packId": "uuid",
  "name": "Ice Pack",
  "source": "FACTORY",
  "type": "MELODY",
  "bpm": 146,
  "pitch": 0,
  "octaves": 1,
  "amount": 10,
  "createdAt": "2026-07-03T12:00:00Z",
  "packDownloadUrl": "https://files.example/generated_midi/pack.zip",
  "downloadUrl": "https://files.example/generated_midi/pack.zip",
  "totalGenerations": 123,
  "items": [
    {
      "id": "uuid",
      "index": 0,
      "fileName": "icepunk_001.mid",
      "downloadUrl": "https://files.example/generated_midi_items/item.mid",
      "durationSeconds": 8.5,
      "noteCount": 42,
      "trackCount": 1,
      "minPitch": 36,
      "maxPitch": 84,
      "avgPitch": 55.2,
      "bpm": 146,
      "preview": {
        "notes": [
          { "pitch": 60, "start": 0.0, "duration": 0.5, "velocity": 90 }
        ],
        "truncated": false
      }
    }
  ]
}
```

Architecture:

```text
POST /generate
-> selected analysis source (FACTORY or CUSTOM_UPLOAD)
-> Python generator
-> local generated MIDI files
-> MIDI metadata extractor
-> individual MIDI uploads under generated_midi_items/
-> ZIP upload under generated_midi/
-> generated_packs row
-> generated_pack_items rows
-> structured response for the frontend modal
```

Current limitations: generated packs are public download artifacts; credits, private paid downloads, favorites, ratings, social feed ranking, and permanent custom dataset saving are intentionally left for later phases.

## Production Backend Docker

The production backend image is built from the repository root because it needs:

- `backend/` Spring Boot source
- `python/` MIDI generation/analysis engine
- `analysis_output/midi_analysis.json`

Build manually:

```bash
docker build -f backend/Dockerfile -t icepunk-backend .
```

Or run the production stack with Postgres, MinIO, backend, and frontend:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

## Production Env Variables

Create `.env.production` on the VPS. Do not commit it.

Required for `docker-compose.production.yml`:

```env
POSTGRES_DB=icepunk
POSTGRES_USER=icepunk
POSTGRES_PASSWORD=change_this_postgres_password

MINIO_ROOT_USER=change_this_minio_user
MINIO_ROOT_PASSWORD=change_this_minio_password

JWT_SECRET=change_this_to_a_long_random_secret_at_least_32_chars
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com

S3_BUCKET=icepunk-zips
S3_PUBLIC_URL=https://your-files-domain.com/icepunk-zips

BACKEND_PORT=8081
FRONTEND_PORT=3000
MINIO_API_PORT=9010
MINIO_CONSOLE_PORT=9011

SPRING_JPA_HIBERNATE_DDL_AUTO=update
JWT_EXPIRATION=86400000
ICEPUNK_GENERATOR_TIMEOUT_SECONDS=60
ICEPUNK_GENERATOR_MAX_CONCURRENT=2
GENERATED_ZIP_RETENTION_DAYS=2
S3_REGION=eu-central-1
```

If you use external PostgreSQL or external S3 instead of the included compose services, set these backend env variables in your hosting/runtime:

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://host:5432/db
SPRING_DATASOURCE_USERNAME=prod_user
SPRING_DATASOURCE_PASSWORD=prod_password
S3_ENDPOINT=https://s3-compatible-endpoint
S3_BUCKET=icepunk-zips
S3_ACCESS_KEY=prod_access_key
S3_SECRET_KEY=prod_secret_key
S3_PUBLIC_URL=https://public-download-domain/icepunk-zips
```

The Docker image already sets:

```env
ICEPUNK_GENERATOR_PROJECT_DIR=/app
ICEPUNK_GENERATOR_PYTHON_PATH=/app/venv/bin/python3
ICEPUNK_GENERATOR_SCRIPT_NAME=python/generate_midi.py
ICEPUNK_TEMP_ANALYZER_SCRIPT_NAME=python/temp_analyzer.py
```

Required for frontend production build/runtime:

```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
RESEND_API_KEY=your_resend_key
FEEDBACK_TO_EMAIL=you@example.com
FEEDBACK_FROM_EMAIL=IcePunk <feedback@your-domain.com>
```

`NEXT_PUBLIC_API_URL` is baked into the Next.js client bundle at build time. Set it before `npm run build`.

## VPS Deployment Steps

1. Install Docker and Docker Compose plugin.

2. Clone the repository:

```bash
git clone git@github.com:stickd/icepunk-midi-generator.git
cd icepunk-midi-generator
```

3. Create `.env.production` with the production values above.

4. Start Postgres, MinIO, backend, and frontend:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

5. Check backend logs:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs -f backend
```

6. Verify backend:

```bash
curl https://your-backend-domain.com/generation-stats
```

7. If you deploy frontend separately, build it with `NEXT_PUBLIC_API_URL=https://your-backend-domain.com`.

For a VPS-hosted frontend:

```bash
cd frontend
npm ci
NEXT_PUBLIC_API_URL=https://your-backend-domain.com npm run build
npm run start
```

8. Put a reverse proxy such as Nginx/Caddy in front of:

- backend container port `8081`
- frontend port `3000`
- optional MinIO public files endpoint if you use local MinIO for downloads

9. Smoke test:

- register
- login
- guest generate
- logged-in generate
- ZIP download
- upload a public MIDI project with a one-shot sample
- public feed shows the uploaded project
- global counter update
- feedback form
- backend restart keeps generation counter

## Database Migrations

Schema is managed by [Flyway](https://flywaydb.org/). Migration files live in `backend/src/main/resources/db/migration/` and follow the naming convention `V{version}__{description}.sql`.

### Profile behaviour

| Profile | `ddl-auto` | Flyway |
|---|---|---|
| *(none / default)* | `update` (env var) | enabled |
| `local` | `update` | enabled, baseline mode |
| `test` | `create-drop` | disabled (H2 in-memory) |
| `prod` | `validate` | enabled, strict |

### Running with a profile

```bash
# local profile (recommended for development)
cd backend
SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run
```

### Introducing Flyway to an existing local database

If you already have a database created by a previous `ddl-auto=update` run, use the `local` profile. It sets `baseline-on-migrate=true` and `baseline-version=1`, which marks the existing schema as V1 without re-running the migration.

### First production deploy onto an existing database

> **One-time step.** Required before the first deploy of the `prod` profile onto a database that was previously created by Hibernate (`ddl-auto=update`).

The `prod` profile runs Flyway in strict mode (`baseline-on-migrate=false`). If the production database already has tables but no `flyway_schema_history` table, Flyway aborts on startup with *"Found non-empty schema(s) without schema history table"* and the backend never comes up.

Pick one before the first `prod` deploy:

1. **Baseline the existing schema (recommended).** For the first deploy only, start the backend once with `SPRING_FLYWAY_BASELINE_ON_MIGRATE=true` and `SPRING_FLYWAY_BASELINE_VERSION=1`. This stamps the current schema as V1 without re-running it. Remove both env vars for subsequent deploys.
2. **Manual baseline.** Run `flyway baseline -baselineVersion=1` against the prod database out-of-band, then deploy normally.
3. **Fresh database.** If the prod database is empty (or you recreate the volume), V1 applies cleanly and no baseline is needed.

### Adding a new migration

1. Create `backend/src/main/resources/db/migration/V{next}__{description}.sql`
2. Never modify an already-applied migration file
3. Test the migration locally before merging

## Notes

- `analysis_output/midi_analysis.json` is required at runtime by the Python generator.
- The production compose creates the MinIO bucket and sets anonymous download access for ZIP files.
- For real production, rotate any secrets that were ever committed to git history.
- The production Spring profile (`prod`) must be activated by setting `SPRING_PROFILES_ACTIVE=prod` in the deployment environment or compose file.
