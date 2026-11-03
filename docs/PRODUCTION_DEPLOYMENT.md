# ICEPUNK production deployment runbook

This runbook deploys the public beta with Docker Compose, Caddy, PostgreSQL,
Redis and MinIO on one VPS. It is intentionally a single-host design: all
business data is persisted in named volumes and copied off-host daily.

## 1. Provision the VPS

Install Docker Engine plus the Compose plugin, clone a tagged ICEPUNK release,
and copy `.env.production.example` to `.env.production` with mode `600`.
Use a supported VPS with at least 2 CPU cores, 4 GB RAM and enough SSD for
PostgreSQL, MinIO and 14 days of local database dumps. For a smaller host, set
`ICEPUNK_GENERATOR_MAX_CONCURRENT=1` (the production example already does).

Allow only TCP `80`, `443`, and SSH from administrative IPs in the host firewall:

```sh
ufw allow from <admin-ip-or-vpn> to any port 22 proto tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Do not expose `3000`, `5432`, `6379`, `8081`, `9010`, or `9011`. Compose binds
app and MinIO ports to `127.0.0.1`; PostgreSQL and Redis have no host port.

## 2. DNS, TLS and domains

Create A/AAAA records for `APP_DOMAIN`, `API_DOMAIN`, and `FILES_DOMAIN` before
starting Caddy. Set the corresponding HTTPS URLs in `FRONTEND_URL`,
`CORS_ALLOWED_ORIGINS`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STORAGE_ORIGIN`, and
`S3_PRESIGN_ENDPOINT`. Caddy obtains/renews certificates and redirects HTTP to
HTTPS. Its versioned config routes the app, API, and MinIO API only; it never
routes the MinIO console.

The Caddy container is on `icepunk-prod-backend`, therefore set
`TRUSTED_PROXY_CIDRS=172.30.0.0/24`. Do not replace this with `0.0.0.0/0`.
Caddy overwrites forwarding headers with the direct client address before it
forwards requests; the backend accepts them only from this private CIDR.

Validate configuration before starting:

```sh
docker compose --env-file .env.production -f docker-compose.production.yml config
docker compose --env-file .env.production -f docker-compose.production.yml build
```

## 3. Generate and configure secrets

Use distinct values (never template placeholders):

```sh
openssl rand -base64 48        # JWT_SECRET, database and MinIO secrets
openssl rand -hex 24           # S3_ACCESS_KEY
```

`MINIO_ROOT_*` bootstrap MinIO only. `S3_ACCESS_KEY` / `S3_SECRET_KEY` are the
backend-only application credentials, restricted to the configured bucket.
Production startup rejects short and obvious placeholder JWT, database, and S3
secrets. Never put `RESEND_API_KEY`, backup keys, or any secret in `NEXT_PUBLIC_*`.

## 4. Start and verify

```sh
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=100 create-minio-bucket backend caddy
```

The bootstrap job creates the bucket, forces anonymous access to `none`, creates
the least-privilege app policy/user, and exits. The production backend refuses to
start if the bucket is missing or an anonymous Allow policy is detected. Flyway
must complete before treating the API as ready.

Smoke test after DNS/TLS are live (replace domains):

```sh
curl -fsSI https://app.example.de/
curl -fsS https://api.example.de/actuator/health
curl -fsSI https://files.example.de/minio/health/live
```

Register a test account, verify its email, log in, generate a MIDI pack and
download it. Also verify a direct unsigned object URL returns 401/403 while the
app's short-lived presigned download works.

## 5. Backups and restore drills

Set a separate provider/bucket in the `BACKUP_S3_*` fields. This destination
must be off-host and should provide encryption at rest (or be encrypted before
upload by an operator-managed process). The daily job creates a PostgreSQL custom
dump, mirrors MinIO without remote deletion, uploads the dump, and retains local
dumps for `BACKUP_RETENTION_DAYS`:

```cron
17 2 * * * cd /srv/icepunk && ./scripts/backup-production.sh >> /var/log/icepunk-backup.log 2>&1
```

The job exits non-zero if a required destination variable, dump, or mirror fails;
the scheduler/monitor must alert on a non-zero exit. Configure the backup remote
as write-only for this job where the provider supports it.

At least before launch and quarterly thereafter, perform an isolated restore
drill. Start a separate project with alternate ports, volumes, domains and
`.env.restore`, then restore the selected dump:

```sh
COMPOSE_PROJECT_NAME=icepunk-restore-20261102 \
ICEPUNK_RESTORE_CONFIRM=YES RESTORE_ENV_FILE=.env.restore \
./scripts/restore-production.sh --isolated backups/postgres/icepunk-<timestamp>.dump
```

Use an `mc mirror` inside that isolated Compose network to copy
`backup/<bucket>/<prefix>/minio` back to its isolated MinIO bucket. Verify a test
user, verification state, pack metadata, object existence and a signed download.
Never run the restore script against the `icepunk-prod` project.

## 6. Monitoring and disk protection

Docker logs are rotated at 10 MB × 5 files per service. Monitor Caddy/frontend
uptime, `https://API_DOMAIN/actuator/health`, container restarts/CPU/RAM, and
host plus PostgreSQL/MinIO volume disk usage. Uptime Kuma, an external uptime
service, and the VPS provider's CPU/RAM/disk alerts are sufficient for public
beta. Alert on failed backup cron jobs and on backend logs containing storage,
Redis, email, or generator failures. User-facing errors stay generic.

Temporary analysis data at `/app/temp_analysis` is intentionally disposable:
it is intermediate/reproducible, expires after `DATASETS_TEMP_RETENTION_HOURS`,
and is removed by the scheduled cleanup. A container recreation can discard
in-progress analysis but cannot corrupt PostgreSQL or MinIO data.

## 7. Release and rollback

Build and deploy immutable release images tagged with the Git SHA, for example
`icepunk-backend:<sha>` and `icepunk-frontend:<sha>`, and retain the last known
good pair. Base images are pinned to explicit stable versions; digest pinning can
be added when an image-update process is in place.

Before each deployment, run the backup job and record the image SHA. If an image
release fails, deploy the prior image tags and run smoke tests. Docker image
rollback does **not** roll back Flyway migrations: assess migration compatibility;
use a forward fix whenever possible, or restore the pre-deploy database backup
only during a controlled incident. Do not delete named volumes during rollback.

## 8. Final production checklist

1. `docker compose ... config` and `build` pass with real production values.
2. Only 80/443 are reachable externally; verify with `ss -ltnp` and a remote scan.
3. DNS, Caddy TLS, CORS, CSP and MinIO presigned URLs use the exact HTTPS domains.
4. Bootstrap uses dedicated S3 app credentials; backend never receives MinIO root credentials.
5. A successful off-host backup and isolated restore drill are recorded.
6. Monitoring/alerts are configured and the backup cron is installed.
