# Technical Audit Report

## Executive Summary

IcePunk MIDI Generator is a solid late-MVP full-stack project with meaningful production hardening already in place: Spring Boot backend, Next.js frontend, PostgreSQL with Flyway, MinIO/S3 storage, Docker deployment, Python generator tests, backend integration tests, frontend unit/e2e tests, CodeQL, Trivy, Dependabot, and production documentation.

The project is close to being safe for a small public launch, but I would not treat it as fully production-ready for broad public traffic yet. The largest remaining risks are concentrated in the generation pipeline, object-storage exposure model, in-memory abuse protection, and the operational maturity of deployment/rollback/backup flows.

Production readiness score: 7/10

Architecture: 7/10  
Security: 7/10  
Performance: 6/10  
Maintainability: 7/10  
Testing: 8/10  
Scalability: 5/10  
Documentation: 7/10  
CI/CD: 8/10

Positive findings:

- Backend has clear Controller -> Service -> Repository layering in most areas.
- Daily usage charging happens after successful generation/upload, which protects users from losing limits on failed work.
- PostgreSQL schema is managed by Flyway in production with `ddl-auto=validate`.
- JWT, validation annotations, global exception handling, CORS env config, S3 timeout config, and generated ZIP cleanup are present.
- CI is unusually strong for an MVP: Java tests, Python lint/typecheck/tests, frontend lint/typecheck/build/coverage, Newman, Playwright, Docker build, Trivy, CodeQL, Dependabot.
- Docker production compose avoids exposing PostgreSQL and binds MinIO/backend to localhost by default.

Main release concern:

The system can likely handle a small first public release if hosted carefully behind a reverse proxy and monitored. It is not ready for high concurrency or untrusted traffic spikes without improving rate limiting, generator process handling, and storage access boundaries.

---

## Critical Issues

No confirmed Critical production-blocking issue was found in the current codebase.

The project does have several High severity issues that should be addressed before or soon after public release, but none are an immediate "do not deploy under any circumstances" blocker if the first launch is intentionally small and the VPS is configured conservatively.

---

## High Priority Issues

### 1. Python subprocess output is read only after process completion

Severity: High

Location:  
`backend/src/main/java/icepunk_backend/service/MidiGenerationService.java`  
Class: `MidiGenerationService`  
Function: `generateZip()`

Description:

The backend starts the Python generator process, waits for it to finish with `process.waitFor(timeoutSeconds, TimeUnit.SECONDS)`, and only then reads `process.getInputStream()`. Since `redirectErrorStream(true)` is enabled, stdout and stderr share one pipe. If the Python generator outputs enough data to fill the OS pipe buffer, the child process can block while the Java process is waiting for it to exit.

Why it matters:

This can turn normal generation into a timeout even if the generator logic is working. It also makes future debugging/logging changes in Python risky, because adding more output can accidentally break production generation.

Potential impact:

- Generation requests can hang until timeout.
- Concurrency slots can remain occupied for the full timeout.
- Several simultaneous stuck processes can make the backend appear busy or degraded.

Recommended solution:

Drain process output while the process is running. Options:

- Use `ProcessBuilder.redirectOutput(ProcessBuilder.Redirect.PIPE)` and read asynchronously with a background task.
- Use `process.inputReader()` in a separate thread/future.
- Redirect output to a bounded logger/file.
- Replace generic `RuntimeException` with typed `GeneratorException` and include controlled diagnostic context.

Estimated implementation effort: Medium

Should it be fixed before release? Yes

---

### 2. Generated ZIP storage is public at bucket level

Severity: High

Location:  
`docker-compose.production.yml`  
Service: `create-minio-bucket`

Description:

Production compose runs:

```sh
mc anonymous set download local/"$${S3_BUCKET}"
```

This makes the whole bucket anonymously downloadable. Current generated ZIPs are intended to be public download artifacts, but the bucket policy is broad.

Why it matters:

If future object types, logs, private exports, or user-specific files are stored in the same bucket, they will also become public unless engineers remember this policy. This is a common long-term storage security footgun.

Potential impact:

- Accidental public exposure of future objects.
- Harder migration path if private files are added later.
- No expiry on URLs themselves; cleanup removes old objects, but links are public while objects exist.

Recommended solution:

Prefer a private bucket plus presigned URLs with short expiry. If public downloads remain desired for MVP, isolate generated ZIPs into a dedicated bucket/prefix with explicit documentation that nothing private may be stored there.

Estimated implementation effort: Medium

Should it be fixed before release? Preferably Yes

---

### 3. In-memory auth rate limiting does not scale and is reset on restart

Severity: High

Location:  
`backend/src/main/java/icepunk_backend/service/InMemoryRateLimitService.java`  
Class: `InMemoryRateLimitService`

Description:

Login/register rate limits are stored in a `ConcurrentHashMap` in one JVM. Counters reset on restart and are not shared across multiple backend instances. The map also has no cleanup for inactive keys until those exact keys are accessed again.

Why it matters:

This is acceptable for local/MVP traffic, but weak for public abuse protection.

Potential impact:

- Restarting the backend resets brute-force throttles.
- Horizontal scaling bypasses limits per instance.
- Many unique IPs can grow the map over time.

Recommended solution:

For first release, add scheduled cleanup for expired counters and document single-instance assumptions. For scale, move rate limiting to Redis, Postgres with TTL cleanup, or an edge proxy/WAF.

Estimated implementation effort: Medium

Should it be fixed before release? Yes, at least cleanup and documentation

---

### 4. Generate flow orchestration is too concentrated in the controller

Severity: High

Location:  
`backend/src/main/java/icepunk_backend/controller/GenerateController.java`  
Class: `GenerateController`  
Function: `generate()`

Description:

`GenerateController.generate()` resolves the authenticated actor, reads IP, checks limits, calls Python generation, uploads ZIP, increments user/guest usage, increments global stats, deletes temp file, and constructs the response.

Why it matters:

Controllers should be thin HTTP adapters. This endpoint is the core business workflow and will continue to grow as billing, packs, user history, audit logging, retries, or async generation are added.

Potential impact:

- Higher regression risk when changing generation behavior.
- Harder to unit test full orchestration independently of HTTP.
- More difficult to introduce async queues or job status later.

Recommended solution:

Create a `GenerationService` or `GenerationWorkflowService` that owns the full generate workflow. Keep the controller responsible only for HTTP request/response and authentication context extraction.

Estimated implementation effort: Medium

Should it be fixed before release? No, but soon after release

---

### 5. Usage increment and stats increment are separate post-upload database actions

Severity: High

Location:  
`backend/src/main/java/icepunk_backend/controller/GenerateController.java`  
Function: `generate()`  
Related: `GenerationLimitService`, `GenerationStatsService`

Description:

After upload succeeds, the controller increments usage and then increments global generation stats. These are separate service calls and not part of a single explicit workflow transaction. If usage increment succeeds but stats increment fails, the user may receive an error even though a ZIP was uploaded and their daily usage was consumed.

Why it matters:

The current design already solved the main problem of not charging limits before successful generation/upload. The remaining edge case is a partial post-upload failure.

Potential impact:

- User could lose one daily generation if DB failure occurs between usage increment and response.
- Uploaded artifact may exist without a successful response.
- Global stats and usage can diverge in rare failures.

Recommended solution:

Move post-upload database updates into one transactional service method. Consider a result state model: generation upload is external side effect, DB finalization is one transaction. On DB finalization failure, log the uploaded key for cleanup/reconciliation.

Estimated implementation effort: Medium

Should it be fixed before release? Preferably Yes

---

### 6. Client IP trust depends on deployment topology

Severity: High

Location:  
`backend/src/main/java/icepunk_backend/service/ClientIpService.java`  
Class: `ClientIpService`

Description:

The service trusts `X-Forwarded-For` and `X-Real-IP` headers directly. This is correct only if requests reach the backend exclusively through a trusted reverse proxy that overwrites these headers.

Why it matters:

Daily guest limits and auth rate limits depend on this IP. If the backend is accidentally exposed directly, clients can spoof these headers to bypass limits.

Potential impact:

- Guest generation limit bypass.
- Login/register rate limit bypass.
- Bad operational assumptions if deployment changes.

Recommended solution:

Ensure backend remains bound to localhost/private network only. Add deployment documentation requiring reverse proxy header sanitation. For stronger safety, use Spring's forwarded-header support only when enabled by profile/property, or validate trusted proxy source addresses.

Estimated implementation effort: Small/Medium

Should it be fixed before release? Yes, at least documentation and deployment validation

---

## Medium Priority Issues

### 1. Python generator is a large monolithic script

Severity: Medium

Location:  
`icepunk_midi_generator.py`

Description:

The generator is 700+ lines and contains global configuration, analysis loading, pattern selection, mutation, MIDI writing, CLI parsing, and random behavior in one file.

Why it matters:

The generator is the product core. Feature work will likely target this file, and a monolith makes musical changes harder to test and review.

Potential impact:

- Higher regression risk in future generation improvements.
- Difficult to expose generator parameters safely.
- Harder to add deterministic generation tests.

Recommended solution:

Split into modules:

- `config.py`
- `analysis_loader.py`
- `pattern_selection.py`
- `mutation.py`
- `midi_writer.py`
- `cli.py`

Inject RNG/config where possible.

Estimated implementation effort: Large

Should it be fixed before release? No

---

### 2. Frontend generation UX depends on string matching backend errors

Severity: Medium

Location:  
`frontend/hooks/useMidiGeneration.ts`  
`frontend/lib/api.ts`

Description:

The frontend maps errors by checking substrings such as `"Guest daily generation limit reached"`, `"User daily generation limit reached"`, `"Server is busy"`, and `"HTTP_401"`.

Why it matters:

Changing backend messages can silently break frontend UX.

Potential impact:

- Incorrect user-facing error messages.
- Session-expired behavior can fail if backend error format changes.
- Harder localization or copy changes.

Recommended solution:

Return structured error JSON from backend:

```json
{ "code": "GENERATION_LIMIT_GUEST", "message": "..." }
```

Parse JSON errors in `frontend/lib/api.ts` and map stable codes to UI text.

Estimated implementation effort: Medium

Should it be fixed before release? Nice before release, acceptable soon after

---

### 3. JWT stored in localStorage

Severity: Medium

Location:  
`frontend/components/HomeControls.tsx`  
`frontend/hooks/useMidiGeneration.ts`  
`frontend/lib/api.ts`

Description:

The frontend stores the JWT in `localStorage`.

Why it matters:

React escapes text by default and no direct XSS issue was found, but if an XSS bug is introduced later, localStorage tokens are easy to steal.

Potential impact:

- Account takeover if XSS appears.
- More security-sensitive frontend changes over time.

Recommended solution:

For MVP, keep strong XSS hygiene. For a more mature auth design, consider HttpOnly Secure SameSite cookies and CSRF-aware flows, or very short-lived access tokens plus refresh strategy.

Estimated implementation effort: Medium/Large

Should it be fixed before release? No, if MVP account risk is low

---

### 4. Configuration is scattered across `@Value` constants and hardcoded limits

Severity: Medium

Location:  
`GenerationLimitService.java`  
`InMemoryRateLimitService.java`  
`MidiGenerationService.java`  
`S3Config.java`  
`application.properties`

Description:

Some operational settings are externalized, while guest/user daily limits and auth rate limits are hardcoded.

Why it matters:

Changing limits after launch should not require code edits and redeployment.

Potential impact:

- Slower incident response if abuse requires immediate limit changes.
- Inconsistent configuration patterns.

Recommended solution:

Introduce typed `@ConfigurationProperties` classes:

- `GenerationLimitProperties`
- `RateLimitProperties`
- `GeneratorProperties`
- `StorageProperties`

Estimated implementation effort: Medium

Should it be fixed before release? No, but soon after release

---

### 5. Date handling uses server-local dates

Severity: Medium

Location:  
`GenerationLimitService.java`  
`User.java`  
`GuestUsage.java`

Description:

Daily limits use `LocalDate.now()` and entity defaults also initialize dates with `LocalDate.now()`.

Why it matters:

The definition of "daily" depends on the server timezone and is harder to test.

Potential impact:

- Confusing resets if VPS timezone changes.
- Harder support conversations around daily limits.
- Tests around midnight become awkward.

Recommended solution:

Inject `Clock` and define daily limit timezone explicitly, preferably UTC for production.

Estimated implementation effort: Small

Should it be fixed before release? No, but soon after release

---

### 6. Contact API mixes validation, email rendering, env checks, fallback logging, and Resend call

Severity: Medium

Location:  
`frontend/app/api/contact/route.ts`

Description:

The Next.js API route handles all feedback concerns in one 140-line file.

Why it matters:

It is currently acceptable, but future anti-spam, rate limits, templates, and provider changes will make this route harder to maintain.

Potential impact:

- Email template changes can affect validation.
- Provider failures are harder to isolate.
- No outbound request timeout for Resend.

Recommended solution:

Extract:

- `validateFeedbackPayload`
- `renderFeedbackEmail`
- `sendFeedbackEmail`

Add outbound timeout via `AbortSignal.timeout`.

Estimated implementation effort: Medium

Should it be fixed before release? No

---

### 7. CI security scans do not fail the build on High/Critical findings

Severity: Medium

Location:  
`.github/workflows/ci.yml`  
Jobs: `docker`, `security`

Description:

Trivy scans are configured with `exit-code: '0'`. This uploads SARIF but does not block merges.

Why it matters:

This is useful during hardening, but less useful as a release gate.

Potential impact:

- High/Critical vulnerabilities can be merged unnoticed if nobody checks Security tab.

Recommended solution:

After establishing a clean baseline, set `exit-code: '1'` for Critical first, then High when manageable.

Estimated implementation effort: Small

Should it be fixed before release? Preferably Yes

---

### 8. Production deployment lacks a tested rollback workflow

Severity: Medium

Location:  
`README.md`  
`docker-compose.production.yml`  
`.github/workflows/ci.yml`

Description:

Docs explain how to start production, but there is no explicit rollback strategy, image tagging/publishing workflow, or database restore drill.

Why it matters:

Manual `docker compose up -d --build` on a VPS is simple, but rollback after a bad deploy can be slow.

Potential impact:

- Longer downtime during bad deployment.
- Harder recovery after migration or image failure.

Recommended solution:

Add a lightweight release process:

- tag releases
- build/push backend image
- keep previous `.env.production`
- document `docker compose pull && up -d`
- document rollback to previous tag

Estimated implementation effort: Medium

Should it be fixed before release? No, but before larger traffic

---

## Low Priority Issues

### 1. SecurityConfig formatting and public docs matchers are slightly misleading

Severity: Low

Location:  
`backend/src/main/java/icepunk_backend/config/SecurityConfig.java`

Description:

`securityFilterChain` indentation is inconsistent, and Swagger/OpenAPI paths are permitted by security config even though prod disables springdoc.

Why it matters:

No production vulnerability was found because `application-prod.properties` disables docs. The main issue is readability and future confusion.

Potential impact:

- Future contributors may think docs are intentionally public in prod.

Recommended solution:

Reformat and optionally conditionally permit docs only in non-prod or when a property enables them.

Estimated implementation effort: Small

Should it be fixed before release? No

---

### 2. Global exception response construction is repetitive

Severity: Low

Location:  
`backend/src/main/java/icepunk_backend/exception/GlobalExceptionHandler.java`

Description:

Most handlers duplicate a small `Map<String, String>` body.

Why it matters:

This is not risky, but creates small maintenance overhead.

Potential impact:

- Inconsistent future error responses.

Recommended solution:

Add an `ErrorResponse` DTO or helper method.

Estimated implementation effort: Small

Should it be fixed before release? No

---

### 3. Local ignored artifacts are present in working tree

Severity: Low

Location:

Ignored local folders/files observed during audit:

- `backend/target`
- `frontend/.next`
- `frontend/coverage`
- `frontend/test-results`
- `generated_midi`
- `midi_dataset`
- `venv`

Description:

These are ignored and not tracked, so this is not repository debt. It does make local audits and file searches noisier.

Why it matters:

Developer ergonomics only.

Potential impact:

- Slower local searches.
- Confusing file listings.

Recommended solution:

Occasional local cleanup. No code change needed.

Estimated implementation effort: Small

Should it be fixed before release? No

---

## Technical Debt

Ranked highest to lowest:

1. `MidiGenerationService` owns process orchestration, concurrency, filesystem output, ZIP creation, cleanup, and error conversion. Long-term impact: every generation feature touches this class. Maintenance cost: high. Suggested refactor: split generator runner, slot limiter, ZIP packager, and temp cleanup.

2. `GenerateController.generate()` owns the full business workflow. Long-term impact: billing/history/async generation will make controller complexity grow. Maintenance cost: high. Suggested refactor: move to `GenerationWorkflowService`.

3. `icepunk_midi_generator.py` is a large monolith. Long-term impact: musical feature work becomes risky. Maintenance cost: medium/high. Suggested refactor: split into loader, mutation, selection, writer, CLI.

4. Public bucket policy for downloads is broad. Long-term impact: future private objects could be accidentally exposed. Maintenance cost: high if discovered late. Suggested refactor: private bucket plus presigned URLs or dedicated public artifacts bucket.

5. In-memory rate limiting. Long-term impact: scale/abuse controls become unreliable. Maintenance cost: medium. Suggested refactor: Redis/Postgres/edge rate limiting.

6. Frontend error handling via string matching. Long-term impact: backend copy changes break UX. Maintenance cost: medium. Suggested refactor: stable error codes.

7. Mixed configuration patterns. Long-term impact: operational tuning requires code edits. Maintenance cost: medium. Suggested refactor: typed properties classes.

8. Contact API route is self-contained but too broad. Long-term impact: anti-spam/provider changes become messy. Maintenance cost: medium. Suggested refactor: validation/rendering/provider modules.

9. CI setup duplication across Newman/e2e. Long-term impact: workflow drift. Maintenance cost: low/medium. Suggested refactor: shared scripts for infra provisioning and backend startup.

10. Minimal rollback docs. Long-term impact: slower incident response. Maintenance cost: medium during first real outage. Suggested refactor: release/rollback runbook.

---

## Security Findings

### OWASP A01 Broken Access Control

Severity: Medium

Finding:

`ClientIpService` trusts forwarded IP headers. Access limits depend on this value.

Remediation:

Keep backend bound behind a trusted proxy. Ensure proxy overwrites forwarded headers. Consider trusted proxy validation.

### OWASP A02 Cryptographic Failures

Severity: Low/Medium

Finding:

JWTs are stored in frontend `localStorage`. No direct XSS was found, but token theft impact is higher if future XSS appears.

Remediation:

Maintain strict XSS hygiene. Consider HttpOnly cookies or short-lived tokens if account value grows.

### OWASP A03 Injection

Severity: Low

Finding:

No SQL injection pattern was found. Repositories use Spring Data/JPA parameter binding. Python subprocess command is built as an argument array via `ProcessBuilder`, not shell string concatenation.

Remediation:

Continue avoiding raw SQL/string shell execution.

### OWASP A04 Insecure Design

Severity: High

Finding:

Whole MinIO bucket is made anonymously downloadable.

Remediation:

Use private bucket + presigned URLs or strict dedicated public artifact bucket.

### OWASP A05 Security Misconfiguration

Severity: Medium

Finding:

Swagger paths are permitted in security config, although springdoc is disabled in prod. Trivy scans do not fail builds. MinIO console is bound to localhost by default, which is good.

Remediation:

Gate docs paths by profile/property and make security scans blocking after baseline.

### OWASP A06 Vulnerable and Outdated Components

Severity: Medium

Finding:

Dependabot, npm audit fixes, Trivy, and CodeQL are present. Trivy is non-blocking.

Remediation:

Make at least Critical vulnerabilities block CI.

### OWASP A07 Identification and Authentication Failures

Severity: Medium

Finding:

Auth rate limiting is in-memory and reset on restart.

Remediation:

Use persistent/shared rate limiting for public traffic.

### OWASP A08 Software and Data Integrity Failures

Severity: Low/Medium

Finding:

CI builds images but does not publish signed immutable images. VPS deployment appears build-on-server oriented.

Remediation:

Use tagged images and release artifacts for production.

### OWASP A09 Security Logging and Monitoring Failures

Severity: Medium

Finding:

Basic logging exists and auth emails are masked. There is no monitoring/alerting pipeline documented.

Remediation:

Add simple uptime checks, log rotation, and alerting for 5xx/generation failures.

### OWASP A10 SSRF

Severity: Low

Finding:

No user-controlled URL fetch by backend was found. Frontend contact route calls fixed Resend URL.

Remediation:

Keep outbound URLs fixed or allowlisted.

---

## Performance Findings

1. Python generation is CPU/process heavy and synchronous per request. Current semaphore limits concurrency, which protects the VPS but caps throughput.

2. `MidiGenerationService` creates files on disk, walks directories, zips them, uploads, and deletes local files per request. This is acceptable for small packs but may become I/O-heavy under load.

3. Process output handling can block as described in High Priority Issue #1.

4. Frontend uses dynamic import for `AuthModal` and content visibility on feedback section, which is good.

5. `Snowfall` visual effect should be watched on low-end mobile devices, but no direct failure was found.

6. `GeneratedZipCleanupService` lists objects under `generated_midi/` once per day. For many objects this can grow expensive, but it uses pagination and is acceptable for early scale.

Optimization opportunities:

- Async job queue for generation at higher traffic.
- Presigned URLs and object lifecycle instead of backend cleanup at larger object counts.
- Stream ZIP creation directly rather than writing intermediate ZIP to project root.
- Add generator metrics: duration, queue/busy count, process timeout count, upload duration.

---

## Scalability Review

### 10 users

Expected behavior:

Should work comfortably on a small VPS. Semaphore defaults to 2 concurrent generations. Most users will see normal behavior.

Likely bottlenecks:

- Occasional busy response if multiple users generate at the same time.

### 100 users

Expected behavior:

Still workable if active generation concurrency is low. Authentication, frontend, database, and storage should be fine.

Likely bottlenecks:

- Python generation slots.
- CPU spikes during generation.
- In-memory auth rate limits are still acceptable only for single instance.

### 1,000 users

Expected behavior:

Architecture starts showing limits. Many registered users are fine, but concurrent generation traffic can exceed capacity quickly.

Likely bottlenecks:

- Python generation process model.
- Single backend instance.
- MinIO public bucket/object cleanup volume.
- In-memory rate limits.
- No queue/job status UX.

### 10,000 users

Expected behavior:

Current synchronous generate flow is not enough. Needs async job queue, worker pool, shared rate limiting, and real observability.

Likely bottlenecks:

- VPS CPU.
- Python process spawn overhead.
- S3 object management.
- Database lock contention on global stats row.

### 100,000 users

Expected behavior:

Requires redesign of generation as a queued worker system, CDN/object storage strategy, distributed rate limiting, monitoring, and possibly account/payment workflows.

Likely bottlenecks:

- Everything around generation throughput and abuse controls.
- Object storage cost/control.
- Supportability and observability.

---

## Production Readiness Checklist

- ✅ Backend builds and has tests.
- ✅ Frontend builds and has tests.
- ✅ Python generator has lint/typecheck/tests in CI.
- ✅ Docker backend image exists.
- ✅ Production compose exists.
- ✅ PostgreSQL persistence volume configured.
- ✅ MinIO persistence volume configured.
- ✅ Backend healthcheck configured.
- ✅ Actuator exposure limited to health.
- ✅ Production disables Swagger/OpenAPI.
- ✅ Flyway migrations present.
- ✅ `ddl-auto=validate` in prod.
- ✅ Secrets are not tracked by git based on `git ls-files` check.
- ✅ `.env*` ignored.
- ✅ JWT secret required in production compose.
- ✅ CORS allowed origins externalized.
- ✅ S3 timeouts configured.
- ✅ Python generator timeout configured.
- ✅ Generation concurrency limiter exists.
- ✅ Usage increments after successful generation/upload.
- ✅ Generated ZIP cleanup exists.
- ✅ CI runs backend, frontend, Python, e2e, Newman.
- ✅ Dependabot configured.
- ✅ CodeQL configured.
- ✅ Trivy configured.
- ⚠ MinIO bucket is public at bucket level.
- ⚠ Auth rate limiting is in-memory only.
- ⚠ Client IP trust depends on proxy correctness.
- ⚠ Generate workflow is controller-heavy.
- ⚠ Python subprocess output handling can block.
- ⚠ Trivy is non-blocking.
- ⚠ Rollback process is not documented.
- ⚠ Production backup/restore runbook is light.
- ⚠ No structured metrics/alerting documented.
- ❌ No async job queue for generation.
- ❌ No distributed rate limiting.
- ❌ No presigned URL/private object strategy.
- ❌ No deployment pipeline to immutable production images.

---

## Roadmap

### Before first public release

1. Fix Python subprocess output draining in `MidiGenerationService`.
2. Decide MinIO access model: private + presigned URLs, or explicitly dedicated public artifacts bucket.
3. Add cleanup/bounds or persistence for auth rate limiter, or enforce rate limiting at reverse proxy.
4. Document trusted reverse proxy setup for `X-Forwarded-For`.
5. Make Critical Trivy findings fail CI, at minimum.
6. Add basic VPS backup instructions for PostgreSQL and MinIO volumes.

### Before first 100 users

1. Move generate orchestration from controller to a workflow service.
2. Add stable backend error codes and frontend error parsing.
3. Inject `Clock` and define daily reset timezone.
4. Add generation metrics/log structure: duration, timeout, busy, upload failure.
5. Add a simple production rollback runbook.

### Before first 1,000 users

1. Move auth/rate limits to Redis/Postgres or proxy-level limits.
2. Introduce async generation jobs with status polling.
3. Add signed URLs or CDN strategy for downloads.
4. Split Python generator into maintainable modules.
5. Add structured logging and alerting.

### Before first 10,000 users

1. Separate generator workers from API backend.
2. Use queue-based workload control.
3. Publish versioned Docker images from CI.
4. Add load tests for generation concurrency.
5. Add database/index review based on real usage.

### Future improvements

1. Account dashboard/history of generated packs.
2. Billing/subscription-ready usage model.
3. Admin metrics dashboard.
4. Better generator parameterization and deterministic seed support.
5. Mutation testing for critical Java services.

---

## Final Verdict

Is this project production-ready?

Partially. It is ready for a controlled small public launch after addressing the highest-risk operational items: subprocess output draining, storage exposure decision, rate-limit robustness, and proxy/IP documentation.

Would I approve deployment?

Yes, for a small MVP/beta deployment on a carefully configured VPS, after the "Before first public release" items are handled or consciously accepted.

Would I approve it as a portfolio project?

Yes. The project demonstrates full-stack engineering, Docker, CI, security hardening, tests, Python integration, object storage, and production thinking. It is stronger than a typical portfolio MVP.

Would I approve it for commercial use?

Not yet at meaningful scale. For commercial use, I would require async generation, stronger object storage security, persistent/distributed rate limiting, observability, backup/restore, and a formal release/rollback process.
