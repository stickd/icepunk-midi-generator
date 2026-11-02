CREATE TABLE user_legal_acceptances (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(32) NOT NULL, document_version VARCHAR(32) NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_legal_acceptance UNIQUE(user_id, document_type, document_version)
);
CREATE INDEX idx_user_legal_acceptances_user ON user_legal_acceptances(user_id);

CREATE TABLE content_reports (
  id UUID PRIMARY KEY, reporter_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  target_type VARCHAR(32) NOT NULL, target_id VARCHAR(64) NOT NULL,
  category VARCHAR(32) NOT NULL, description VARCHAR(2000), status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ, operator_notes TEXT,
  CONSTRAINT ck_content_reports_type CHECK (target_type IN ('GENERATED_PACK','UPLOAD')),
  CONSTRAINT ck_content_reports_category CHECK (category IN ('COPYRIGHT','ILLEGAL_CONTENT','HARASSMENT','SPAM','OTHER')),
  CONSTRAINT ck_content_reports_status CHECK (status IN ('OPEN','REVIEWING','ACTIONED','REJECTED'))
);
CREATE INDEX idx_content_reports_status_created ON content_reports(status, created_at);
