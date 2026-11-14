ALTER TABLE content_reports ADD COLUMN notice_type VARCHAR(16) NOT NULL DEFAULT 'COMMUNITY';
ALTER TABLE content_reports ADD COLUMN reporter_name VARCHAR(160);
ALTER TABLE content_reports ADD COLUMN reporter_good_faith BOOLEAN NOT NULL DEFAULT false;
