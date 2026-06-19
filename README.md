# iCEPUNK MIDI Generator

Full-stack MIDI pack generator for dark, cold melodic loops inspired by the iCEPUNK sound. The app combines a Python MIDI pattern engine, a Spring Boot API, and a Next.js frontend.

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
midi_dataset/             Local MIDI source files, ignored by git
generated_midi/           Generated output, ignored by git
analysis_output/          Analyzer output, ignored by git
icepunk_midi_generator.py MIDI generation engine
icepunk_midi_analyzer.py  Dataset analysis helper
```

## Requirements

- Java 21
- Node.js 20+
- Python 3.10+
- Docker or compatible container runtime

## Local Setup

1. Start PostgreSQL and MinIO:

```bash
docker compose up -d
```

2. Create and activate a Python virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

3. Add MIDI files to `midi_dataset/`.

4. Copy environment defaults and adjust paths if needed:

```bash
cp .env.example .env
```

For the backend, either export the variables from `.env` or configure them in your IDE/run profile. The most important values are `ICEPUNK_GENERATOR_PROJECT_DIR` and `ICEPUNK_GENERATOR_PYTHON_PATH`.

5. Run the backend:

```bash
cd backend
./mvnw spring-boot:run
```

6. Run the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## API

- `POST /generate` creates a new MIDI pack and returns `{ "downloadUrl": "..." }`.
- `POST /auth/register` creates a user account.
- `POST /auth/login` returns a JWT token.

Guests have a small daily generation limit. Logged-in users have a higher daily limit.

## Notes

The Python generator needs a populated `midi_dataset/` folder. Generated `.mid` and `.zip` files are intentionally ignored by git.
