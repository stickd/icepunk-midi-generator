ALTER TABLE users
    ADD COLUMN bio VARCHAR(300),
    ADD COLUMN credits INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE user_uploaded_projects
    ADD COLUMN download_count BIGINT NOT NULL DEFAULT 0;

CREATE TABLE project_likes (
    user_id    BIGINT      NOT NULL,
    project_id BIGINT      NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, project_id),
    CONSTRAINT fk_project_likes_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_project_likes_project
        FOREIGN KEY (project_id)
        REFERENCES user_uploaded_projects (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_project_likes_project_id
    ON project_likes (project_id);

CREATE INDEX idx_project_likes_user_created_at
    ON project_likes (user_id, created_at DESC);

CREATE TABLE generated_packs (
    id              UUID         PRIMARY KEY,
    owner_id        BIGINT,
    guest_session_id VARCHAR(255),
    name            VARCHAR(120) NOT NULL,
    source_type     VARCHAR(40)  NOT NULL,
    generation_type VARCHAR(40)  NOT NULL,
    bpm             INTEGER,
    pitch           INTEGER,
    octaves         INTEGER,
    amount          INTEGER      NOT NULL,
    visibility      VARCHAR(20)  NOT NULL DEFAULT 'PUBLIC',
    zip_object_key  VARCHAR(1024) NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ,
    metadata        JSONB,
    CONSTRAINT fk_generated_packs_owner
        FOREIGN KEY (owner_id)
        REFERENCES users (id)
        ON DELETE SET NULL,
    CONSTRAINT uq_generated_packs_zip_object_key
        UNIQUE (zip_object_key),
    CONSTRAINT ck_generated_packs_name_not_blank
        CHECK (length(btrim(name)) > 0),
    CONSTRAINT ck_generated_packs_source_type
        CHECK (source_type IN ('FACTORY', 'CUSTOM_UPLOAD')),
    CONSTRAINT ck_generated_packs_generation_type
        CHECK (generation_type IN ('MELODY', 'DRUMS')),
    CONSTRAINT ck_generated_packs_visibility
        CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
    CONSTRAINT ck_generated_packs_amount_positive
        CHECK (amount > 0),
    CONSTRAINT ck_generated_packs_metadata_object
        CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object')
);

CREATE TABLE generated_pack_items (
    id              UUID         PRIMARY KEY,
    pack_id         UUID         NOT NULL,
    item_index      INTEGER      NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    midi_object_key VARCHAR(1024) NOT NULL,
    duration_seconds DOUBLE PRECISION,
    note_count      INTEGER,
    track_count     INTEGER,
    min_pitch       INTEGER,
    max_pitch       INTEGER,
    avg_pitch       DOUBLE PRECISION,
    bpm             INTEGER,
    metadata        JSONB,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT fk_generated_pack_items_pack
        FOREIGN KEY (pack_id)
        REFERENCES generated_packs (id)
        ON DELETE CASCADE,
    CONSTRAINT uq_generated_pack_items_midi_object_key
        UNIQUE (midi_object_key),
    CONSTRAINT uq_generated_pack_items_pack_index
        UNIQUE (pack_id, item_index),
    CONSTRAINT ck_generated_pack_items_index_non_negative
        CHECK (item_index >= 0),
    CONSTRAINT ck_generated_pack_items_metadata_object
        CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object')
);

CREATE INDEX idx_generated_packs_owner_id
    ON generated_packs (owner_id);

CREATE INDEX idx_generated_packs_created_at
    ON generated_packs (created_at DESC);

CREATE INDEX idx_generated_packs_visibility
    ON generated_packs (visibility);

CREATE INDEX idx_generated_pack_items_pack_id
    ON generated_pack_items (pack_id);

CREATE INDEX idx_generated_pack_items_pack_index
    ON generated_pack_items (pack_id, item_index);
