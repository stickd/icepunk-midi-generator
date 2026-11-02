# Technical and organisational measures

Confirmed controls: TLS/Caddy production architecture; BCrypt password hashes; email verification; short-lived JWT; Redis shared rate limits; CSP/security headers; private-by-default new generated content; private MinIO bucket and least-privilege S3 credentials; server-side authorization/IDOR tests; private-object access checks; production secret validation; off-host backup architecture/restore runbook; non-root app containers; log rotation; health checks; Docker resource limits. Review this record when architecture changes.
