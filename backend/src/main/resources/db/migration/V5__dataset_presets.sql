CREATE TABLE dataset_presets (
    id                  UUID          PRIMARY KEY,
    owner_id            BIGINT        NOT NULL,
    name                VARCHAR(100)  NOT NULL,
    analysis_object_key VARCHAR(1024) NOT NULL,
    source_midi_count   INTEGER       NOT NULL,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT fk_dataset_presets_owner
        FOREIGN KEY (owner_id)
        REFERENCES users (id)
        ON DELETE CASCADE,
    CONSTRAINT uq_dataset_presets_owner_name
        UNIQUE (owner_id, name),
    CONSTRAINT uq_dataset_presets_analysis_object_key
        UNIQUE (analysis_object_key),
    CONSTRAINT ck_dataset_presets_name_not_blank
        CHECK (length(btrim(name)) > 0),
    CONSTRAINT ck_dataset_presets_source_count_positive
        CHECK (source_midi_count > 0)
);

CREATE INDEX idx_dataset_presets_owner_id
    ON dataset_presets (owner_id);
