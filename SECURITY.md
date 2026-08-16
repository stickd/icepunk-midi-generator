# Security Policy

## Reporting a vulnerability

Please do not open a public GitHub issue for security vulnerabilities.

Instead, use [GitHub's private vulnerability reporting](https://github.com/stickd/icepunk-midi-generator/security/advisories/new)
for this repository, or email croxplays9@gmail.com with details and reproduction steps.

We aim to acknowledge reports within 5 business days.

## Supported versions

This project does not maintain multiple release branches. Only the `main` branch is supported;
please make sure you can reproduce the issue there before reporting.

## Scope

See [SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md) for the application-level hardening already in
place (rate limiting, generation limits, error handling) and known limitations of the current MVP.

## Resource access model

Generated packs are private unless their server-side visibility is `PUBLIC`. A private pack, its
items, and its presigned URLs are available only to the owner; requests from any other user are
answered as `404` to avoid confirming the resource exists. Generated item access always checks its
parent pack ID as well as the item ID.

Dataset presets are owner-only. Temporary MIDI analysis is never addressable by its UUID alone:
authenticated analyses are bound to the owner and guest analyses require the opaque temporary
capability returned by `/datasets/analyze-temp`. The capability expires with the analysis TTL.

All generated storage buckets remain private. The backend authorizes before issuing short-lived
presigned GET URLs (`Cache-Control: no-store`); object keys and internal storage endpoints are not
serialized in public API responses. See `docs/api.md` and
`scripts/security/verify-private-resource-access.ps1` for verification guidance.
