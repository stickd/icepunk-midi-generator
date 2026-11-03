#!/usr/bin/env bash
set -euo pipefail

# Intentionally refuses the production project. Restore only into an isolated
# Compose project while performing a drill or incident recovery rehearsal.
[[ "${1:-}" == "--isolated" ]] || { echo "Usage: $0 --isolated path/to/backup.dump" >&2; exit 2; }
dump_file="${2:-}"
[[ -f "$dump_file" ]] || { echo "Backup dump not found: $dump_file" >&2; exit 2; }
[[ "${COMPOSE_PROJECT_NAME:-}" == icepunk-restore-* ]] || {
  echo "Set COMPOSE_PROJECT_NAME to an isolated name beginning icepunk-restore-" >&2; exit 2;
}
[[ "${ICEPUNK_RESTORE_CONFIRM:-}" == "YES" ]] || {
  echo "Set ICEPUNK_RESTORE_CONFIRM=YES after confirming this is an isolated target." >&2; exit 2;
}

readonly compose_file="${RESTORE_COMPOSE_FILE:-docker-compose.production.yml}"
readonly env_file="${RESTORE_ENV_FILE:-.env.restore}"
[[ -f "$env_file" ]] || { echo "Missing isolated restore environment: $env_file" >&2; exit 2; }

docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
  pg_restore -U "${POSTGRES_USER:-icepunk}" -d "${POSTGRES_DB:-icepunk}" --clean --if-exists --no-owner --no-privileges < "$dump_file"
echo "Database restore completed. Restore MinIO with the documented isolated mc mirror step."
