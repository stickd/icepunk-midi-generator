ALTER TABLE users
    ADD COLUMN bio        VARCHAR(300),
    ADD COLUMN credits    INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN verified   BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE user_uploaded_projects
    ADD COLUMN download_count BIGINT NOT NULL DEFAULT 0;

CREATE TABLE project_likes (
    user_id    BIGINT      NOT NULL,
    project_id BIGINT      NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_project_likes PRIMARY KEY (user_id, project_id),
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
