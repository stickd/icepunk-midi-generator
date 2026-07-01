# Frontend testing guide

This project uses two separate test tools for two separate jobs:

| Tool | What it's for | Where |
|---|---|---|
| **Jest** + React Testing Library | Unit / component tests, mocked API calls, a11y checks | co-located `*.test.ts(x)` files next to the code they cover |
| **Playwright** | End-to-end tests against the real backend, real Postgres/MinIO, real Python generator | `e2e/*.spec.ts` |

> This repo uses **Jest**, not Vitest. If you're picking this up from a plan
> or ticket that says "set up Vitest" — that's stale; Jest is already fully
> wired (ts-jest, jsdom, coverage, CI). Don't migrate without discussing it
> first, since it'd mean rewriting every existing test file for no functional
> gain.

## Running tests

```bash
npm run test            # Jest — unit/component tests
npm run test:watch      # Jest in watch mode
npm run test:coverage   # Jest with coverage report (text summary + coverage/lcov-report/index.html)
npm run typecheck       # tsc --noEmit
npm run lint            # ESLint
npm run e2e             # Playwright e2e suite (needs the backend running, see below)
```

All of the above run in CI on every push/PR (`.github/workflows/ci.yml`, jobs
`frontend` and `e2e`).

## Unit / component tests (Jest)

- **Location & naming**: put `Thing.test.tsx` next to `Thing.tsx`. Jest picks
  up anything matching `*.test.ts(x)` or `*.spec.ts(x)`, **except** the `e2e/`
  directory (`testPathIgnorePatterns` in `jest.config.ts`) — that's reserved
  for Playwright specs, which use the same `*.spec.ts` suffix but aren't Jest
  tests.
- **Semantic queries first**: prefer `getByRole`, `getByLabelText`,
  `getByPlaceholderText`, `getByText` over test IDs or CSS selectors. This
  keeps tests aligned with how the a11y tree actually looks, and is what most
  of the existing suite (`HomeControls.test.tsx`, `FeedbackSection.test.tsx`)
  already does.
- **Mocking `lib/api`**: don't mock `fetch` for component tests that go
  through `lib/api.ts` — mock the specific exported functions instead, while
  keeping real constants like `TOKEN_KEY` via `jest.requireActual`:

  ```ts
  jest.mock("@/lib/api", () => {
    const actual = jest.requireActual("@/lib/api");
    return { ...actual, authUser: jest.fn(), getGenerationStats: jest.fn() };
  });
  ```

  For `lib/api.test.ts` itself (testing the fetch wrapper directly), mock
  `global.fetch` — see that file for the pattern.
- **Ambiguous accessible names**: several buttons share a label at different
  nesting levels (e.g. "Login" appears in the navbar *and* as the modal's
  submit button). Scope queries to the modal instead of trying to
  disambiguate by index — see `findModal()` in `HomeControls.test.tsx`.
- **Native HTML5 constraint validation**: `fireEvent.submit(form)` bypasses
  the browser's native `required`/`minLength`/`type="email"` validation (jsdom
  doesn't enforce it the way a real browser does on a real click). This means
  jsdom tests can reach JS-only validation branches that a real user might
  never see, because a real browser's native validation UI would intercept
  the submission first. Keep that distinction in mind before asserting a
  custom validation message is user-reachable — verify it against the actual
  HTML attributes, or check it in a Playwright e2e test instead where real
  browser validation applies.

### Accessibility checks

`jest-axe` is wired in (`jest.setup-after-env.ts` registers
`toHaveNoViolations`). See `components/accessibility.test.tsx` for the
pattern:

```ts
import { axe } from "jest-axe";

const { container } = render(<Thing />);
expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
```

`color-contrast` is disabled in jsdom because jsdom can't compute real
rendered colors/opacity — that check is only meaningful in a real browser.
It's covered instead by `e2e/accessibility.spec.ts`, which runs axe against
the actual rendered page in Chromium.

### Coverage

`jest.config.ts` enforces an 80% global threshold (statements/branches/
functions/lines) via `coverageThreshold`. `layout.tsx` is excluded from
collection — it renders `<html>`/`<body>`, which RTL can't mount cleanly
inside jsdom's existing document. Run `npm run test:coverage` and open
`coverage/lcov-report/index.html` for a file-by-file breakdown when you need
to find what's untested.

## End-to-end tests (Playwright)

The e2e suite hits a **real** backend — real Postgres, real MinIO, real
Spring Boot, real Python MIDI generator subprocess. There's no mocking here;
that's the point (it's the layer that catches "the pieces don't actually fit
together" bugs that mocked unit tests can't).

### Running locally

You need the full stack up first:

```bash
# from the repo root
docker compose up -d --wait

# provision the MinIO bucket (one-time per fresh volume)
docker run --rm --network host \
  -e MC_HOST_local=http://minioadmin:minioadmin@localhost:9010 \
  minio/mc mb --ignore-existing local/icepunk-zips
docker run --rm --network host \
  -e MC_HOST_local=http://minioadmin:minioadmin@localhost:9010 \
  minio/mc anonymous set download local/icepunk-zips

# python venv for the generator (must live at the repo root, see CLAUDE.md)
python3 -m venv venv && venv/bin/pip install -r requirements.txt

# start the backend
cd backend && ./mvnw spring-boot:run
```

Then, from `frontend/`:

```bash
npx playwright install --with-deps   # first time only
NEXT_PUBLIC_API_URL=http://localhost:8081 npm run e2e
```

`playwright.config.ts`'s `webServer` will build and start the Next.js app
for you (`next build && next start` — **not** `next dev`; running e2e against
the dev server causes real navigation timeouts under Playwright's parallel
workers, because dev-mode on-demand compilation can't keep up with several
workers hitting fresh routes at once).

### Test matrix

| Project | Runs | Why |
|---|---|---|
| `chromium` | every spec except `mobile.spec.ts` | primary/full coverage |
| `firefox` | `cross-browser.spec.ts` only | cross-browser rendering check |
| `webkit` | `cross-browser.spec.ts` only | Safari-engine rendering check |
| `mobile-chrome` | `mobile.spec.ts` only | Pixel 5 viewport / responsive layout |

Only `chromium` runs the flows that call `/auth/register`, `/auth/login`, or
`/generate` — see "Rate limits" below for why.

### Rate limits — read this before adding a new spec

The backend has real anti-abuse limits (`InMemoryRateLimitService`,
`GenerationLimitService`), and they apply to e2e runs exactly like real
traffic:

- **Registration**: 3 per hour per IP
- **Login**: 5 per 15 minutes per IP
- **Guest generation**: 3 per day per IP
- **Authenticated generation**: 7 per day per user

Every e2e worker hits the backend from the same machine, so these budgets are
shared across the *entire* test run, not per-test. To stay well under them:

- `e2e/global-setup.ts` registers **one** shared seed user before the suite
  runs, and writes its credentials to `e2e/.seed-user.json` (gitignored).
  Specs that just need to be logged in (`login.spec.ts`,
  `authenticated-generation.spec.ts`) call `readSeedUser()` and log in with
  it — they never register a new account.
- `registration.spec.ts` is the only spec that calls `/auth/register` for a
  *new* throwaway user (that's literally what it's testing). Its "duplicate
  email" test reuses the seed user's email instead of registering a second
  account, specifically to save a registration slot.
- `authenticated-generation.spec.ts` uses `test.describe.serial` with a
  single shared logged-in `page` across both of its tests, so the file only
  logs in once.
- Each CI run gets a **fresh** Postgres volume (`docker compose up` with no
  persisted volume in the ephemeral runner), so these counters reset to zero
  every run. Locally, they only reset when you restart the backend process
  (in-memory counters) or reset the Postgres volume (`docker compose down -v`)
  for the generation-count limits specifically.

If you add a new spec that registers, logs in, or generates, budget it against
the numbers above, and prefer reusing the seed user over minting a new one.

### Performance assertions

`guest-generation.spec.ts` and `authenticated-generation.spec.ts` time the
click-to-download interval and assert it stays under 10s (the client aborts
generation requests after 15s — see `REQUEST_TIMEOUT_MS` in `lib/api.ts`).
Prefer adding timing assertions to existing generate-triggering tests over
writing new ones — every new call to `/generate` eats into the daily quota
above for no extra coverage.

### Accessibility

`e2e/accessibility.spec.ts` runs `@axe-core/playwright` against the real
rendered page (landing page + open auth modal), filtered to
`serious`/`critical` impact so it doesn't drown in cosmetic contrast nitpicks
on this dark theme. It doesn't touch the backend, so it's safe to run as
often as you like.

## Adding a new test — checklist

- Component/hook logic → Jest, co-located `*.test.ts(x)`, mock `lib/api`
  exports (not `fetch`) unless you're testing `lib/api.ts` itself.
- Full user flow through the real backend → Playwright, `e2e/*.spec.ts`.
- Touches `/auth/register`, `/auth/login`, or `/generate`? Read "Rate limits"
  above first and reuse the seed user if you can.
- Run `npm run test:coverage`, `npm run typecheck`, and `npm run lint` before
  pushing — all three run in CI and will block the PR otherwise.
