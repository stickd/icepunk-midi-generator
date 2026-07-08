# API Reference

Base URL: `NEXT_PUBLIC_API_URL` in the frontend, e.g. `http://localhost:8081` locally. All
request/response bodies are JSON unless noted as `multipart/form-data`. All timestamps are
`OffsetDateTime` (ISO-8601 with offset).

Auth: stateless JWT. Send `Authorization: Bearer <token>` on any endpoint marked **JWT**. Endpoints
marked **Public** work with or without a token; a few of those (`/generate`, `/generation-usage`)
change behavior when a valid token is present. Endpoints marked **JWT + owner** additionally require
the caller to own the resource (`403 ForbiddenActionException` otherwise).

For the exact validation rules behind each request DTO, see
`backend/src/main/java/icepunk_backend/dto/`. For the full HTTP status code reference, see
[protocol.md §13](protocol.md#13-http-status-code-reference).

## Auth

| Method & Path | Auth | Body | Returns |
|---|---|---|---|
| `POST /auth/register` | Public | `{ username, email, password }` | `{ token }` (JWT) |
| `POST /auth/login` | Public | `{ email, password }` | `{ token }` (JWT) |

Register/login are IP-rate-limited in-memory (register: 3/hour, login: 5/15min) independent of
generation quotas. See [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md).

## Generation

| Method & Path | Auth | Body | Returns |
|---|---|---|---|
| `GET /generation-stats` | Public | — | `{ totalGenerations }` — global lifetime counter |
| `GET /generation-usage` | Public | — | `{ used, limit }` — resolves identity the same way `/generate` does (JWT → user row, else client IP → guest row) |
| `POST /generate` | Public | `GenerationRequest` (optional; see below) | `GenerationResponse` |

`POST /generate` runs the Python generator, uploads the result, and persists a `GeneratedPack`
(skipped for guests — see [Storage & Lifecycle](#storage--lifecycle)). Usage/quota is incremented
only after a successful generation + upload + persistence. A bare `POST /generate` with no body
works exactly like the original API — missing fields fall back to defaults.

**`GenerationRequest` fields** (all optional):

| Field | Default | Constraints | Meaning |
|---|---|---|---|
| `source` | `FACTORY` | `FACTORY` \| `CUSTOM_UPLOAD` | Analysis source |
| `amount` | `10` | 1–34 | Number of `.mid` files to generate |
| `packName` | `"IcePunk Pack"` | max 120 chars | Display name |
| `type` | `MELODY` | `MELODY` \| `DRUMS` | Generation type |
| `bpm` | `146` | 40–240 | Tempo |
| `pitch` | `0` | -12–12 | Transposition (semitones) |
| `octaves` | `1` | 1–4 | Pitch spread |
| `tempAnalysisId` | — | required if `source = CUSTOM_UPLOAD` and no `datasetIds` | Ties to an ephemeral analysis from `/datasets/analyze-temp` |
| `datasetIds` | — | up to 10 combined with `includeFactoryPool` | UUIDs of the caller's saved `DatasetPreset`s to generate from (JWT required to own them) |
| `includeFactoryPool` | `false` | — | Merge the bundled factory analysis pool in with `datasetIds` |
| `publishMode` | `PUBLIC` | `PUBLIC` \| `PRIVATE` | Initial visibility of the resulting pack |

`tempAnalysisId` and `datasetIds`/`includeFactoryPool` are two different ways to feed
`CUSTOM_UPLOAD`: a raw ephemeral upload, or one-or-more permanently saved presets (optionally
blended with the factory pool), up to 10 combined sources total.

**`GenerationResponse`:**

```json
{
  "packId": "uuid",
  "name": "Ice Pack",
  "source": "FACTORY",
  "type": "MELODY",
  "bpm": 146,
  "pitch": 0,
  "octaves": 1,
  "amount": 10,
  "createdAt": "2026-07-08T12:00:00Z",
  "packDownloadUrl": "/generated-packs/{packId}/download",
  "downloadUrl": "/generated-packs/{packId}/download",
  "totalGenerations": 12345,
  "items": [
    {
      "id": "uuid",
      "index": 0,
      "fileName": "icepunk_001.mid",
      "downloadUrl": "/generated-packs/{packId}/items/{itemId}/download",
      "durationSeconds": 8.5,
      "noteCount": 42,
      "trackCount": 1,
      "minPitch": 36,
      "maxPitch": 84,
      "avgPitch": 55.2,
      "bpm": 146,
      "preview": { "notes": [{ "pitch": 60, "start": 0.0, "duration": 0.5, "velocity": 90 }], "truncated": false }
    }
  ]
}
```

`downloadUrl` is a backward-compatible alias for `packDownloadUrl`. Both `download` URLs are
**relative paths proxied through the backend**, not direct storage URLs — the frontend must
prefix them with `NEXT_PUBLIC_API_URL` (see `apiUrl()` in `frontend/lib/api.ts`).

## Datasets

Two distinct mechanisms coexist: an ephemeral, unauthenticated temp-analysis workspace (24h TTL),
and a permanent, owned, named preset built from one.

| Method & Path | Auth | Body | Returns |
|---|---|---|---|
| `POST /datasets/analyze-temp` | Public | `multipart/form-data`, field `files` (1–100 `.mid`/`.midi`, ≤2MB each) | `201` `{ tempAnalysisId, fileCount, metadata }` |
| `POST /datasets` | JWT | `{ name, tempAnalysisId }` | `201` `DatasetPresetResponse` — promotes a temp analysis into a permanent, named preset |
| `GET /datasets` | JWT | — | `DatasetPresetResponse[]` — the caller's saved presets |
| `DELETE /datasets/{id}` | JWT + owner | — | `204` |

**`DatasetPresetResponse`:**

```json
{ "id": "uuid", "name": "My Dark Loops", "sourceMidiCount": 12, "createdAt": "2026-07-08T12:00:00Z" }
```

Preset names are unique per owner (`409` on duplicate). Deleting a preset removes both the DB row
and its saved analysis object in S3. See [ARCHITECTURE.md](codex/ARCHITECTURE.md) for the full
temp-analysis → preset → generation lifecycle and TTL/cleanup behavior.

## Generated Packs

| Method & Path | Auth | Body | Returns |
|---|---|---|---|
| `GET /generated-packs/feed?page=&size=` | Public | — | Paged `PUBLIC` packs, newest first (size max 50) |
| `GET /generated-packs/{packId}` | Public | — | One pack + its items (`404` if private and not the owner) |
| `GET /generated-packs/{packId}/download` | Public | — | Pack ZIP, proxied with `Content-Disposition` filename |
| `GET /generated-packs/{packId}/items/{itemId}/download` | Public | — | One `.mid` file, same proxied style |
| `GET /users/{username}/generated-packs?page=&size=` | Public | — | Paged `PUBLIC` packs for one user (profile page) |
| `GET /users/me/generated-packs` | JWT | — | All the caller's packs, including `PRIVATE` |
| `PATCH /generated-packs/{packId}/name` | JWT + owner | `{ name }` | Updated pack |
| `PATCH /generated-packs/{packId}/visibility` | JWT + owner | `{ visibility: "PUBLIC" \| "PRIVATE" }` | Updated pack |
| `DELETE /generated-packs/{packId}` | JWT + owner | — | `204` — deletes DB rows and S3 objects (zip + items) |

Guest generations are **not** persisted as `GeneratedPack` rows at all — they're ephemeral, upload-only
artifacts cleaned up purely by the ZIP retention sweep. Only authenticated generations show up in
the feed, in `/users/me/generated-packs`, or on a profile.

## User Uploads (uploaded MIDI projects)

Distinct from Generated Packs: these are user-supplied MIDI+one-shot-sample pairs, not generator
output. Likeable, no visibility toggle/rename/delete.

| Method & Path | Auth | Body | Returns |
|---|---|---|---|
| `GET /uploads/feed?page=&size=` | Public | — | Paged public uploaded projects |
| `GET /uploads/projects/{id}/midi` | Public | — | Streams the MIDI file inline (increments `download_count`) |
| `POST /uploads/projects` | JWT | `multipart/form-data`: `title`, `visibility`, `midi`, `sample` | Created project |
| `POST /uploads/projects/{id}/like` | JWT | — | `{ projectId, liked, likeCount }` (idempotent) |
| `DELETE /uploads/projects/{id}/like` | JWT | — | Same shape, unliked |

There is no delete endpoint for uploaded projects.

## Profile & Social

| Method & Path | Auth | Body | Returns |
|---|---|---|---|
| `GET /users/{username}/profile` | Public | — | `UserProfileResponse` |
| `GET /users/{username}/packs?page=&size=` | Public (JWT optional) | — | Paged public **uploaded projects** for that user, with `likedByViewer` if a token is sent |
| `GET /users/me` | JWT | — | `MeResponse` |
| `POST /users/me/profile` | JWT | `{ bio? }` | Updated `MeResponse` |
| `POST /users/me/avatar` | JWT | `multipart/form-data`: image file | Updated profile (uploads to S3 under `avatars/{ownerId}/`, falls back to local disk + `/user-uploads/**` on S3 failure) |
| `GET /users/me/favorites?page=&size=` | JWT | — | Paged **uploaded projects** the caller has liked, newest like first |

**`UserProfileResponse`:**

```json
{
  "id": 1, "username": "icepunk_fan", "bio": "dark ambient producer",
  "profilePictureUrl": null, "verified": false, "joinedAt": "2026-06-01T00:00:00Z",
  "packCount": 12, "totalDownloads": 340, "totalLikes": 8
}
```

`packCount` = public uploaded projects + public generated packs. `totalDownloads` and `totalLikes`
are computed from uploaded-project counters only — **there is no like/favorite mechanism for
Generated Packs** in the current schema.

`GET /users/{username}/packs` (uploaded projects) and `GET /users/{username}/generated-packs`
(generator output) are easy to conflate by name — they are different tables, different DTOs, and
power different profile tabs.

## Auth matcher gotcha worth knowing

`GET /users/me/generated-packs` is registered in `SecurityConfig` **before** the wildcard
`GET /users/*/generated-packs` permit-all rule, specifically so `me` doesn't fall through to the
public rule (first-match-wins). If you add a new endpoint under a wildcarded path family, check
the whole matcher chain in `SecurityConfig.java` before assuming `permitAll` scope.
