# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (run from `backend/`)
```bash
./mvnw spring-boot:run                            # start backend (default profile)
SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run  # recommended for local dev
./mvnw clean verify                               # compile + run all tests
./mvnw test -Dtest=GenerationLimitServiceTest     # run a single test class
./mvnw clean package -DskipTests                  # build JAR without tests
```

### Frontend (run from `frontend/`)
```bash
npm run dev        # start Next.js dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit (TypeScript validation)
npm run lint       # ESLint
npm run test       # Jest unit tests
npm run test:watch # Jest in watch mode
npm run e2e        # Playwright end-to-end tests
```

### Infrastructure (run from repo root)
```bash
docker compose up -d                                                          # start postgres + minio locally
docker compose down                                                           # stop local infra
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build  # production deploy
docker build -f backend/Dockerfile -t icepunk-backend .                      # build backend image
```

### Python MIDI engine (run from repo root)
```bash
python3 -m venv venv && source venv/bin/activate
pip install -r python/requirements.txt
cd python && python -m pytest tests/ -m "not slow"    # unit tests
```

## Architecture

### Request flow for `/generate`
`GenerateController` is the core of the application. For each generation request:
1. Resolve caller identity (guest IP via `ClientIpService`, or JWT principal → `UserRepository`)
2. **Check** daily limit (read-only transaction) — throws `GenerationLimitException` before touching the engine
3. Run Python MIDI generator as a subprocess via `MidiGenerationService` (semaphore-guarded, max 2 concurrent)
4. Upload the resulting ZIP to MinIO/S3 via `ZipStorageService`
5. **Increment** usage counter and global total (separate write transactions, with `SELECT FOR UPDATE`) — only after successful upload
6. Delete the local ZIP file; return `{ downloadUrl, totalGenerations }`

Usage is **not** incremented on failed generations or failed uploads — the check/increment split is intentional and tested.

### Generation limits
- Guest (by IP): 5/day — `GuestUsage` table, enforced with `SELECT ... FOR UPDATE` in `GenerationLimitService`
- Registered user: unlimited by design — generation is free; `GenerationLimitService.checkUserLimit`/`incrementUserUsage` are intentionally no-ops. `User.generationsToday`/`generationDate` fields exist but are not read by the limit check. Credits (`User.credits`) are reserved for a future "keep private" feature, not generation quota.
- Concurrent: max 2 simultaneous Python subprocesses (`Semaphore` in `MidiGenerationService`)

### Auth
Stateless JWT. `JwtAuthFilter` validates the `Authorization: Bearer` header on every request. Public endpoints (no token required): `POST /auth/register`, `POST /auth/login`, `POST /generate`, `GET /generation-stats`. All other endpoints require authentication.

Passwords are BCrypt-hashed. JWT secret is configured via `JWT_SECRET` env var.

### Spring profiles
| Profile | When active | ddl-auto | Flyway |
|---|---|---|---|
| *(none)* | default local run | `update` (env var) | enabled |
| `local` | `SPRING_PROFILES_ACTIVE=local` | `update` | baseline mode (safe for pre-existing DBs) |
| `test` | auto-activated by `src/test/resources/application.properties` | `create-drop` (H2) | disabled |
| `prod` | must be set explicitly in production | `validate` | strict |

Flyway migrations: `backend/src/main/resources/db/migration/V{n}__{description}.sql`. Never modify applied migrations.

### Exception → HTTP mapping
`GlobalExceptionHandler` (@RestControllerAdvice) maps:
- `GenerationLimitException` / `RateLimitException` / `ServerBusyException` → 429
- `InvalidCredentialsException` → 401
- `EmailAlreadyExistsException` / `UsernameAlreadyExistsException` / `DataIntegrityViolationException` → 409
- `MethodArgumentNotValidException` → 400 with field-level errors
- Any other `RuntimeException` → 500 (no detail leaked)

### Infrastructure
- **Local** (`docker-compose.yml`): PostgreSQL on port 5433, MinIO API on 9010, MinIO console on 9011. Backend runs directly via `./mvnw`, not in Docker.
- **Production** (`docker-compose.production.yml`): All services including backend in Docker. Requires `.env.production`. Postgres has a health check; backend waits on it before starting.
- Backend image is built from repo root (not `backend/`) because it needs `python/` (MIDI engine) and `analysis_output/`.

### Frontend
> **Warning:** This project uses Next.js 16, which has breaking API and convention changes relative to older versions. Before writing any Next.js-specific code (routing, data fetching, config), read the relevant guide in `frontend/node_modules/next/dist/docs/`.

Frontend communicates with the backend via `NEXT_PUBLIC_API_URL`. In local dev, set this in `frontend/.env.local`. For production builds, it must be set at build time (it is baked into the client bundle).

### Testing approach
Backend service and controller tests use plain Mockito (no Spring context, no database). The `@SpringBootTest` context test uses H2 in-memory via the `test` profile. Add new service tests without `@SpringBootTest` where possible to keep them fast.