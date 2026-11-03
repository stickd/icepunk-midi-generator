# Product

## Register

product

## Users

Electronic/dark-genre producers generating MIDI packs for their own DAW projects. Three
overlapping jobs on any visit: (1) generate a fast, on-vibe melodic idea from scratch, (2)
browse/download packs other users have generated and shared in the public feed, (3) tweak
generation parameters and preview results in the piano roll across a session before saving
or publishing a pack.

## Product Purpose

Generate, preview, save, and publish dark/cold melodic MIDI packs (the "icepunk" sound) from
one focused workspace, backed by a real Python pattern-generation engine. Success = a user
gets a MIDI idea that fits their track faster than programming it by hand, and can trust the
preview (piano roll, playback) before committing a generation credit/limit.

## Brand Personality

Precise, calm, confident. Voice is understated, not hype-driven — the tool proves itself
through the preview, not through marketing copy. Feels like a well-made studio instrument:
quiet chrome, one confident accent, no visual noise competing with the actual MIDI content.

## Anti-references

- The current "sketch" wireframe UI (Comic Sans, purple background, thick hand-drawn borders,
  rotated buttons) — was a deliberate rough prototype, not the intended final look.
- The old cyan/sky glow-heavy gradient primary buttons and gradient-text hero
  (`Hero.tsx`, prior `ui/primitives.tsx` primary button variant).
- Generic SaaS-cream palettes, cluttered multi-panel dashboards, playful/toy-like UI.

## Design Principles

- Let the content be the decoration — piano roll notes and waveforms carry visual interest;
  chrome stays quiet.
- One accent, used sparingly — periwinkle marks the primary action and active/highlighted
  state only, never decoration.
- Restraint over ornament — flat glass surfaces, hairline borders, no gradients-as-default.
- Real preview over promises — always show the actual generated/uploaded MIDI (piano roll,
  playback), never a placeholder standing in for real functionality.

## Accessibility & Inclusion

WCAG AA contrast minimum (body text opacity ramp must be checked against the near-black
background, not assumed from raw reference alpha values). Full `prefers-reduced-motion`
support (shimmer/gloss motion effects must have a static fallback). No status conveyed by
color alone (e.g. the piano roll's "currently playing note" highlight needs more than a
color change).
