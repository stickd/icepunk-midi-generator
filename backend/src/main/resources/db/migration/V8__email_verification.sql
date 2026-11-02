-- `verified` existed before email verification was introduced. Existing accounts
-- stay usable; only accounts created after this migration require verification.
UPDATE users SET verified = TRUE WHERE verified = FALSE;

CREATE TABLE email_verification_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_email_verification_tokens_user_active
    ON email_verification_tokens (user_id, used_at);
