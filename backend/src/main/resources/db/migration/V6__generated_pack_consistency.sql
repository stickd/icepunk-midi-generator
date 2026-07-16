ALTER TABLE generated_packs ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'READY';
ALTER TABLE generated_packs ADD COLUMN failure_code VARCHAR(80);
ALTER TABLE generated_packs ADD COLUMN finalized_at TIMESTAMPTZ;
ALTER TABLE generated_packs ADD COLUMN cleanup_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE generated_packs ADD COLUMN cleanup_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE generated_packs ADD COLUMN cleanup_last_error VARCHAR(500);
ALTER TABLE generated_packs ALTER COLUMN zip_object_key DROP NOT NULL;
CREATE INDEX idx_generated_packs_status_created ON generated_packs(status, created_at);
