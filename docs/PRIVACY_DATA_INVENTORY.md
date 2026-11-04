# Privacy data inventory

Status: implementation inventory, not a substitute for a record of processing activities or legal advice.

| Processing | Data | Purpose / proposed basis | Recipient / storage | Retention / release status |
| --- | --- | --- | --- | --- |
| Account | username, email, BCrypt password hash, verification state | Account creation and authentication; contract/pre-contract steps | PostgreSQL, email delivery provider | Account lifetime; deletion workflow exists. Confirm final schedule. |
| Email verification | email, token hash, created/expiry/used times | Deliver and secure account verification | PostgreSQL + Resend | Token expires; provider terms/DPA and transfer assessment still required. |
| JWT | signed bearer token in browser localStorage | Authenticate API requests | Browser / backend validation | Configured expiry; security implications and retention must remain documented. |
| MIDI generation | requested parameters, generated pack metadata/object keys | Requested generator service | PostgreSQL + private MinIO/S3 | Generated ZIP retention configured; item/upload/profile retention needs final schedule. |
| User uploads/datasets/community | uploaded MIDI/audio, titles, public profile/avatar, reports | Requested upload/generation and voluntary publication | PostgreSQL + private object storage | User removal/account deletion exists; moderation/DSA lifecycle needs completion. |
| Contact / Desktop waitlist | email and consent indication | Respond/send requested Desktop updates | Resend inbox / provider | Set documented retention and unsubscribe/removal process before campaigns. |
| Security/rate limiting | IP-derived Redis keys, request timing | Abuse prevention | Redis | TTL-bound; confirm exact TTLs in notice. |
| Optional GA4 | Google-generated online identifiers and page events only after consent | Product analytics | Google Analytics | Requires valid opt-in, processor/transfer assessment and retention configuration. Disabled until release approval. |
| Product aggregates | date, metric name, integer count | Operations/product quality | PostgreSQL | No individual data. Owner must approve retention period. |

## Data subject controls

The product has account deletion/export flows. Privacy notice must publish the controller identity/contact, rights channel, authority, processors, international-transfer information, specific retention periods, analytics withdrawal route and an actionable waitlist removal channel before public promotion.
