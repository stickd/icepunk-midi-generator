#!/bin/sh
set -eu

until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
  echo 'Waiting for MinIO...'
  sleep 2
done

mc mb --ignore-existing "local/$S3_BUCKET"
cat > /tmp/icepunk-app-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetBucketLocation", "s3:ListBucket", "s3:GetBucketPolicy"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET/*"]
    }
  ]
}
EOF
mc admin policy create local icepunk-app-policy /tmp/icepunk-app-policy.json || \
  mc admin policy update local icepunk-app-policy /tmp/icepunk-app-policy.json
mc admin user add local "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
mc admin policy attach local icepunk-app-policy --user "$S3_ACCESS_KEY"

# An explicitly private policy is idempotent and protects an existing volume
# from accidental anonymous read/write exposure.
mc anonymous set none "local/$S3_BUCKET"
