# iCEPUNK MIDI Generator Agent Guide

## Project

iCEPUNK MIDI Generator is a full-stack MIDI creation workspace for generating dark, cold melodic MIDI ideas from factory analysis data and user-provided MIDI references.

Tech stack:

- Backend: Spring Boot / Java
- Frontend: Next.js / React / TypeScript
- MIDI generation and analysis: Python
- Database: PostgreSQL
- Object storage: MinIO / S3-compatible storage
- Authentication: JWT
- Infrastructure: Docker / Docker Compose where applicable

## Agent Working Rules

- Default development branch is `dev` unless repository state or explicit task instructions say otherwise.
- Inspect the relevant implementation before editing.
- Prefer minimal, scoped changes.
- Do not rewrite unrelated code.
- Preserve existing behavior unless the task explicitly requires changing it.
- Add or update tests for changed behavior.
- Never invent backend API contracts.
- Never display fake generated MIDI data as real backend output.
- Placeholders are allowed only when explicitly requested and must be clearly identifiable.
- Run targeted tests first.
- Run broader regression suites only when the scope justifies them or when explicitly requested.
- Do not commit or push unless explicitly requested.
- Report changed files, tests run, failures, assumptions, and remaining risks.

## Context Loading Strategy

Future agents should:

1. Read this `AGENTS.md`.
2. Read `docs/codex/CURRENT_STATE.md`.
3. Read the current task or issue.
4. Inspect only directly relevant code.
5. Read other `docs/codex` files only when needed.

Do not automatically perform a full repository audit for every task. Broad audits are useful for release preparation, security work, or explicit audit requests, but routine implementation tasks should start with targeted inspection.

## Recommended Workflow

Issue or phase -> new Codex session -> read `AGENTS.md` -> read `CURRENT_STATE.md` -> read task specification -> targeted code inspection -> short implementation plan -> implementation -> targeted tests -> broader regression only when justified -> verification report -> commit if requested -> push if requested -> update `CURRENT_STATE.md` -> end session -> start next issue in a new session.

This workflow reduces context usage and prevents stale assumptions from accumulating in long chats.
