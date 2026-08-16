# IcePunk production deploy checklist

## DNS

- [ ] Point frontend domain to the frontend host.
- [ ] Point backend API domain to the VPS reverse proxy.
- [ ] Point backend API domain to the VPS reverse proxy for file download endpoints.
- [ ] Confirm DNS propagation before switching real users.

## SSL

- [ ] Install SSL certificates for frontend, backend API, and download domain/path.
- [ ] Enable HTTP to HTTPS redirect.
- [ ] Renew certificates automatically.
- [ ] Test TLS with a browser and an external SSL checker.

## Backend

- [ ] Build backend Docker image successfully (build context is the **repo root**, not `backend/` — the image needs `python/` and `analysis_output/`).
- [ ] Run backend container as a non-root user (already default in `backend/Dockerfile`).
- [ ] Bind backend only to localhost when using nginx: `BACKEND_BIND_ADDRESS=127.0.0.1`.
- [ ] Set `CORS_ALLOWED_ORIGINS` to the exact frontend origin.
- [ ] Set `SPRING_PROFILES_ACTIVE=prod` explicitly (activates `ddl-auto=validate` + strict Flyway; see [README.md § Database Migrations](../README.md#database-migrations) for the one-time baseline step on an existing database).
- [ ] Set a real `JWT_SECRET` (≥32 random chars) — the `prod` profile has **no fallback default** and fails startup if it's unset.
- [ ] Confirm `/generate`, `/generation-stats`, `/generation-usage`, `/auth/register`, and `/auth/login` work through the public API domain.
- [ ] Confirm the newer surface also works: `/datasets/analyze-temp`, `/datasets` (save/list/delete a preset while logged in), `/generated-packs/feed`, `/users/me/generated-packs`, pack rename/visibility/delete, `/users/{username}/profile`, `/users/me/favorites`.
- [ ] Confirm busy generator responses do not increment usage.
- [ ] Confirm `/actuator/health` responds (used by the Docker healthcheck and CI polling).

## Frontend

- [ ] Set `NEXT_PUBLIC_API_URL` before production build.
- [ ] Set `RESEND_API_KEY`, `FEEDBACK_TO_EMAIL`, and `FEEDBACK_FROM_EMAIL` if hosting the contact API.
- [ ] Run `npm run build`.
- [ ] Confirm auth, generate, download, feedback form, and generation counter in production.
- [ ] Confirm no secrets are exposed in the frontend bundle.

## PostgreSQL

- [ ] Keep PostgreSQL port closed to the public internet.
- [ ] Use a strong `POSTGRES_PASSWORD`.
- [ ] Confirm `postgres_data` volume exists and persists after restart.
- [ ] Create a backup script before launch.
- [ ] Test restore from backup on a separate database.

## MinIO

- [ ] Keep MinIO API and console bound to localhost or behind private VPN/SSH tunnel.
- [ ] Use strong `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`.
- [ ] Confirm bucket exists and anonymous download is disabled.
- [ ] Confirm generated ZIP/MIDI download URLs work through backend endpoints.

## Environment Variables

Core:

- [ ] `POSTGRES_DB`
- [ ] `POSTGRES_USER`
- [ ] `POSTGRES_PASSWORD`
- [ ] `MINIO_ROOT_USER`
- [ ] `MINIO_ROOT_PASSWORD`
- [ ] `JWT_SECRET` (required in `prod` — no fallback)
- [ ] `JWT_EXPIRATION`
- [ ] `CORS_ALLOWED_ORIGINS`
- [ ] `SPRING_PROFILES_ACTIVE=prod`
- [ ] `S3_BUCKET`
- [ ] `S3_REGION`
- [ ] `BACKEND_BIND_ADDRESS`
- [ ] `BACKEND_PORT`
- [ ] `FRONTEND_BIND_ADDRESS`
- [ ] `FRONTEND_PORT`
- [ ] `MINIO_BIND_ADDRESS`
- [ ] `MINIO_API_PORT`
- [ ] `MINIO_CONSOLE_BIND_ADDRESS`
- [ ] `MINIO_CONSOLE_PORT`

Generation / storage lifecycle:

- [ ] `ICEPUNK_GENERATOR_TIMEOUT_SECONDS`
- [ ] `ICEPUNK_GENERATOR_MAX_CONCURRENT`
- [ ] `GENERATED_ZIP_RETENTION_DAYS` (default 2 — age-based sweep of `generated_midi/` only, not reference-checked; see [ARCHITECTURE.md § Storage & Lifecycle](codex/ARCHITECTURE.md#storage--lifecycle))
- [ ] `DATASETS_TEMP_DIR`
- [ ] `DATASETS_TEMP_MIDI_MAX_SIZE_BYTES` (default 2MB per file)
- [ ] `DATASETS_TEMP_RETENTION_HOURS` (default 24)

Uploads (user MIDI projects, separate from generation):

- [ ] `UPLOADS_MIDI_MAX_SIZE_BYTES`
- [ ] `UPLOADS_SAMPLE_MAX_SIZE_BYTES`
- [ ] `UPLOADS_MULTIPART_MAX_FILE_SIZE` (must stay ≥ the largest single part you allow)
- [ ] `UPLOADS_MULTIPART_MAX_REQUEST_SIZE` (must cover 100 files × the per-file MIDI cap — raised to 220MB when the custom-upload limit went from 8 to 100 files; if either limit changes again, this must move with it)

S3 client tuning (defaults are usually fine):

- [ ] `S3_CONNECTION_TIMEOUT_SECONDS`, `S3_SOCKET_TIMEOUT_SECONDS`, `S3_API_CALL_TIMEOUT_SECONDS`, `S3_API_CALL_ATTEMPT_TIMEOUT_SECONDS`

Frontend:

- [ ] `NEXT_PUBLIC_API_URL`
- [ ] `RESEND_API_KEY`
- [ ] `FEEDBACK_TO_EMAIL`
- [ ] `FEEDBACK_FROM_EMAIL`

## Security

- [ ] Rotate any secret that was ever committed to git history.
- [ ] Confirm `.env*` files are not tracked.
- [ ] Set `TRUSTED_PROXY_CIDRS` to the exact CIDR(s) that can connect directly to the backend (for example, the Docker/nginx network). The prod profile refuses to start without it.
- [ ] Configure nginx to append, never pass through, forwarding headers:
  ```nginx
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Host $host;
  ```
  Do not expose backend port 8081 publicly. The application ignores all forwarded headers unless the TCP peer matches `TRUSTED_PROXY_CIDRS`.
- [ ] This deployment uses an in-memory auth limiter and is supported as a **single backend instance**. A horizontally scaled deployment must replace it with a shared Redis/database limiter before enabling more replicas.
- [ ] Keep only ports `80` and `443` public.
- [ ] Enable firewall rules.
- [ ] Add fail2ban or equivalent SSH protection.
- [ ] Add CAPTCHA/Turnstile to registration before larger traffic.

## Monitoring

- [ ] Configure Docker log rotation.
- [ ] Monitor CPU, RAM, disk, and container restarts.
- [ ] Add uptime checks for frontend and backend API.
- [ ] Watch backend logs during first real user tests.
- [ ] Set disk usage alerts for PostgreSQL and MinIO volumes.

## Backup

- [ ] Schedule PostgreSQL backups.
- [ ] Schedule MinIO data backups or VPS volume snapshots.
- [ ] Store backups outside the VPS.
- [ ] Test restore before launch.
- [ ] Document rollback steps.

## Domain

- [ ] Frontend domain opens the landing page.
- [ ] API domain returns backend responses through HTTPS.
- [ ] Backend download endpoints return generated ZIP/MIDI files through HTTPS.
- [ ] CORS allows frontend domain and rejects unknown origins.

## First User Test

- [ ] Register a new account.
- [ ] Login.
- [ ] Generate as guest.
- [ ] Generate as logged-in user.
- [ ] Download ZIP.
- [ ] Submit feedback.
- [ ] Confirm generation counter increments.
- [ ] Confirm daily limits work.
- [ ] Restart backend and confirm data persists.

## Load Test

- [ ] Test 2 concurrent generations.
- [ ] Test requests above `ICEPUNK_GENERATOR_MAX_CONCURRENT` return busy responses.
- [ ] Watch CPU and RAM during generation.
- [ ] Confirm failed/busy generations do not increment usage or global counter.
- [ ] Keep `ICEPUNK_GENERATOR_MAX_CONCURRENT=1` on very small VPS instances.
