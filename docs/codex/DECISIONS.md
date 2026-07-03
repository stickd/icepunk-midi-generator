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
