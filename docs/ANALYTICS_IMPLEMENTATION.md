# Analytics implementation

## Status

**Implemented in source, not enabled or deployed.** Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` only after the release blockers in `LEGAL_RELEASE_BLOCKERS.md` are resolved and a browser network check has passed. The intended production value is supplied by the operator, not hard-coded in source.

## GA4 consent design

The frontend has a local, versioned preference with one optional category: analytics. It shows an accessible dialog headed **Privacy preferences** before Google resources are requested. Equal-priority Reject optional and Accept analytics buttons are available, with a Customize path. The default is no analytics.

* No `gtag.js` script, GA request, or GA cookie is created while consent is unknown or rejected.
* After analytics consent, the Next.js client loads `gtag.js` once and uses `send_page_view: false`; route changes send one manual page view.
* Consent configuration grants `analytics_storage` only. `ad_storage`, `ad_user_data`, and `ad_personalization` remain denied.
* Rejecting or withdrawing prevents subsequent page views, disables the measurement ID and expires `_ga` / `_ga_*` cookies where browser policy permits.
* The preference is stored only in browser localStorage as `{ version, analytics }`. No server-side consent profile or cross-site identifier is created. If storage is unavailable, the choice remains effective for the current tab and the UI does not crash.

This is deliberately **Basic Consent Mode**: the Google script is conditionally rendered only after affirmative consent. It does not use Advanced Mode cookieless pings before consent.

## Deployment verification checklist

1. Supply `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-WV974GJFML` in the production environment only after approval, then rebuild the frontend (Next public variables are build-time values).
2. In a new browser profile, inspect Network: before any decision and after Reject optional there must be no request to `googletagmanager.com` or `google-analytics.com`, and no `_ga` cookie.
3. Accept analytics: exactly one script request and one initial `page_view`; navigate once and verify one further page view, not duplicates.
4. Open Cookie settings, reject after accepting, then verify no later page views and that GA cookies are expired.
5. Test keyboard focus, Escape/close policy, a small mobile viewport, private browsing/storage-disabled mode, and the published German privacy notice.

## Server aggregate product metrics

`product_metric_daily` stores only `metric_date`, `metric_name`, and integer `count`. PostgreSQL `INSERT ... ON CONFLICT ... DO UPDATE` makes increments safe under concurrent requests. It contains no user ID, IP, session ID, browser fingerprint, referrer, raw event, or per-user timeline.

Metrics: `GENERATION_SUCCEEDED`, `GENERATION_FAILED`, `GENERATION_LIMIT_REACHED`, `REGISTRATION_COMPLETED`, `PUBLIC_PACK_CREATED`, and `EXPORT_URL_ISSUED`. An export means that the server issued an authorized signed download URL; it does **not** prove that the browser fetched the object.

`GET /admin/product-metrics?days=7|30` is protected by the existing server-side `/admin/**` `ROLE_ADMIN` rule. It returns daily rows, totals and the generation failure percentage. Do not expose this API to ordinary users.

Retention must be set by the operator in the privacy/retention schedule before release; no automatic deletion job is intentionally assumed as a legal decision.
