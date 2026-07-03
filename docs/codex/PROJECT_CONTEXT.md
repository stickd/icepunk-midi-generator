# Project Context

## Product Purpose

iCEPUNK MIDI Generator is a MIDI creation workspace focused on generating musical MIDI ideas from factory analysis data and user-provided MIDI analysis sources.

The product direction is broader than a single Generate button. The intended experience is a workspace where users can:

- generate MIDI ideas,
- use factory generation sources,
- upload custom MIDI references for analysis,
- inspect generated results,
- preview MIDI visually,
- download individual MIDI files,
- download complete generated packs,
- eventually save, publish, browse, and interact with MIDI content through library, feed, and community functionality.

## Current Implemented Functionality

Confirmed from current repository code and documentation:

- JWT register/login flow.
- Guest and authenticated generation limits.
- Global generation counter.
- Factory generation using bundled analysis data.
- Temporary custom MIDI analysis via uploaded `.mid` / `.midi` files.
- `/generate` request body with source, amount, pack name, type, BPM, pitch, octaves, optional `tempAnalysisId`, and publish mode.
- Sketch-style frontend workspace with Factory / Custom source selection.
- Browser MIDI upload preview and piano-roll visualization areas.
- User project upload API for authenticated users, with MIDI and sample object storage.
- Public upload feed endpoint and frontend feed area.
- Feedback/contact form.
- Generated ZIP retention cleanup for `generated_midi/` ZIP artifacts.

Current working tree also contains an uncommitted Phase 2 / P1 implementation for generated packs and generated MIDI items. See `CURRENT_STATE.md` before assuming it is committed or deploy-ready.

## Planned or Incomplete Functionality

Do not describe these as fully implemented unless a future commit proves otherwise:

- Credits and paid/private download economy.
- Favorites, likes, ratings, comments, and social ranking.
- Full market/profile/library experience.
- Permanent saved custom datasets/projects from temporary analysis.
- Full generated-pack library pagination and ownership enforcement.
- Production-grade generated individual MIDI retention policy.
- Deep visual polish of all sketch UI placeholder areas.
