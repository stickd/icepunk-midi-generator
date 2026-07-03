# Known Issues and Risks

## Confirmed Issues

- The current working tree is dirty as of 2026-07-03. Phase 2 / P1 implementation files exist but were not committed when this document was created.
- Large MIDI datasets, generated MIDI files, and analysis JSON artifacts are expensive to inspect and should not be loaded unless directly required.
- Some feed/community/product-surface UI areas are intentionally incomplete or future-facing and should be analyzed separately before being treated as production features.

## Verification Risks / Not Yet Confirmed

- Phase 2 / P1 requires dedicated end-to-end verification before commit/push unless future Git history proves that already happened.
- Failure consistency across storage upload and database persistence needs dedicated verification, especially partial upload cleanup.
- Potential orphaned MinIO object behavior needs verification for generated individual MIDI files and ZIP files.
- Storage retention policy requires explicit audit for:
  - generated ZIP files,
  - generated individual MIDI files,
  - temporary custom analysis files,
  - uploaded user projects.
- Generated pack ownership/access-control behavior needs verification before private/library features are built on top.
- MIDI metadata extraction should be validated against a wider set of real-world MIDI files before relying on it for public previews at scale.

Do not describe verification risks as confirmed bugs without reproducing them.
