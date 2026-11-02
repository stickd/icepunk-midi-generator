ALTER TABLE users ADD COLUMN account_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'USER';
ALTER TABLE users ADD CONSTRAINT ck_users_account_status CHECK (account_status IN ('ACTIVE','DELETION_PENDING'));
ALTER TABLE users ADD CONSTRAINT ck_users_role CHECK (role IN ('USER','ADMIN'));

CREATE TABLE account_deletion_jobs (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  object_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ, retry_count INTEGER NOT NULL DEFAULT 0, last_error VARCHAR(500),
  CONSTRAINT ck_account_deletion_jobs_status CHECK (status IN ('PENDING','PROCESSING','RETRY','COMPLETE','FAILED')),
  CONSTRAINT ck_account_deletion_jobs_object_keys CHECK (jsonb_typeof(object_keys) = 'array')
);
CREATE INDEX idx_account_deletion_jobs_status ON account_deletion_jobs(status, updated_at);
