# Decision Log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-07-03 | Repository documentation is the persistent agent memory source. | Future sessions need stable context without repeated broad rediscovery. |
| 2026-07-03 | New sessions should start with `AGENTS.md` and `docs/codex/CURRENT_STATE.md`. | These files provide the shortest reliable path to current context. |
| Existing project decision | One Codex chat/session should normally handle one issue or one phase. | Long mixed sessions accumulate stale assumptions and increase risk. |
| Existing project decision | Broad audits should not be repeated unless explicitly requested or required by release preparation. | Most work benefits from targeted inspection and targeted tests. |
| Existing project decision | Git history is authoritative for completed commits. | Old notes can drift; committed state is the durable source of truth. |
| 2026-07-03 | `CURRENT_STATE.md` should be updated after meaningful completed phases. | Future sessions need to know what changed and what remains risky. |
| Existing project decision | `FACTORY` and `CUSTOM_UPLOAD` are separate generation sources and should remain behaviorally distinct. | Factory generation and user-provided analysis have different validation and data paths. |
| Existing project decision | Frontend must not represent fake MIDI data as real generated backend data. | Users need to trust generated previews/downloads as real backend output. |
| Existing project decision | Large datasets and analysis artifacts should be inspected only when directly required. | They are expensive context and rarely needed for routine code tasks. |
| Existing project decision | Runtime behavior and repository code are authoritative over stale documentation. | Documentation can lag behind implementation. |
| 2026-07-08 | Ephemeral temp analysis (`/datasets/analyze-temp`) and permanent dataset presets (`/datasets`) are two separate, coexisting mechanisms, not a replacement of one by the other. | Anonymous/one-off custom generation still needs a no-signup path; saving is an explicit, additional step for signed-in users who want to reuse a dataset. |
| 2026-07-08 | Guest generations are never persisted as `GeneratedPack` rows; only authenticated generations are. | Keeps guest usage genuinely stateless/ephemeral and avoids attributing ownerless content a permanent DB identity that would need its own moderation/cleanup story. |
| 2026-07-08 | Likes/favorites exist for user-uploaded projects but not (yet) for Generated Packs — this is a real product gap, not an oversight to "fix" silently. | The two content types (uploaded projects vs. generator output) evolved on separate schedules; don't assume feature parity between them without checking `docs/api.md`. |
| 2026-07-08 | `docs/codex/CURRENT_STATE.md`/`PROJECT_CONTEXT.md`/`KNOWN_ISSUES.md` should stop describing shipped features (Generated Packs, profiles, dataset presets) as "uncommitted working tree state" once they're confirmed committed and iterated on. | Stale hedging in agent-facing docs actively misleads future sessions into re-verifying settled ground instead of trusting `git log`. |
