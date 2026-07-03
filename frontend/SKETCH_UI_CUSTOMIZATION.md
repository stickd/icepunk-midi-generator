# Sketch UI Customization Guide

This document explains how to safely customize the experimental sketch-style IcePunk MIDI Generator UI without breaking real authentication, generation, download, feedback, or test flows.

## Purpose

The sketch UI is an experimental frontend direction based on a rough hand-drawn product concept:

- purple background
- thick black rough borders
- playful handwritten/blocky layout
- green credit buttons
- modal-based generation flow
- community generation feed mockup

It is currently a visual/product experiment layered on top of existing production logic. Some interactions are real, while others are frontend-only placeholders for future backend features.

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
  Frontend-only MIDI reference upload placeholder.

- `UserGenerationsFeed.tsx` and `GenerationFeedCard.tsx`  
  Mock community feed layout.

- `RightControlPanel.tsx`  
  Preview sound selector, one-shot upload placeholder, BPM/pitch/octave controls, mini ad placeholder.

- `CreatePackModal.tsx`  
  First modal in the flow. Lets user pick MIDI amount, pack name, and Melody/Drums type.

- `GeneratedMidisModal.tsx`  
  Second modal in the flow. Shows generated MIDI preview UI and connects real download buttons to existing generation logic.

- `PianoRollPreview.tsx`  
  Reusable visual piano-roll preview.

- `CreditButton.tsx`  
  Green credit pill with yellow coin.

- `SketchButton.tsx`  
  Shared rough button component.

- `mockData.ts`  
  Mock feed and generated MIDI data.

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
- Browser MIDI playback for locally selected MIDI + one-shot sample through `useBrowserMidiPlayback`
- Uploaded MIDI piano roll visualization through `BrowserPianoRoll` and `useMidiPianoRoll`
- Feedback form through the existing `FeedbackSection`

When customizing visuals, preserve these connections.

## Placeholders And Stubs

These are frontend-only placeholders and should not call fake backend APIs:

- Backend-connected MIDI conditioning from the sketch dropzone
- Feed playback
- Feed favorite/download actions
- Source selector: site / database / favorites
- One-shot upload
- MIDI rating thumbs up/down
- Carousel behavior
- Credit purchase/private-pack logic

If adding new placeholder behavior, keep it isolated inside sketch components and add a short `TODO` comment explaining what backend/API feature is missing.

The sketch dropzone now has real local browser playback for user-selected files, but it still does not upload those files to the backend or use them to condition generated packs.

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
