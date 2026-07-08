# IcePunk public deploy security checklist

## Implemented MVP protections

- Register throttling: 3 attempts per IP per hour.
- Login throttling: 5 attempts per IP per 15 minutes.
- Guest generation limit: 5 successful generations per IP per day.
- Logged-in user generation is unlimited by design (free product decision); credits gate a future "keep private" feature, not generation quota.
- Generation usage is incremented only after successful Python generation, storage upload, and (for authenticated users) `GeneratedPack` persistence.
- Global generation counter is incremented only after the same successful flow.
- Duplicate email and username registration returns `409 Conflict`.
- Duplicate dataset preset name (per owner) returns `409 Conflict`.
- Unexpected backend errors return a generic message instead of raw exception details.
- `JWT_SECRET` fails backend startup in the `prod` profile if unset — no insecure fallback in production (the default profile's placeholder secret is dev-only and never used when `SPRING_PROFILES_ACTIVE=prod`).
- Ownership is enforced server-side on every mutating Generated Pack endpoint (rename, visibility toggle, delete) via a single `requireOwnedPack` check — `403` for a non-owner, `404` for an unknown pack.
- Generated Pack visibility (`PUBLIC`/`PRIVATE`) gates feed/profile listing and single-pack reads (`404` for a private pack viewed by a non-owner), but proxied downloads (`/generated-packs/{packId}/download` and per-item downloads) are intentionally public given a valid ID/URL — same "unguessable UUID, no auth required" model as the original ZIP download design.
- Download buttons in the feed UI are login-gated in the frontend only — this is a conversion nudge, not a security boundary; the backend download endpoints are public by design (see [docs/api.md](api.md)).
- Custom-upload MIDI analysis (`/datasets/analyze-temp`) validates file count (max 100), extension (`.mid`/`.midi`), and per-file size (`DATASETS_TEMP_MIDI_MAX_SIZE_BYTES`, default 2MB) before any subprocess runs. The same 100-file cap is enforced independently on the frontend and backend, and multipart request-size limits are configured to accommodate it — a future change to the file-count limit must move the multipart cap and both frontend/backend copies together.

## VPS / reverse proxy requirements

- Configure the reverse proxy to set `X-Forwarded-For` and `X-Real-IP`.
- Do not pass untrusted client-supplied forwarding headers through unchanged.
- Set `CORS_ALLOWED_ORIGINS` to the exact frontend domain, not `*`.
- Set a strong `JWT_SECRET` with at least 32 random characters.
- Set real production values for PostgreSQL, S3/MinIO, and Resend env variables.
- Add CAPTCHA/Turnstile to registration before heavy public traffic.

## Known MVP limitations

- Register/login throttling is in-memory. It resets on backend restart and is per backend instance.
- Use Redis or another shared store before running multiple backend replicas.
- Existing databases should be checked for duplicate usernames before deploying the new unique username constraint.
- Guest-generated packs are never persisted as DB rows, so only the age-based ZIP cleanup sweep reclaims them — it targets `generated_midi/` only, not `generated_midi_items/`; guest per-item MIDI objects have no automated cleanup today (orphan risk, not a data-exposure risk — the objects are still gated behind unguessable UUIDs).
- There is no like/favorite mechanism for Generated Packs (only for user-uploaded projects) — do not build access-control assumptions on top of a "likes" concept that doesn't exist for packs yet.
- Profile avatars set via `POST /users/me/avatar` upload to S3 (or fall back to local disk) and are genuinely shared server-side; a separate, older client-side `localStorage` avatar preview (`frontend/lib/profileStore.ts`) is per-browser only and not visible to other users — don't confuse the two when reasoning about what's actually public.
