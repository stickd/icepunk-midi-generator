# Project Context

## Product Purpose

iCEPUNK MIDI Generator is a MIDI creation workspace focused on generating musical MIDI ideas from
factory analysis data and user-provided MIDI analysis sources, with a public feed and profile
system around that output.

The intended experience is a workspace where users can:

- generate MIDI ideas from factory or custom sources,
- upload custom MIDI references for analysis (one-off, or saved permanently as a reusable dataset),
- inspect and preview generated results (piano roll, in-browser playback),
- download individual MIDI files or complete generated packs,
- own, rename, hide, or delete their generated packs,
- publish, browse, like, and download other users' generated packs and uploaded projects through a public feed and profile pages.

## Current Implemented Functionality

Confirmed from current repository code (see [CURRENT_STATE.md](CURRENT_STATE.md) for the
commit-level detail and [ARCHITECTURE.md](ARCHITECTURE.md) for how it fits together):

- JWT register/login flow, fail-closed `JWT_SECRET` in production.
- Guest and authenticated generation limits, with a quota-usage endpoint.
- Global generation counter.
- Factory generation using bundled analysis data.
- Custom generation from either an ephemeral 24h temp analysis, or one-or-more **permanently saved dataset presets** (combinable, up to 10 sources, optionally blended with the factory pool).
- Every authenticated generation is persisted as an owned, manageable Generated Pack (rename, visibility toggle, delete); guest generations are intentionally ephemeral and never persisted.
- Public feed of generated packs and uploaded projects.
- "My Packs" listing for the signed-in owner, including private packs.
- User project upload API with MIDI + one-shot sample object storage, public feed, and streamed preview.
- Public profile pages: stats, bio/avatar editing, favorites (likes on uploaded projects — not yet on generated packs), tabs for Generated/Datasets/Packs/Favorites.
- In-browser MIDI playback via Tone.js — the Python engine never renders audio, only writes `.mid` files.
- Feedback/contact form.
- Two scheduled storage-cleanup sweeps (generated ZIP retention, temp-analysis retention) — see [ARCHITECTURE.md § Storage & Lifecycle](ARCHITECTURE.md#storage--lifecycle) for their known gaps.

## Planned or Incomplete Functionality

Do not describe these as implemented unless a future commit proves otherwise:

- Credits and paid/private-download economy (the column and display exist; no earn/spend mechanics).
- Likes, ratings, comments, or social ranking *for Generated Packs* (uploaded projects already have likes/favorites; packs don't yet).
- Delete endpoint for user-uploaded projects.
- Reference-checked storage retention (today's sweeps are purely age-based).
- Scheduled cleanup for guest per-item MIDI objects, user uploads, or avatars.
- Deep visual polish of any remaining placeholder UI areas.
