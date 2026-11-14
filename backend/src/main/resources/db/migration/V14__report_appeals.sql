ALTER TABLE content_reports ADD COLUMN moderation_action VARCHAR(16) NOT NULL DEFAULT 'NONE';
ALTER TABLE content_reports ADD COLUMN appeal_text VARCHAR(2000), ADD COLUMN appealed_at TIMESTAMPTZ;
