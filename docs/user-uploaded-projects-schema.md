# User Uploaded Projects Schema

This schema stores MIDI projects uploaded by registered users. It is a database foundation for future upload/library features and does not change the current MIDI generation flow.

## Table

`user_uploaded_projects`

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `BIGSERIAL` | Yes | Primary key. |
| `owner_id` | `BIGINT` | Yes | Owner user id. References `users(id)`. |
| `title` | `VARCHAR(120)` | Yes | User-facing project title. Blank titles are rejected by a check constraint. |
| `midi_object_key` | `VARCHAR(1024)` | Yes | Object-storage key for the uploaded MIDI file. Unique to prevent accidental duplicate records for the same object. |
| `sample_object_key` | `VARCHAR(1024)` | No | Optional object-storage key for an associated sample/audio asset. |
| `uploaded_at` | `TIMESTAMPTZ` | Yes | Upload timestamp. Defaults to `now()`. |
| `visibility` | `VARCHAR(20)` | Yes | Visibility state. Allowed values: `PRIVATE`, `UNLISTED`, `PUBLIC`. Defaults to `PRIVATE`. |
| `metadata` | `JSONB` | Yes | Structured project metadata. Defaults to an empty JSON object. Only JSON objects are accepted. |

## Relationships

- `owner_id` has a foreign key to `users(id)`.
- Deleting a user cascades to that user's uploaded projects.

## Indexes

- `idx_user_uploaded_projects_owner_id` supports listing projects by owner.
- `idx_user_uploaded_projects_owner_uploaded_at` supports owner library views sorted by newest upload.
- `idx_user_uploaded_projects_visibility_uploaded_at` supports future public/unlisted discovery views.
- `idx_user_uploaded_projects_metadata` is a GIN index for future metadata filtering.

## Constraints

- `midi_object_key` is unique.
- `visibility` is restricted to `PRIVATE`, `UNLISTED`, and `PUBLIC`.
- `title` must not be blank.
- `metadata` must be a JSON object.

## Migration

The schema is introduced by:

`backend/src/main/resources/db/migration/V2__user_uploaded_projects.sql`
