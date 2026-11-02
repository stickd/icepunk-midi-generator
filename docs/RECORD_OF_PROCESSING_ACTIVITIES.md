# Lightweight record of processing activities

| Activity | Purpose/data | Recipients/transfers | Retention | TOMs |
|---|---|---|---|---|
| Accounts/auth | email, username, password hash, timestamps | hosting TODO | account lifecycle TODO | BCrypt, TLS, JWT |
| Verification | email, token hash | Resend TODO | 60 min + cleanup | hashed one-time tokens |
| Security | IP-derived hashes/rate limits/logs | hosting TODO | 15m/1h TTL; logs TODO | Redis, rate limiting |
| Content | MIDI/samples/metadata/profile | storage/backup TODO | product lifecycle TODO | private storage, authorization |
| Feedback | name/email/message | Resend TODO | feedback policy TODO | transport security |
