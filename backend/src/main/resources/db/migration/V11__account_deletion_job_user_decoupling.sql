ALTER TABLE account_deletion_jobs DROP CONSTRAINT account_deletion_jobs_user_id_fkey;
ALTER TABLE account_deletion_jobs ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE account_deletion_jobs ADD COLUMN user_id_snapshot BIGINT;
UPDATE account_deletion_jobs SET user_id_snapshot = user_id;
ALTER TABLE account_deletion_jobs ALTER COLUMN user_id_snapshot SET NOT NULL;
ALTER TABLE account_deletion_jobs ADD CONSTRAINT account_deletion_jobs_user_id_fkey
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
