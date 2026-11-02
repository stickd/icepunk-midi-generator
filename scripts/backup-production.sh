#!/usr/bin/env bash
set -euo pipefail

# Creates a custom-format PostgreSQL dump, mirrors MinIO to an off-host
# S3-compatible target, and uploads the dump to the same target. Run via cron
# or a systemd timer from the repository root on the production host.
readonly compose_file="docker-compose.production.yml"
readonly env_file=".env.production"

[[ -f "$env_file" ]] || { echo "Missing $env_file" >&2; exit 1; }
compose=(docker compose --env-file "$env_file" -f "$compose_file")
compose_environment="$("${compose[@]}" config --environment)"
read_env() { awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' <<< "$compose_environment"; }

POSTGRES_DB="$(read_env POSTGRES_DB)"
POSTGRES_USER="$(read_env POSTGRES_USER)"
BACKUP_LOCAL_DIR="$(read_env BACKUP_LOCAL_DIR)"
BACKUP_RETENTION_DAYS="$(read_env BACKUP_RETENTION_DAYS)"
required=(POSTGRES_DB POSTGRES_USER BACKUP_LOCAL_DIR BACKUP_RETENTION_DAYS BACKUP_S3_ENDPOINT BACKUP_S3_ACCESS_KEY BACKUP_S3_SECRET_KEY BACKUP_S3_BUCKET S3_ACCESS_KEY S3_SECRET_KEY)
for name in "${required[@]}"; do
  value="$(read_env "$name")"
  [[ -n "$value" ]] || { echo "Required backup variable is missing: $name" >&2; exit 1; }
done

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="${BACKUP_LOCAL_DIR%/}/postgres"
mkdir -p "$backup_dir"
database_file="$backup_dir/icepunk-${timestamp}.dump"

trap 'rm -f "$database_file"' ERR
"${compose[@]}" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges > "$database_file"

# The operations profile runs inside the private Docker network. mirror-minio
# does not use --remove, so retention cannot delete remote object history.
"${compose[@]}" --profile operations run --rm backup

"${compose[@]}" --profile operations run --rm --no-deps \
  --entrypoint /bin/sh -e BACKUP_DATABASE_FILE="/backups/postgres/$(basename "$database_file")" backup -ec '
    mc alias set backup "$BACKUP_S3_ENDPOINT" "$BACKUP_S3_ACCESS_KEY" "$BACKUP_S3_SECRET_KEY"
    mc cp "$BACKUP_DATABASE_FILE" "backup/$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX/postgres/"
  '

find "$backup_dir" -type f -name '*.dump' -mtime "+${BACKUP_RETENTION_DAYS}" -delete
echo "Backup completed: $(basename "$database_file")"
