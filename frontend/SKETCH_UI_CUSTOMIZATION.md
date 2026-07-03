# Home Page Customization Guide

This document explains how to safely customize the IcePunk MIDI Generator home page (still
living under `components/sketch/*` for historical reasons) without breaking real authentication,
generation, download, feedback, or test flows.

## Purpose

The home page used to be a rough Comic Sans/purple wireframe (the "sketch" direction) built to
prove out real functionality before the visual design was finalized. That wireframe look has
been fully retired — the live page now renders through the dark-glass periwinkle design system
described in `DESIGN.md` (see `protocol.md` §16 for the full migration writeup). The `sketch/`
folder name is a legacy label for "the home page's component tree," not a description of its
current look.

The core auth, generation, upload, public feed, feedback, download, and MIDI visualization paths
are real. Controls without backend support must be shown as disabled or clearly marked as coming
soon.

## Main Files

### `app/page.tsx`

The landing page renders the home page through:

```tsx
<SketchThemeLayout />
```

Keep this file small. Put layout and interaction changes inside `components/sketch/*`.

### `components/sketch/*`

Main home page components:

- `SketchThemeLayout.tsx`
  Top-level page composition: nav, page heading, the feed + create-pack grid, the preserved
  upload/feedback sections, and modal/auth state. Owns modal state, auth state, generation
  stats, and connects real generation/download.

- `CreatePackPanel.tsx`
  Compact sidebar card (glass `aside`, sticky on desktop) combining the dropzone/"Generate
  random" flow with the preview-sound/BPM/pitch/octave controls, so the feed is visible
  immediately below the nav instead of behind a full-width hero.

- `MidiDropZone.tsx`
  Local MIDI + one-shot staging area for browser playback and piano-roll visualization. This
  does not upload to the backend; backend upload lives in `UploadProjectSection`.

- `UserGenerationsFeed.tsx` and `GenerationFeedCard.tsx`
  Backend-connected public upload feed. Loads real `PUBLIC` uploaded projects from
  `/uploads/feed`, renders title/user/date/metadata, and uses backend MIDI preview URLs for
  piano-roll visualization.

- `CreatePackModal.tsx`
  First modal in the flow. Lets user pick MIDI amount, pack name, and Melody/Drums type.

- `GeneratedMidisModal.tsx`
  Second modal in the flow. Connects real download buttons to existing generation logic.
  Generated preview/rating controls are disabled because the backend currently returns a ZIP
  URL, not individual MIDI preview URLs.

- `BrowserPianoRoll.tsx`
  The one canvas MIDI piano-roll renderer used everywhere in the app (drop zone with live
  playhead, feed thumbnails, profile pack cards): fit-to-width/height rendering, zebra pitch
  rows, register-colored notes (bass teal / melody periwinkle / high violet), and a hover
  tooltip — no keyboard sidebar or zoom controls, matching the `DESIGN.md` piano-roll spec.

- `feedTypes.ts`
  Shared frontend type for mapped public feed entries.

### Tests

Connected tests include:

- `app/page.test.tsx`
  Verifies the home page and modal flow by role/text, not CSS classes.

- `e2e/helpers.ts`
  Contains `openGeneratedMidiSketchModal(page)` for the modal generation flow.

- `e2e/guest-generation.spec.ts`
  Uses the modal flow before triggering real download.

- `e2e/authenticated-generation.spec.ts`
  Uses the modal flow before triggering real download.

- `e2e/mobile.spec.ts`
  Checks mobile visibility and basic layout bounds for the home page.

- `e2e/cross-browser.spec.ts`
  Checks the home page renders across browsers.

## Real Functionality

These parts are connected to existing production behavior:

- Auth modal through `AuthModal`
- Login/register through `authUser`
- Token storage through `icepunk_token`
- Logout by clearing `icepunk_token`
- Generation stats through `getGenerationStats`
- Real MIDI generation/download through `useMidiGeneration`
- Public upload feed through `getPublicUploadFeed`
- Backend MIDI preview URL construction through `getPublicUploadMidiPreviewUrl`
- Authenticated MIDI project upload through `UploadProjectSection` and `uploadMidiProject`
- Browser MIDI playback for locally selected MIDI + one-shot sample through `useBrowserMidiPlayback`
- Uploaded MIDI piano roll visualization and playback sync through `BrowserPianoRoll`,
  `useMidiPianoRoll`, and `useBrowserMidiPlayback`
- Feedback form through the existing `FeedbackSection`

When customizing visuals, preserve these connections.

## Placeholders And Stubs

These are frontend-only placeholders and should not call fake backend APIs:

- Backend-connected MIDI conditioning from the drop zone
- Feed playback
- Feed favorite/save/comment actions (the real like/unlike API is only wired up on `/u/[username]`
  pack cards so far — the home feed's heart icon is still a stub)
- Source selector: site / database / favorites
- Right panel one-shot upload
- MIDI rating thumbs up/down
- Carousel behavior
- Credit purchase/private-pack logic

If adding new placeholder behavior, keep it isolated inside these components and add a short
`TODO` comment explaining what backend/API feature is missing.

The public feed should not use hardcoded demo cards. If the backend returns no public uploads,
show the empty state. If the backend request fails, show the error/retry state.

The generated modal should not pretend to show individual generated MIDI notes until the backend
returns individual MIDI preview URLs or a frontend ZIP MIDI extraction flow is implemented.

## How To Customize Styles Safely

Styling now flows through Tailwind + the shared `components/ui/primitives.tsx` design system and
the CSS custom properties in `app/globals.css` (`--ice-*` tokens) — there is no more
`sketchTheme.module.css`. Prefer changing an `--ice-*` token in `globals.css` (or a variant in
`primitives.tsx`) over hardcoding a new color/radius/shadow inline, so every screen stays in sync
with `DESIGN.md`.

### Colors, radii, shadows

Change tokens in `app/globals.css`: `--ice-bg`, `--ice-surface`, `--ice-accent` (+ `-soft`/`-border`/
`-text`), `--ice-text-*`, `--ice-radius-card`, `--ice-radius-control`, `--ice-shadow-card`.

### Piano-roll track colors

`BASS_CEILING`/`MELODY_CEILING` and the `noteColor()` function at the top of
`BrowserPianoRoll.tsx` control the bass/melody/pad register colors. Keep these in sync with the
matching constants documented in `DESIGN.md`.

### Layout

Important layout points: `SketchThemeLayout.tsx`'s `lg:grid-cols-[minmax(0,1fr)_320px]` grid
(feed column + sticky `CreatePackPanel` sidebar), and the modal wrappers in `CreatePackModal.tsx`
/ `GeneratedMidisModal.tsx` (`max-w-lg` / `max-w-3xl` glass dialogs).

After changing layout, check desktop and mobile widths — the grid collapses to one column below
Tailwind's `lg` breakpoint.

### Selectors And Tests

Prefer stable accessible selectors:

- button names
- dialog names
- heading names
- labels

If adding `data-testid`, keep names stable and descriptive. Do not rename existing selectors
unless tests are updated in the same change.

## Do Not Break

- Do not remove existing auth/generation hooks.
- Do not replace real generation/download with fake logic.
- Do not remove `AuthModal`, `authUser`, `useMidiGeneration`, or `getGenerationStats` wiring
  unless replacing them with equivalent real behavior.
- Do not rename test IDs or accessible labels unless tests are updated.
- Do not break mobile responsiveness.
- Do not hardcode secrets.
- Do not hardcode production backend URLs. Use existing env-based API configuration.
- Do not make placeholder actions look like confirmed backend functionality.

## Verification Checklist

Run these after customization:

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
npm run build
```

Optional visual smoke:

```bash
npm run dev
```

Then check:

- `/` renders the dark periwinkle-glass home page with the feed visible immediately under the nav
- Generate random opens Create pack modal
- Next opens Generated Midis modal
- Login / Sign up modal still opens
- Real download buttons still call the existing generation flow
- Feedback form still submits
- Mobile layout does not horizontally overflow

## Notes For Claude

When modifying this page:

- Prefer small style-only changes first.
- Preserve real business logic and existing hooks.
- Keep placeholder behavior explicit and documented.
- Update tests only when selectors or behavior intentionally change.
- Do not invent backend calls for stubbed features.
- Keep changes buildable after every phase.
- If changing visual mood, start with the `--ice-*` tokens in `app/globals.css` before editing
  component markup.
