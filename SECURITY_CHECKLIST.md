# IcePunk public deploy security checklist

## Implemented MVP protections

- Register throttling: 3 attempts per IP per hour.
- Login throttling: 5 attempts per IP per 15 minutes.
- Guest generation limit: 3 successful generations per IP per day.
- Logged-in user generation limit: 7 successful generations per user per day.
- Generation usage is incremented only after successful Python generation and ZIP upload.
- Global generation counter is incremented only after successful ZIP upload.
- Duplicate email and username registration returns `409 Conflict`.
- Unexpected backend errors return a generic message instead of raw exception details.

## VPS / reverse proxy requirements

- Configure the reverse proxy to set `X-Forwarded-For` and `X-Real-IP`.
- Do not pass untrusted client-supplied forwarding headers through unchanged.
- Set `CORS_ALLOWED_ORIGINS` to the exact frontend domain, not `*`.
- Set a strong `JWT_SECRET` with at least 32 random characters.
- Set real production values for PostgreSQL, S3/MinIO, and Resend env variables.
- Add CAPTCHA/Turnstile to registration before heavy public traffic.

## Known MVP limitations

- Register/login throttling is in-memory. It resets on backend restart and is per backend instance.
- Use Redis or another shared store before running multiple backend replicas.
- Existing databases should be checked for duplicate usernames before deploying the new unique username constraint.
