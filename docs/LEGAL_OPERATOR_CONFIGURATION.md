# Legal operator configuration

Status: evidence register, updated 14 November 2026. It records observations, not
legal conclusions. Do not turn an unchecked item into a statement on the public
legal pages.

## Verified in the operator's Hetzner account

| Item | Observation | What may be stated publicly | Open action |
| --- | --- | --- | --- |
| Controller details | Account holder is **Danylo Nikulin**; the account shows Ahrstraße 1, 53424 Remagen and stickd999@gmail.com. | Controller name, service address and contact email, subject to the operator confirming these are the intended public details. | Confirm the email is the continuing legal/privacy contact and whether any business/register/VAT details apply. |
| Hosting | Hetzner Cloud project **ICEPUNK Production** has one server, `ubuntu-2gb-nbg1-1`; `nbg1` is Nuremberg, Germany. No Hetzner Object Storage or Storage Box is in that project. | The app is hosted on a Hetzner Cloud Server in Nuremberg, Germany. | Create the AVV before processing public-user data. |
| Hetzner AVV/DPA | AVV created in the account on 14 November 2026. It covers personal master data, communication data and log data for customers/prospects. Hetzner confirms that the checkbox acceptance completes the agreement and no separate signature is required. | Hetzner processes hosting data under an AVV pursuant to Art. 28 GDPR. | Download and retain the executed copy; review Hetzner's published subprocessors when they change. |

Selected Hetzner AVV categories: **Personenstammdaten**, **Kommunikationsdaten**,
**Protokolldaten**; affected persons: **Kunden und Interessenten des Auftraggebers**.
Do not select
payment or employee/supplier data unless the production server actually processes it.

## Still not verified

| Area | Current evidence | Public-policy rule | Required evidence/decision |
| --- | --- | --- | --- |
| Resend | Account inspected: it sends ICEPUNK verification and waitlist emails; `icepunk.app` is a verified sender domain, configured for `eu-west-1` (Ireland). The dashboard states its signed DPA becomes fully executed on signup. Custom tracking subdomain is not configured. | State only the configured sending region, processing purpose and DPA/SCC safeguards. Do not describe this as the storage location for every Resend system or promise a provider-retention period. | Review Resend's changing subprocessor list and the DPA on each material change; decide whether tracking should remain disabled. |
| Off-host backup | Production configuration contains only placeholder `BACKUP_S3_*` values. The Hetzner project has no Bucket/Storage Box. | Do not state a backup provider, region or backup deletion cycle. | Name the provider/bucket region; confirm encryption, remote retention, deletion/versioning behaviour and DPA/transfer mechanism. |
| Monitoring | No monitoring provider is configured in the repository or identified in Hetzner. | Do not name a monitoring processor or promise alert/log retention. | Identify the service, or document that monitoring is host-local only; set log/alert retention. |
| DNS/domain | Resend identifies Porkbun as the provider for the verified `icepunk.app` sender domain; the Hetzner Cloud project has no DNS zones. | Do not claim Porkbun's data region/DPA position yet. | Review Porkbun's privacy/DPA and identify the authoritative DNS configuration. |
| Retention | Code configures 60-minute verification tokens, 24-hour temporary analysis and two-day generated ZIP cleanup. It does not prove production values or external backup/log retention. | Publish only the code-backed durations after production settings are checked; do not promise a final backup deletion deadline. | Verify deployed values and decide account/content, contact/waitlist, access-log and backup retention. |

These are operator prerequisites, not values to invent in repository templates:

- Controller: full legal name, business name if applicable, serviceable postal address,
  contact email and privacy email, legal form, representative, register and registration
  number where applicable, VAT ID / W-IdNr where applicable, competent supervisory authority.
- Providers: identify hosting, remote backup and monitoring providers; review each DPA/AVV,
  processor/subprocessor list, processing regions and international transfer mechanism.
  Review Resend's DPA/AVV and subprocessors separately. Record the actual agreed arrangements.
- Retention: decide and configure feedback, application/access logs and remote-backup retention;
  confirm deletion/expiry settings with each provider. Repository token cleanup does not
  establish a retention policy for external backups or logs.
- Product policy: approve generated-output licensing, minors/age policy and public/community
  rules, then complete the legal page templates consistently with those decisions.

Before release, replace all operator placeholders on Impressum, Datenschutz and Terms,
verify contact channels, and obtain qualified legal review of the final real-world setup.
