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
icepunk_midi_generator.py MIDI generation engine
icepunk_midi_analyzer.py  Dataset analysis helper
requirements.txt          Python generator dependencies
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
pip install -r requirements.txt
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

- `POST /generate` creates a MIDI ZIP and returns `{ "downloadUrl": "...", "totalGenerations": 123 }`.
- `GET /generation-stats` returns `{ "totalGenerations": 123 }`.
- `POST /auth/register` creates a user account and returns a JWT token.
- `POST /auth/login` returns a JWT token.

Guests and logged-in users have daily generation limits. Usage is counted only after successful MIDI generation and successful ZIP upload.

## Production Backend Docker

The production backend image is built from the repository root because it needs:

- `backend/` Spring Boot source
- `icepunk_midi_generator.py`
- `analysis_output/midi_analysis.json`
- `requirements.txt`

Build manually:

```bash
docker build -f backend/Dockerfile -t icepunk-backend .
```

Or run backend + Postgres + MinIO with:

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
MINIO_API_PORT=9010
MINIO_CONSOLE_PORT=9011

SPRING_JPA_HIBERNATE_DDL_AUTO=update
JWT_EXPIRATION=86400000
ICEPUNK_GENERATOR_TIMEOUT_SECONDS=60
ICEPUNK_GENERATOR_MAX_CONCURRENT=2
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
ICEPUNK_GENERATOR_SCRIPT_NAME=icepunk_midi_generator.py
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

4. Start backend infrastructure and API:

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

7. Deploy frontend with `NEXT_PUBLIC_API_URL=https://your-backend-domain.com`.

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
- global counter update
- feedback form
- backend restart keeps generation counter

## Notes

- `analysis_output/midi_analysis.json` is required at runtime by the Python generator.
- The production compose creates the MinIO bucket and sets anonymous download access for ZIP files.
- For real production, rotate any secrets that were ever committed to git history.
