# Privacy processors register

| Provider | Purpose | Data | Region | DPA/AVV | Transfer mechanism | Status |
|---|---|---|---|---|---|---|
| Hetzner Online GmbH | ICEPUNK Cloud Server: application, PostgreSQL, local MinIO and Redis | account, content and technical connection data processed by the app | Nuremberg, Germany (`nbg1`) | AVV created in the account on 2026-11-14; categories: personal master, communication and log data; data subjects: customers/prospects | No third-country transfer for this EU server location; review Hetzner subprocessors and support access with the AVV | Verified |
| Resend (Plus Five Five, Inc.) | Transactional verification and configured feedback delivery | recipient email, message content and delivery metadata | Configured sending region: Ireland (`eu-west-1`); this is not a universal storage-location claim | Dashboard confirms the signed DPA is fully executed on account signup | Resend DPA incorporates EU SCCs for ex-EEA transfers; review its current subprocessor list | Verified 2026-11-14; custom tracking subdomain not configured |
| [BACKUP_PROVIDER] | Encrypted off-host backup | backup copies | Not configured/verified | Not verified | Not verified | Release blocker |
| Porkbun | Verified sender-domain provider shown by Resend for `icepunk.app`; DNS/registrar role needs final confirmation | DNS/account contact data | Unverified | Unverified | Unverified | Review required |
| [MONITORING_PROVIDER] | uptime/operations if enabled | TODO | TODO | TODO | TODO | NOT APPLICABLE until enabled |

Resend checklist: review account entity, DPA, subprocessors and transfer mechanism; verify sender domain; use transactional messages only unless separate marketing consent exists.
