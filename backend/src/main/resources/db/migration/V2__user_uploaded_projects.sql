CREATE TABLE user_uploaded_projects (
    id                BIGSERIAL     PRIMARY KEY,
    owner_id          BIGINT        NOT NULL,
    title             VARCHAR(120)  NOT NULL,
    midi_object_key   VARCHAR(1024) NOT NULL,
    sample_object_key VARCHAR(1024),
    uploaded_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    visibility        VARCHAR(20)   NOT NULL DEFAULT 'PRIVATE',
    metadata          JSONB         NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT fk_user_uploaded_projects_owner
        FOREIGN KEY (owner_id)
        REFERENCES users (id)
        ON DELETE CASCADE,
    CONSTRAINT uq_user_uploaded_projects_midi_object_key
        UNIQUE (midi_object_key),
    CONSTRAINT ck_user_uploaded_projects_visibility
        CHECK (visibility IN ('PRIVATE', 'UNLISTED', 'PUBLIC')),
    CONSTRAINT ck_user_uploaded_projects_title_not_blank
        CHECK (length(btrim(title)) > 0),
    CONSTRAINT ck_user_uploaded_projects_metadata_object
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX idx_user_uploaded_projects_owner_id
    ON user_uploaded_projects (owner_id);

CREATE INDEX idx_user_uploaded_projects_owner_uploaded_at
    ON user_uploaded_projects (owner_id, uploaded_at DESC);

CREATE INDEX idx_user_uploaded_projects_visibility_uploaded_at
    ON user_uploaded_projects (visibility, uploaded_at DESC);

CREATE INDEX idx_user_uploaded_projects_metadata
    ON user_uploaded_projects USING GIN (metadata);
