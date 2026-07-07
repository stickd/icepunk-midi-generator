# Performance Audit — 2026-07-07

Scope: frontend bundle/rendering, backend generation flow, DB queries, S3/MinIO access, Docker startup/runtime. Companion to `docs/security-audit-2026-07-07.md` (same day, separate concern).

Methodology: three parallel research passes (frontend, backend, infra) over the current `dev` branch, followed by manual verification of the highest-severity claims against the actual source before inclusion here.

## Priority fix order

1. **Download endpoints buffer entire files into JVM heap instead of redirecting to S3** (HIGH, backend)
2. **Generation request thread blocks ~60s on the Python subprocess** (HIGH, backend)
3. **S3 uploads happen inside `@Transactional`, holding a DB connection for the network round-trip** (HIGH, backend — also a documented-architecture violation)
4. **Tone.js/`@tonejs/midi` are eagerly fetched on mount of every feed card and the profile page**, regardless of whether the user ever presses play (MEDIUM, frontend)
5. Feed queries lack indexes on `visibility`/`username`; `guest_usage` row lock serializes same-IP concurrent requests (MEDIUM, backend)
6. No pagination on `/users/me/generated-packs`; profile pack/favorites grids unvirtualized (LOW–MEDIUM, backend+frontend)
7. HikariCP pool size left at default (10) despite connections being held across S3 I/O (MEDIUM, backend)
8. MinIO bucket policy re-applied via external `mc` process on every deploy (LOW, infra — one-time cost, not per-request)

---

## 1. Backend generation flow

**Request thread blocks for the full Python execution + ZIP creation (HIGH)**
`MidiGenerationService.java:74-143` — the semaphore (`maxConcurrentGenerations=2`) is acquired, then the code blocks on `process.waitFor(timeoutSeconds, ...)` (60s timeout) and synchronously builds the ZIP afterward, all on the Tomcat worker thread handling the HTTP request. There's no handoff to a worker pool — the request thread *is* the Python-wait thread. Under load this exhausts the Tomcat pool well before the semaphore's 2-permit cap becomes the bottleneck.

**ZIP creation is synchronous, unbounded file I/O on the request thread (MEDIUM)**
`MidiGenerationService.java:229-255` — `Files.walk()` + `ZipOutputStream`, no streaming to S3. A 50-item pack does ~100-150MB of local disk I/O before upload even starts.

**S3 uploads happen inside the `@Transactional` boundary (HIGH)**
`GeneratedPackService.java:60-124` — `persistGeneratedPack()` is `@Transactional` and calls `uploadMidiItems()`/`storageService.uploadZip()` (each a network round-trip) *inside* that transaction. This directly contradicts the flow CLAUDE.md documents (check → generate → upload → increment as **separate** transactions) — the upload step isn't actually separated from the persist step, so a DB connection sits reserved for the duration of every S3 PUT.

## 2. Database queries

- **Guest usage row lock serializes same-IP traffic (MEDIUM)** — `GuestUsageRepository.findByIpAddressForUpdate` uses `PESSIMISTIC_WRITE`; correct for avoiding lost updates on the 5/day cap, but concurrent requests from the same IP/NAT/proxy queue behind each other.
- **No index on `visibility`/`username` for feed queries (MEDIUM)** — `owner_id` is indexed (`V3__generated_packs.sql`, `V5__dataset_presets.sql`), but the public-feed query path filters on `visibility` and joins on `username` without supporting indexes. Fine at current data volume; will degrade to sequential scans as `generated_packs` grows.
- **`/users/me/generated-packs` has no pagination (LOW)** — `GeneratedPackService.listPacksByOwner()` loads every pack for a user into a `List`. Only matters for prolific users; not urgent now.

## 3. S3/MinIO access pattern

**Downloads are fully buffered in JVM memory and proxied — not redirected (HIGH, verified directly)**
Confirmed in `GeneratedPackController.java:65-77,125-131` and `GeneratedPackService.java:185-200`: both `downloadPack` and `downloadItem` call `storageService.readObject()` (`getObjectAsBytes` under the hood) and return a `ByteArrayResource`. The service *already has* `getPackDownloadUrl()`/`getItemDownloadUrl()` (lines 173-182) that return public S3 URLs — they're just unused by the download controller. Every pack/item download currently: pulls the full object into the S3 client's buffer, copies it into a Java byte array, then re-serializes it to the HTTP response — tying up a request thread and JVM heap for the whole transfer. A handful of concurrent large-ZIP downloads is a realistic path to heap pressure or thread-pool exhaustion. This is the single highest-leverage fix: switching to a `302` redirect to the existing public URL (like the guest ephemeral path already does) removes the bottleneck entirely with a small, well-contained change.

**S3 client setup is good** — `S3Config.java` creates one shared `S3Client` bean with sane connect/socket/API timeouts; uploads (`UserUploadStorageService.upload()`) already stream via `RequestBody.fromInputStream`. The problem is specifically the *read* path for pack/item downloads, not the client configuration.

**MinIO bucket policy via `mc` on every deploy (LOW)** — `docker-compose.production.yml:32-48` spins up a separate `mc` container that polls MinIO readiness then runs `mc anonymous set download`. Adds ~5-10s to deploy time, but it's a one-time startup cost, not per-request — low urgency, tracked here mainly because it's tied to the wildcard-bucket-policy item carried over from the security audit.

## 4. Docker startup/runtime

Mostly healthy: `backend/Dockerfile` is a proper multi-stage build (JDK for build, JRE for runtime); `frontend/Dockerfile` is a three-stage build that prunes dev dependencies; `.dockerignore` correctly excludes `node_modules`, `target`, `venv`, `.git`. `docker-compose.production.yml` gates backend startup on Postgres health and MinIO bucket-creation completion with reasonable timeouts (~50s max wait). No changes needed here beyond the `mc` policy item above.

## 5. Frontend

**Tone.js/`@tonejs/midi` are fetched eagerly on mount, not on user intent (MEDIUM — corrected from agent's initial HIGH)**
`useBrowserMidiPlayback.ts:37-42,151-153` — the module-level `import("tone")`/`import("@tonejs/midi")` calls are properly code-split (verified: only `typeof import(...)` type references exist elsewhere, no runtime top-level imports), so this is **not** a main-bundle-size problem as initially reported. The real issue: `preloadBrowserMidiPlayback()` runs in a `useEffect` on every mount of the hook (line 151-153), and the hook is used by `GenerationFeedCard`, `PackCard`, and `ProfileView`. Because the promise is cached at module scope, the fetch only fires once per page load — but it fires unconditionally as soon as the *first* feed card or the profile page mounts, whether or not the user ever presses play. On a feed/profile page this means a ~200KB+ audio-library chunk is fetched in the background on page load for users who came only to browse.

**Feed/profile rendering is otherwise solid** — memoized cards (`GenerationFeedCard`, `PianoRollPreview`, `BrowserPianoRoll`), `useMemo` for derived lists, `content-visibility: auto` on feed items. Gaps: no virtualization on the profile's pack/favorites grids (manual "Load more" mitigates this) and no `loading="lazy"` on avatar `<img>` tags (`ProfileHeader.tsx:76-81`) — minor.

**Hydration is clean** — `ProfileView` uses `useSyncExternalStore` with a correct server snapshot (returns `null`) to avoid mismatches; no components read `window`/`localStorage` unguarded during initial render.

---

## Not investigated this pass

Rate-limiting durability, dependency CVE scanning, and other carried-over items from the security audit are out of scope here — this pass is performance-only.
