# TODOS

## Phase 2.1 — MidiGenerationService unit tests (blocked on production test seams)

`MidiGenerationService.generateZip()` forks a real OS process via `ProcessBuilder`,
so the remaining cases cannot be unit-tested without a seam to inject a fake `Process`.
Only the semaphore-busy case is covered today (`MidiGenerationServiceTest`).

### Production seams to add first
- [ ] `MidiGenerationService.setMockedProcess(Process)` — package-private; lets a test inject a mock `Process` instead of forking the OS. Refactor `generateZip()` to start the process through an overridable seam (e.g. extract `protected Process startProcess(List<String> command, Path workDir)` that the mock can replace).
- [ ] `MidiGenerationService.getLastWorkDir()` — package-private; exposes the per-generation `outputDir` so a test can assert it was deleted.

### Tests to write once seams exist
- [ ] Python timeout: `process.waitFor` returns false → `RuntimeException("Python generator timeout")`, process destroyed.
- [ ] Non-zero exit code: `exitValue() != 0` → `RuntimeException("Python generator failed with exit code: N")`.
- [ ] Success path: exit 0 → returns the expected `icepunk-midi-pack-<id>.zip` path.
- [ ] Cleanup on success: `getLastWorkDir()` no longer exists after a successful run.
- [ ] Cleanup on failure: `getLastWorkDir()` removed even when generation throws (the `finally` block).

## Phase 2.2 — Backend integration tests (not started)

Testcontainers dependency is in `pom.xml`; no integration tests exist yet. See
`Downloads/PHASE2_TODO.md` §3 for the full list (Postgres constraints/locks,
limits under concurrency, MockMvc API flows, MinIO/S3, migration tests).
