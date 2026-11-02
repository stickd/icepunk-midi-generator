#!/bin/sh
set -eu

mc alias set local http://minio:9000 "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
mc alias set backup "$BACKUP_S3_ENDPOINT" "$BACKUP_S3_ACCESS_KEY" "$BACKUP_S3_SECRET_KEY"

# --remove is intentionally not used: a backup must never delete an object at
# the remote destination merely because a lifecycle task removed it locally.
mc mirror --overwrite "local/$S3_BUCKET" "backup/$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX/minio"
