# Prompt Templates

## A. Start A New Implementation Task

Read `AGENTS.md`, then `docs/codex/CURRENT_STATE.md`. Read the current task. Inspect only directly relevant code. Make a short plan, implement one scoped change, run targeted tests first, then broader tests only if justified. Report changed files, tests, failures, assumptions, and risks. Do not commit or push unless explicitly requested.

## B. Analyze Only

Read `AGENTS.md` and `docs/codex/CURRENT_STATE.md`. Analyze the requested area without changing files. Use targeted code inspection and cite concrete files/classes. Separate confirmed facts from assumptions and risks. Do not modify, commit, or push anything.

## C. Implement One Issue

Work on one issue only. Read `AGENTS.md`, `CURRENT_STATE.md`, and the issue. Inspect relevant implementation and tests. Keep the change minimal and consistent with existing patterns. Add or update tests for changed behavior. Run targeted verification. Do not fix unrelated issues. Do not commit or push unless requested.

## D. Verify One Phase

Read `AGENTS.md`, `CURRENT_STATE.md`, and the phase acceptance criteria. Do not add features. Verify the phase end-to-end with targeted manual and automated checks. Record commands, results, failures, and remaining risks. Only fix verification blockers if explicitly allowed.

## E. Commit After Successful Verification

Inspect `git status`, `git diff --stat`, and the relevant diffs. Ensure only intended files changed. Run appropriate verification for the scope. Stage only intended files. Create one clear commit. Push only when explicitly requested. Report commit hash, message, push result, and final status.

## F. Update Project Memory

After a meaningful completed phase, update `docs/codex/CURRENT_STATE.md` with the date, branch, commit/status, confirmed implementation, tests run, and remaining risks. Do not rewrite unrelated documentation. Do not include secrets or private local config.

## G. Handoff Prompt

Summarize what changed, tests run, current branch, commit status, push status, remaining risks, and the next recommended task. Update `CURRENT_STATE.md` if the phase is complete. Keep the handoff concise and grounded in repository state.
