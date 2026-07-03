# Sketch UI Customization Guide

This document explains how to safely customize the experimental sketch-style IcePunk MIDI Generator UI without breaking real authentication, generation, download, feedback, or test flows.

## Purpose

The sketch UI is an experimental frontend direction based on a rough hand-drawn product concept:

- purple background
- thick black rough borders
- playful handwritten/blocky layout
- green credit buttons
- modal-based generation flow
- backend-connected public upload feed

It is currently a visual/product experiment layered on top of existing production logic. The core auth, generation, upload, public feed, feedback, download, and MIDI visualization paths are real. Controls without backend support must be shown as disabled or clearly marked as coming soon.

## Main Files

### `app/page.tsx`

The landing page now renders the sketch UI through:

```tsx
<SketchThemeLayout />
```

Keep this file small. Put layout and interaction changes inside `components/sketch/*`.

### `components/sketch/*`

Main sketch UI components:

- `SketchThemeLayout.tsx`  
  Top-level sketch page composition. Owns modal state, auth state, generation stats, and connects real generation/download.

- `sketchTheme.module.css`  
  Central style/theme file for the sketch UI. Change colors, fonts, borders, spacing, modal sizing, and responsive rules here first.

- `RandomGeneratePanel.tsx`  
  Dropzone, OR text, Generate random button, source selector, status line.

- `MidiDropZone.tsx`  
  Local MIDI + one-shot staging area for browser playback and piano-roll visualization. This does not upload to the backend; backend upload lives in `UploadProjectSection`.

- `UserGenerationsFeed.tsx` and `GenerationFeedCard.tsx`  
  Backend-connected public upload feed. Loads real `PUBLIC` uploaded projects from `/uploads/feed`, renders title/user/date/metadata, and uses backend MIDI preview URLs for piano-roll visualization.

- `RightControlPanel.tsx`  
  Preview sound selector, one-shot upload placeholder, BPM/pitch/octave controls, mini ad placeholder.

- `CreatePackModal.tsx`  
  First modal in the flow. Lets user pick MIDI amount, pack name, and Melody/Drums type.

- `GeneratedMidisModal.tsx`  
  Second modal in the flow. Connects real download buttons to existing generation logic. Generated preview/rating controls are disabled because the backend currently returns a ZIP URL, not individual MIDI preview URLs.

- `BrowserPianoRoll.tsx`  
  Real canvas MIDI piano-roll renderer for local `File` sources and backend MIDI preview URLs.

- `CreditButton.tsx`  
  Green credit pill with yellow coin.

- `SketchButton.tsx`  
  Shared rough button component.

- `feedTypes.ts`  
  Shared frontend type for mapped public feed entries.

### Tests

Connected tests include:

- `app/page.test.tsx`  
  Verifies the sketch landing page and modal flow.

- `e2e/helpers.ts`  
  Contains `openGeneratedMidiSketchModal(page)` for the new modal generation flow.

- `e2e/guest-generation.spec.ts`  
  Uses the sketch modal flow before triggering real download.

- `e2e/authenticated-generation.spec.ts`  
  Uses the sketch modal flow before triggering real download.

- `e2e/mobile.spec.ts`  
  Checks mobile visibility and basic layout bounds for the new sketch page.

- `e2e/cross-browser.spec.ts`  
  Checks the sketch landing page renders across browsers.

### Jest CSS Mock

`__mocks__/styleMock.ts` is mapped in `jest.config.ts` so Jest can import CSS modules.

Do not remove this unless the Jest config is changed to support CSS modules another way.

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
- Uploaded MIDI piano roll visualization and playback sync through `BrowserPianoRoll`, `useMidiPianoRoll`, and `useBrowserMidiPlayback`
- Feedback form through the existing `FeedbackSection`

When customizing visuals, preserve these connections.

## Placeholders And Stubs

These are frontend-only placeholders and should not call fake backend APIs:

- Backend-connected MIDI conditioning from the sketch dropzone
- Feed playback
- Feed favorite/save/comment actions
- Source selector: site / database / favorites
- Right panel one-shot upload
- MIDI rating thumbs up/down
- Carousel behavior
- Credit purchase/private-pack logic

If adding new placeholder behavior, keep it isolated inside sketch components and add a short `TODO` comment explaining what backend/API feature is missing.

The public feed should not use hardcoded demo cards. If the backend returns no public uploads, show the empty state. If the backend request fails, show the error/retry state.

The generated modal should not pretend to show individual generated MIDI notes until the backend returns individual MIDI preview URLs or a frontend ZIP MIDI extraction flow is implemented.

## How To Customize Styles Safely

### Colors

Change sketch colors in `components/sketch/sketchTheme.module.css` under `.shell`:

```css
--sketch-bg
--sketch-panel
--sketch-panel-soft
--sketch-border
--sketch-accent-green
--sketch-accent-yellow
--sketch-note
--sketch-text
--sketch-muted
```

Prefer changing these variables instead of hardcoding colors inside individual components.

### Fonts

Change the sketch font through:

```css
--sketch-font
```

Keep fallback fonts in the stack. If adding a web font, make sure it does not slow down first render or cause layout shifts.

### Borders

Change rough border thickness through:

```css
--sketch-border-thickness
```

Shared border styling lives in classes such as:

- `.pageFrame`
- `.topPanel`
- `.dropZone`
- `.button`
- `.modal`
- `.pianoRollLarge`

Avoid editing every component one by one unless the change is intentionally local.

### Spacing And Layout

Global sketch spacing is controlled by:

```css
--sketch-space
```

Important layout classes:

- `.topPanel`
- `.heroCenter`
- `.mainGrid`
- `.feedSection`
- `.feedCard`
- `.rightPanel`
- `.generatedGrid`
- `.packSection`

After changing layout, check desktop and mobile widths.

### Modal Styles

Modal sizing is controlled by:

```css
--sketch-modal-width
--sketch-large-modal-width
```

Important modal classes:

- `.modalBackdrop`
- `.modal`
- `.largeModal`
- `.modalHeader`
- `.modalBody`
- `.packSection`

Keep modals usable on mobile. The current CSS switches modal layout to one column under `900px`.

### Selectors And Tests

Prefer stable accessible selectors:

- button names
- dialog names
- heading names
- labels

If adding `data-testid`, keep names stable and descriptive. Do not rename existing selectors unless tests are updated in the same change.

## Do Not Break

- Do not remove existing auth/generation hooks.
- Do not replace real generation/download with fake logic.
- Do not remove `AuthModal`, `authUser`, `useMidiGeneration`, or `getGenerationStats` wiring unless replacing them with equivalent real behavior.
- Do not rename test IDs or accessible labels unless tests are updated.
- Do not break mobile responsiveness.
- Do not hardcode secrets.
- Do not hardcode production backend URLs. Use existing env-based API configuration.
- Do not make placeholder actions look like confirmed backend functionality.

## Recommended Next Refactor

- Centralize design tokens further if the sketch direction becomes permanent.
- Consider a typed theme object or shared CSS variables if multiple pages adopt this style.
- Split any page section that grows too large into smaller sketch components.
- Keep placeholder actions isolated so they can be replaced by real API calls later.
- Add focused component tests if placeholder sections become interactive.
- Consider a dedicated visual smoke test for the sketch modal flow.

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

- `/` renders the purple sketch UI
- Generate random opens Create pack modal
- Next opens Generated Midis modal
- Login / Sign up modal still opens
- Real download buttons still call the existing generation flow
- Feedback form still submits
- Mobile layout does not horizontally overflow

## Notes For Claude

When modifying this UI:

- Prefer small style-only changes first.
- Preserve real business logic and existing hooks.
- Keep placeholder behavior explicit and documented.
- Update tests only when selectors or behavior intentionally change.
- Do not invent backend calls for stubbed features.
- Keep changes buildable after every phase.
- If changing visual mood, start in `sketchTheme.module.css` variables before editing component markup.
