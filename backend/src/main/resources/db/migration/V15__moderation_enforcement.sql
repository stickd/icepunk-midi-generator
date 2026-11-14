ALTER TABLE content_reports ADD COLUMN decision_reason VARCHAR(4000);
CREATE TABLE content_report_history (
 id BIGSERIAL PRIMARY KEY,
 report_id UUID NOT NULL REFERENCES content_reports(id) ON DELETE CASCADE,
 status VARCHAR(32) NOT NULL,
 moderation_action VARCHAR(16) NOT NULL,
 decision_reason VARCHAR(4000),
 recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE FUNCTION record_content_report_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.status,NEW.moderation_action,NEW.decision_reason) IS DISTINCT FROM ROW(OLD.status,OLD.moderation_action,OLD.decision_reason) THEN
 INSERT INTO content_report_history(report_id,status,moderation_action,decision_reason)
 VALUES(NEW.id,NEW.status,NEW.moderation_action,NEW.decision_reason);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER content_report_change AFTER UPDATE ON content_reports
FOR EACH ROW EXECUTE FUNCTION record_content_report_change();

-- Enforce this at the database boundary, including concurrent visibility updates.
ALTER TABLE generated_packs ADD COLUMN moderation_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_uploaded_projects ADD COLUMN moderation_hidden BOOLEAN NOT NULL DEFAULT false;
UPDATE generated_packs p SET moderation_hidden=true,visibility='PRIVATE'
WHERE EXISTS(SELECT 1 FROM content_reports r WHERE r.target_type='GENERATED_PACK' AND r.target_id=p.id::text AND r.moderation_action='HIDE');
UPDATE user_uploaded_projects p SET moderation_hidden=true,visibility='PRIVATE'
WHERE EXISTS(SELECT 1 FROM content_reports r WHERE r.target_type='UPLOAD' AND r.target_id=p.id::text AND r.moderation_action='HIDE');
ALTER TABLE generated_packs ADD CONSTRAINT moderated_pack_private CHECK(NOT moderation_hidden OR visibility='PRIVATE');
ALTER TABLE user_uploaded_projects ADD CONSTRAINT moderated_upload_private CHECK(NOT moderation_hidden OR visibility='PRIVATE');
