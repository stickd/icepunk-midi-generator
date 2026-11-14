ALTER TABLE content_reports ADD COLUMN decision_basis VARCHAR(1000);
ALTER TABLE content_reports ADD COLUMN decision_facts VARCHAR(4000);
ALTER TABLE content_report_history ADD COLUMN decision_basis VARCHAR(1000);
ALTER TABLE content_report_history ADD COLUMN decision_facts VARCHAR(4000);
CREATE OR REPLACE FUNCTION record_content_report_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.status,NEW.moderation_action,NEW.decision_reason,NEW.decision_basis,NEW.decision_facts)
    IS DISTINCT FROM ROW(OLD.status,OLD.moderation_action,OLD.decision_reason,OLD.decision_basis,OLD.decision_facts) THEN
 INSERT INTO content_report_history(report_id,status,moderation_action,decision_reason,decision_basis,decision_facts)
 VALUES(NEW.id,NEW.status,NEW.moderation_action,NEW.decision_reason,NEW.decision_basis,NEW.decision_facts);
 END IF;
 RETURN NEW;
END $$;
