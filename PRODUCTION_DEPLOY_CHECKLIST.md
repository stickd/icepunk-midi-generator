# IcePunk production deploy checklist

## DNS

- [ ] Point frontend domain to the frontend host.
- [ ] Point backend API domain to the VPS reverse proxy.
- [ ] Point file/download domain or path to the VPS reverse proxy for MinIO object downloads.
- [ ] Confirm DNS propagation before switching real users.

## SSL

- [ ] Install SSL certificates for frontend, backend API, and download domain/path.
- [ ] Enable HTTP to HTTPS redirect.
- [ ] Renew certificates automatically.
- [ ] Test TLS with a browser and an external SSL checker.

## Backend

- [ ] Build backend Docker image successfully.
- [ ] Run backend container as a non-root user.
- [ ] Bind backend only to localhost when using nginx: `BACKEND_BIND_ADDRESS=127.0.0.1`.
- [ ] Set `CORS_ALLOWED_ORIGINS` to the exact frontend origin.
- [ ] Set `SPRING_JPA_HIBERNATE_DDL_AUTO=update` for first launch, then plan migrations before heavier usage.
- [ ] Confirm `/generate`, `/generation-stats`, `/auth/register`, and `/auth/login` work through the public API domain.
- [ ] Confirm busy generator responses do not increment usage.

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

- [ ] Keep MinIO console bound to localhost or behind private VPN/SSH tunnel.
- [ ] Use strong `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`.
- [ ] Confirm bucket exists and anonymous download is enabled only for generated ZIP objects.
- [ ] Set `S3_PUBLIC_URL` to the real HTTPS download URL.
- [ ] Confirm generated ZIP download URLs work from a browser.

## Environment Variables

- [ ] `POSTGRES_DB`
- [ ] `POSTGRES_USER`
- [ ] `POSTGRES_PASSWORD`
- [ ] `MINIO_ROOT_USER`
- [ ] `MINIO_ROOT_PASSWORD`
- [ ] `JWT_SECRET`
- [ ] `JWT_EXPIRATION`
- [ ] `CORS_ALLOWED_ORIGINS`
- [ ] `S3_BUCKET`
- [ ] `S3_PUBLIC_URL`
- [ ] `BACKEND_BIND_ADDRESS`
- [ ] `BACKEND_PORT`
- [ ] `MINIO_BIND_ADDRESS`
- [ ] `MINIO_API_PORT`
- [ ] `MINIO_CONSOLE_BIND_ADDRESS`
- [ ] `MINIO_CONSOLE_PORT`
- [ ] `ICEPUNK_GENERATOR_TIMEOUT_SECONDS`
- [ ] `ICEPUNK_GENERATOR_MAX_CONCURRENT`
- [ ] `NEXT_PUBLIC_API_URL`
- [ ] `RESEND_API_KEY`
- [ ] `FEEDBACK_TO_EMAIL`
- [ ] `FEEDBACK_FROM_EMAIL`

## Security

- [ ] Rotate any secret that was ever committed to git history.
- [ ] Confirm `.env*` files are not tracked.
- [ ] Confirm nginx overwrites or strips untrusted `X-Forwarded-For` headers.
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
- [ ] Download URL domain/path returns generated ZIP files through HTTPS.
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
