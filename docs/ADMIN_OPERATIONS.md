# Moderation access

Only trusted operators with a verified, active account may be promoted. Verify the
target account and email directly before running parameterized SQL through your
restricted database operator connection. Never accept a promotion request from a client.

```sql
UPDATE users SET role = 'ADMIN'
WHERE email = '<verified-operator-email>' AND verified = true AND account_status = 'ACTIVE';
```

Check that exactly one intended row changed. To revoke access:

```sql
UPDATE users SET role = 'USER' WHERE email = '<verified-operator-email>';
```

Roles are loaded from the database on every authenticated request; demotion applies
to existing JWTs immediately on their next request. Registration always creates USER.
No promotion endpoint exists.

GET /admin/reports accepts status, category, targetType and zero-based page (100 rows).
PATCH /admin/reports/{id} accepts status and optional operatorNotes (4000 characters).
Statuses are OPEN, REVIEWING, ACTIONED, REJECTED. Reopening is supported and clears
resolved_at; terminal statuses set resolved_at. Omitted notes preserve previous notes.
Moderation status alone does not delete or unpublish content. Operator notes are
restricted to this ADMIN API and excluded from account exports and report submission.

Account exports are blocked for DELETION_PENDING users, like other normal account access.
