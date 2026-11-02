#!/bin/sh
set -eu

until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
  echo 'Waiting for MinIO...'
  sleep 2
done

mc mb --ignore-existing "local/$S3_BUCKET"
sed "s|__S3_BUCKET__|$S3_BUCKET|g" /bootstrap/icepunk-app-policy.json > /tmp/icepunk-app-policy.json
mc admin policy create local icepunk-app-policy /tmp/icepunk-app-policy.json || \
  mc admin policy update local icepunk-app-policy /tmp/icepunk-app-policy.json
mc admin user add local "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
mc admin policy attach local icepunk-app-policy --user "$S3_ACCESS_KEY"

# An explicitly private policy is idempotent and protects an existing volume
# from accidental anonymous read/write exposure.
mc anonymous set none "local/$S3_BUCKET"
