# Design

Visual system for the icepunk MIDI generator frontend (`frontend/`, Next.js App Router +
Tailwind CSS). Seeded from a user-provided reference (a dark "glass" piano-roll preview card)
and reconciled with the existing (currently unused) `--ice-*` token set in
`frontend/app/globals.css` and `frontend/components/ui/primitives.tsx`, whose structural
patterns (glass panels, blur, pill radii) are being kept. Supersedes the currently-live
"sketch" wireframe look (Comic Sans, purple background, hand-drawn borders) — see
`PRODUCT.md` anti-references.

## Theme

Dark only. Near-black background, translucent glass surfaces, a single accent used sparingly.
Restrained color strategy: tinted neutrals + one accent, never more than one saturated hue
carrying the UI chrome. Content (piano-roll notes, waveforms) carries the visual interest;
chrome stays quiet.

## Color

| Token | Value | Use |
|---|---|---|
| `--bg` | `#08080f` | Page background |
| `--bg-canvas` | `#07070e` | Recessed content areas (piano roll, dropzones) |
| `--surface` | `rgba(255,255,255,0.04)` | Glass card/panel fill |
| `--surface-border` | `rgba(255,255,255,0.08)` | Card/panel hairline border |
| `--surface-border-strong` | `rgba(255,255,255,0.14)` | Hover/active border |
| `--surface-band` | `rgba(0,0,0,0.2)`–`rgba(0,0,0,0.25)` | Header/footer bands inside a card |
| `--text-primary` | `rgba(255,255,255,0.9)` | Primary text |
| `--text-secondary` | `rgba(255,255,255,0.55)`–`rgba(255,255,255,0.75)` | Supporting text |
| `--text-muted` | `rgba(255,255,255,0.25)`–`rgba(255,255,255,0.35)` | Meta labels, stats, captions |
| `--accent` | `rgba(100,120,255,1)` | The one accent — primary actions, active tags, focus rings, highlighted piano-roll note/playhead |
| `--accent-soft` | `rgba(100,120,255,0.15)`–`0.18` | Accent fill (buttons, active tag background) |
| `--accent-border` | `rgba(100,120,255,0.3)` | Accent border |
| `--accent-text` | `rgba(160,180,255,0.9)` | Text on accent-tinted surfaces |
| `--success` | `#34d399` | Success state only |
| `--warning` | `#fbbf24` | Warning state only |
| `--error` | `#fb7185` | Error state only |

Text uses an **opacity ramp on white**, not discrete named grays — one hue, varying only in
alpha, so everything reads as the same "ink" at different emphasis levels.

**Content-encoding colors** (multi-track piano roll only — distinct from the single UI accent
above, never used for chrome):

| Track | Color |
|---|---|
| Melody | `rgba(120,150,255,VAL)` |
| Bass | `rgba(80,200,180,VAL)` |
| Pad | `rgba(200,140,255,VAL)` |

`VAL` = `0.4 + (velocity / 127) * 0.6` — quieter notes render more translucent.

## Typography

- Font: `system-ui, -apple-system, sans-serif` (replaces the current `Arial, Helvetica` stack —
  the Apple-leaning brief calls for the system font).
- Mono (code/timecodes only): `"Courier New", monospace`.
- Body/UI text: sentence case, 13–15px.
- Micro-labels (meta chips, stat captions, section eyebrows on chrome — not on marketing copy):
  10–11px, uppercase, `letter-spacing: 0.06em–0.08em`, `--text-muted`.
- Headings: system font, medium weight (500–600), not the heavy black weights used in the old
  gradient-text hero. `text-wrap: balance` on any multi-line heading.

## Layout & Elevation

- Card corner radius: `16px`. Pill controls (buttons, tags, badges): `border-radius: 100px`.
- Card shadow: `0 24px 80px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4)` — a plain soft shadow,
  no color tint/glow.
- `backdrop-filter: blur(20px)` on cards/panels; `blur(8–12px)` on small floating chrome
  (tooltips, pill buttons).
- Z-index scale: dropdown → sticky → modal-backdrop → modal → toast → tooltip (semantic, never
  arbitrary values).

## Components

- **Card**: header band (`--surface-band`, hairline bottom border) + content + footer band
  (`--surface-band`, hairline top border). Whole card sits on `--surface` with blur + card
  shadow.
- **Pill button**: `100px` radius, translucent fill + hairline border. `secondary` (default):
  `--surface` fill, `--surface-border` border, `--text-secondary` label, brightens on hover.
  `primary`: `--accent-soft` fill, `--accent-border` border, `--accent-text` label — reserved
  for the one primary action per view (e.g. Download), never decoration. Every pill button gets
  a subtle top-gloss highlight inside it: `linear-gradient(180deg, rgba(255,255,255,0.09) 0%,
  transparent 100%)` masked to the pill shape, `top: 0; left: 10%; right: 10%; height: 40%`.
- **Tag/badge**: pill, 10px uppercase tracked text. Neutral tone by default; `accent` tone
  (accent-soft fill + accent-border + accent-text) marks the one active/highlighted tag per
  group (e.g. detected key), never used decoratively.
- **Tooltip**: `rgba(10,10,20,0.92)` fill, `rgba(255,255,255,0.1)` border, `6px` radius,
  `blur(8px)`, small tracked text — appears on piano-roll note hover.
- **Piano roll canvas** (the system's signature surface — applies to the real functional canvas
  in `BrowserPianoRoll.tsx`, not just static previews):
  - Background `--bg-canvas`.
  - Pitch rows: black-key rows tinted `rgba(0,0,0,0.25)`, white-key rows near-transparent
    (`rgba(255,255,255,0.02)`); a slightly stronger line at every C.
  - Beat gridlines: heavier (`rgba(255,255,255,0.1)`, `1px`) every 4 beats, lighter
    (`rgba(255,255,255,0.04)`, `0.5px`) otherwise.
  - Notes: rounded rects (`3px` corner radius equivalent), fill = track color at velocity-driven
    opacity, top gloss gradient (`rgba(255,255,255,0.18)` → transparent), stroke = track color
    at higher alpha. Hover: raise fill alpha, thicken stroke, show tooltip.
  - Playhead: `--accent` line + small triangle marker (replaces the sketch UI's yellow).
  - Signature motion: a subtle animated scanline shimmer sweeps the canvas (very low alpha,
    `~0.025`); disabled under `prefers-reduced-motion`.

## Motion

- Hover states change fill/text opacity only — never animate layout-affecting properties.
- Button press: small scale/translate feedback (`hover:-translate-y-0.5`,
  `active:scale-[0.98]`), kept from the existing `ui/primitives.tsx` pattern.
- Signature "premium" touches carried from the reference: the canvas scanline shimmer and the
  note top-gloss highlight — both purely decorative `transform`/opacity/gradient effects, no
  layout impact.
- Ease-out curves only (no bounce/elastic).
- Every animation (including the two above) needs a `prefers-reduced-motion: reduce`
  alternative — the existing global media query in `globals.css` already disables
  animation/transition duration globally; extend it to cover any new keyframes rather than
  special-casing them.

## Accessibility

- Body text must hit ≥4.5:1 contrast against `--bg`; verify the `--text-secondary` /
  `--text-muted` opacity floors actually meet this against `#08080f` (don't assume the
  reference's raw alpha values were contrast-checked).
- Full `prefers-reduced-motion` support (see Motion).
- Never convey state by color alone — the piano roll's "currently playing" note needs a second
  cue (e.g. stroke weight or a marker), not just a color swap.
