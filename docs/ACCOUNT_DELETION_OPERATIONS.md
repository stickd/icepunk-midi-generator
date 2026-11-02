# Account deletion operations

Jobs retain the original numeric user ID after the live user row is removed.
Completed jobs clear their object-key snapshot. Uploads, presets, tokens, legal
acceptances and likes cascade with the user; generated packs are explicitly
deleted, cascading their items. Content reports remain with a null reporter.

After investigating a FAILED job and restoring storage availability, an operator
may reset that specific job in PostgreSQL. Do not reactivate the user:

```sql
UPDATE account_deletion_jobs
SET status = 'RETRY', retry_count = 0, last_error = NULL,
    updated_at = now() - interval '61 seconds'
WHERE id = '<reviewed-job-uuid>' AND status = 'FAILED';
```

The next worker retries the persisted snapshot. Restrict this operation to DB
operators. Never delete failed jobs or their snapshots to clear an alert.
