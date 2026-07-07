# Security Audit — 2026-07-07

Scope: full-project security review requested against a specific checklist (auth/JWT/session,
endpoint access control, rate limits, file upload safety, MIDI/ZIP handling, S3/MinIO access,
CORS, env/secrets, Docker/network exposure, production config, path traversal, dependency
vulnerabilities). This is an addendum to [`TECHNICAL_AUDIT_REPORT.md`](../TECHNICAL_AUDIT_REPORT.md)
(prior full audit) — only new findings and explicit checklist verification are detailed here;
items already documented there and still true are referenced, not repeated in full.

Method: 3 parallel read-only research passes (endpoint authorization matrix; file upload / path
traversal / ZIP / MIDI parsing; S3+CORS+Docker+prod-config+secrets) plus manual verification of
JWT signing/verification, password hashing, rate limiting, and generation-limit logic. `npm audit`
run against the frontend. No `gh` auth available in this session, so live Dependabot/CodeQL alert
data could not be pulled — check the repo's Security tab directly for that.

---

## New finding: IDOR on private generated packs (HIGH — fix first)

**`backend/src/main/java/icepunk_backend/controller/GeneratedPackController.java:39-44,63-75`**
`GET /generated-packs/{packId}`, `GET /generated-packs/{packId}/download`, and
`GET /generated-packs/{packId}/items/{itemId}/download` are all `permitAll` in
`SecurityConfig.java:75`, and the underlying service methods never check visibility:

- `GeneratedPackService.getPack()` (line 126) — bare `findWithItemsById(packId)`
- `getPackDownload()` (line 183) — bare `findById(packId)`
- `getItemDownload()` (line 193) — bare `findByIdAndPackId(itemId, packId)`

None of these filter on `visibility == PUBLIC` or check an owner, unlike the sibling
`getPublicFeed`/`getPublicFeedByUsername` methods which correctly filter `visibility = PUBLIC`.

**Exploit:** a user generates a pack with `publishMode: PRIVATE`. Anyone who obtains the pack UUID
(shared link, browser history, referrer leak, brute-force — UUIDs are unguessable but not secret
once shared once) can call the three endpoints above **unauthenticated** and get the full pack
metadata and ZIP/MIDI bytes. `PATCH /generated-packs/{packId}/visibility` lets an owner flip a pack
to PRIVATE believing it's now hidden — it isn't, for these three read endpoints. This directly
undermines the "private = costs credits" model the product is building toward (private packs today
provide the credits cost with none of the actual privacy).

**Fix:** in `getPack`, `getPackDownload`, `getItemDownload`, require
`pack.getVisibility() == PUBLIC` OR the requester (needs `Authentication` threaded into these
controller methods, currently absent) owns the pack — same pattern as `requireOwnedPack`.

---

## New finding: runtime bucket-policy creation with wildcard principal (LOW, defense-in-depth)

**`backend/src/main/java/icepunk_backend/service/UserUploadStorageService.java:113-137`**
`ensureBucketExists()` auto-creates the MinIO bucket at application startup with a hardcoded
public-read policy (`"Principal": "*"`, `s3:GetObject`) if the bucket doesn't already exist. In
normal deployments the bucket is pre-created by `create-minio-bucket` in
`docker-compose.production.yml`, so this code path doesn't fire — but it means the application
process itself carries `PutBucketPolicy`-setting logic with a wildcard principal baked in. Not
exploitable today (no user input reaches this path), but it's unnecessary attack surface and worth
removing so the app has no code path capable of setting a public bucket policy.

---

## New finding: weak hardcoded JWT secret fallback (MEDIUM)

**`backend/src/main/resources/application.properties:8`**
```
jwt.secret=${JWT_SECRET:replace-with-at-least-32-random-characters}
```
`docker-compose.production.yml` fails closed on a missing `JWT_SECRET` (`${JWT_SECRET:?...}`), but
that guard only protects the `docker compose` deployment path. If the jar is ever run directly with
`SPRING_PROFILES_ACTIVE=prod` outside that compose file (manual VPS run, different orchestrator,
future k8s migration) and `JWT_SECRET` isn't set, the app **silently starts** and signs/verifies
JWTs with this well-known literal string — full token forgery/auth bypass for anyone who reads this
file on GitHub.

**Fix:** remove the fallback default for `prod` (or globally) so Spring fails to start rather than
silently using a public value — e.g. `jwt.secret=${JWT_SECRET}` with no default, or an
`application-prod.properties` override that requires the env var.

---

## Confirmed still-open from the prior audit (no change, re-verified true)

These were already documented in `TECHNICAL_AUDIT_REPORT.md` and are still accurate as of this
review — not re-detailed here:

- **HIGH** — MinIO bucket made anonymously downloadable at the bucket level (`mc anonymous set
  download` in `docker-compose.production.yml`). Still broad; still recommend private bucket +
  presigned URLs, or an explicitly isolated public-artifacts bucket.
- **HIGH** — Auth rate limiting (`InMemoryRateLimitService`) is a single-JVM in-memory map; resets
  on restart, doesn't scale horizontally. Confirmed still the only rate-limiting mechanism for
  `/auth/login` (5/15min) and `/auth/register` (3/hour) per IP.
- **HIGH** — `ClientIpService` trusts `X-Forwarded-For`/`X-Real-IP` unconditionally. Guest
  generation limits and auth rate limits both key off this value — if the backend is ever exposed
  directly (bypassing the reverse proxy), both are trivially bypassable by spoofing the header.
  Confirmed the backend has no trusted-proxy allowlist or Spring `ForwardedHeaderFilter` gating.
- **MEDIUM** — JWT stored in `localStorage` (frontend). No XSS was found in this review either
  (React/Next auto-escaping, no `dangerouslySetInnerHTML` usage found in the audited components).
- **MEDIUM** — Trivy scans are non-blocking (`exit-code: '0'`) in CI — confirmed still true at
  `.github/workflows/ci.yml:349,377`.

---

## Checklist verification — no issues found

- **JWT signing/verification** (`JwtService.java`): HMAC-signed, `verifyWith()` runs before claims
  are trusted, expiration is enforced by the parser. No unsigned/`alg:none` acceptance. Password
  hashing uses BCrypt (`PasswordEncoder`), no plaintext/reversible storage.
- **Login/register user enumeration**: error messages are generic (`"Invalid credentials"`) and
  don't distinguish "unknown user" from "bad password". Emails are masked in logs
  (`maskEmailForLogs`).
- **Ownership checks on mutation/delete endpoints** (packs, dataset presets, uploads, profile,
  avatar): all derive the acting user from the JWT-authenticated `Authentication.getName()`, never
  from a client-supplied body/param. No spoofing vector found.
- **SQL injection**: all queries go through Spring Data JPA / parameterized `@Query`, no raw string
  concatenation found anywhere in the repositories.
- **Command injection**: both Python subprocess invocations (`TempAnalysisService`,
  `MidiGenerationService`) build `ProcessBuilder` from array arguments, never a shell string — safe
  regardless of attacker-influenced filenames/params.
- **Path traversal**: upload filenames are stripped to basename and whitelisted to
  `[A-Za-z0-9._-]` before touching the filesystem (`TempAnalysisService.safeFilename`);
  `tempAnalysisId` is validated against a strict UUID regex plus a `startsWith(tempAnalysisDir)`
  belt-and-suspenders check before path resolution; all other generated/temp/dataset paths use only
  server-generated UUIDs. No user-controlled path segments reach the filesystem or S3 keys.
- **ZIP handling**: only ZIP *creation* exists in the codebase (packing generated MIDI output); no
  code anywhere extracts an untrusted ZIP. Zip-slip is not applicable — there's no extraction path.
- **MIDI parsing**: `MidiMetadataExtractor` wraps parsing in try/catch and is only ever invoked on
  server-generated output files, not raw uploads. Uploaded MIDI is size-capped server-side (2MB
  default) before being handed to `mido`/`javax.sound.midi`, and the Python analyzer subprocess has
  an enforced timeout that kills a hung/malicious file's process.
- **S3/MinIO object-key injection**: every object key used for read/delete is either fully
  server-generated (`UUID.randomUUID()`) or looked up from the DB behind an ownership/visibility
  check (except the IDOR above). No endpoint accepts a raw client-supplied S3 key.
- **CORS**: allowed origins come from an explicit configured list (`app.cors.allowed-origins`),
  never `*`; `allowCredentials` is not set anywhere, so no wildcard+credentials misconfiguration.
  Production fails closed if `CORS_ALLOWED_ORIGINS` is unset.
- **Docker/network exposure**: production compose binds Postgres to no host port at all, and
  MinIO/backend/frontend all default to `127.0.0.1` (overridable, but safe by default). Both
  Dockerfiles run as non-root users. No secrets are baked into image layers — all injected via env
  vars at runtime.
- **Secrets in repo**: no tracked `.env` file with real values; no hardcoded API keys/passwords in
  application code (the only matches for common secret patterns were placeholder examples inside
  third-party `.agents/skills/` reference docs, not project code). CI workflow uses zero repository
  secrets and only local-only ephemeral CI credentials.
- **Guest/user generation limits**: guest limit is 5/day, enforced with `SELECT ... FOR UPDATE`
  row locking on increment (`findByIpAddressForUpdate`) — no race-condition double-spend. Registered
  users currently have **no enforced daily limit** (`checkUserLimit`/`incrementUserUsage` are
  intentionally empty) — per your earlier note this is by design (generation is free/unlimited;
  credits only gate the future "keep private" feature), not a bug. One loose end: a pre-existing
  unit test (`GenerationLimitServiceTest`) still asserts a guest limit of 3, and a comment elsewhere
  says "3/day" — both are stale relative to the current `GUEST_DAILY_LIMIT = 5` in code. Worth a
  quick doc/test cleanup pass, not a security issue.
- **Dependency vulnerabilities**: `npm audit` on `frontend/` → **0 vulnerabilities** (766 deps
  scanned). Backend key dependency versions are current (Spring Boot 3.5.14, jjwt 0.12.6, AWS SDK
  2.25.60) — nothing obviously stale. Dependabot + CodeQL + Trivy are already configured in CI
  (confirmed present), but this session had no GitHub authentication available to pull live
  alert/finding data — check the repo's **Security → Dependabot/Code scanning** tabs directly for
  current alert counts.
- **New code from this session** (Dataset Presets: `DatasetPresetController/Service/Repository`,
  `TempAnalysisService.allocateAnalysisFile`): re-verified independently — ownership checks use
  `owner.getId()` from the authenticated principal, bulk dataset lookup for merge
  (`findByIdInAndOwner_Id`) rejects the whole request if any requested ID isn't owned by the caller
  (no partial-IDOR), no new file-upload surface, no new path-traversal surface, guests are
  explicitly rejected before reaching dataset-merge logic.

---

## Priority fix order

1. **HIGH** — Add visibility/ownership checks to `getPack`/`getPackDownload`/`getItemDownload` in
   `GeneratedPackService` (new finding, concrete IDOR, cheap fix).
2. **MEDIUM** — Remove the weak `jwt.secret` fallback default so a missing env var fails startup
   instead of silently using a public value.
3. **HIGH** (carried over, not yet fixed) — Decide MinIO access model: private bucket + presigned
   URLs, or an explicitly isolated public-artifacts bucket.
4. **HIGH** (carried over) — Move auth rate limiting off in-memory-per-JVM storage, or explicitly
   document/enforce the single-instance assumption.
5. **HIGH** (carried over) — Document/enforce the trusted-reverse-proxy requirement for
   `X-Forwarded-For`/`X-Real-IP`, or gate header-trust behind a property.
6. **LOW** — Remove the wildcard-principal bucket-policy-creation code path from
   `UserUploadStorageService.ensureBucketExists()`.
7. **LOW** — Make Trivy findings blocking for Critical severity once a clean baseline is confirmed.
8. **LOW** — Reconcile the guest-limit-3-vs-5 stale test/comment/doc drift.
