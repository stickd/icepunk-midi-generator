# ICEPUNK SEO launch checklist

This checklist describes the manual work that happens **after** the site is deployed. It does not require adding credentials, DNS records or analytics code to the repository.

## Already present in the application

- Canonical URLs and page-level metadata for the public home page, Desktop page, legal pages and DAW guides.
- Open Graph and Twitter metadata with the ICEPUNK social image.
- `robots.txt` and `/sitemap.xml`.
- A visible homepage H1, factual product content, internal links to the DAW guides, and `noindex` on public profile pages.

## Google Search Console

1. Open Google Search Console and add `icepunk.app` as a **Domain property**.
2. Verify ownership with the DNS TXT record shown by Google. Add the record at the DNS provider; do not put it in this repository.
3. After verification, submit `https://icepunk.app/sitemap.xml` in **Sitemaps**.
4. Use **URL Inspection** to request indexing for:
   - `https://icepunk.app/`
   - `https://icepunk.app/desktop`
   - `https://icepunk.app/guides/fl-studio-midi`
   - `https://icepunk.app/guides/ableton-midi`
5. Monitor **Pages** for indexing and exclusions, **Sitemaps** for processing errors, and **Performance** for queries, clicks and impressions.

## Bing Webmaster Tools

1. Add the `icepunk.app` site in Bing Webmaster Tools.
2. Verify ownership through the method Bing provides (DNS verification is usually the cleanest for a domain property).
3. Submit `https://icepunk.app/sitemap.xml`.
4. Review the index coverage and search performance views after Bing has crawled the site.

## Analytics preparation — no tracker is enabled yet

Choose the measurement approach before implementation:

- **Privacy-friendly web analytics** is useful for page views, referrers, acquisition and broad conversion counts with minimal personal-data collection.
- **Product analytics** is useful when ICEPUNK needs event funnels, feature adoption and retention analysis. It needs a more deliberate consent, data-retention and vendor review.

If analytics is enabled later, use a small and documented event taxonomy:

| Event | When it fires |
| --- | --- |
| `generate` | A MIDI generation successfully starts or completes; define one of these precisely before implementation. |
| `preview` | A user starts a MIDI preview. |
| `download_midi` | A user downloads an individual MIDI file or pack. |
| `signup_open` | The account-registration UI opens. |
| `signup_complete` | Registration completes successfully. |
| `waitlist_submit` | The Desktop waitlist request completes successfully. |

Before adding any tracker, update the Privacy Policy and cookie/consent flow as required for the selected provider, regions served and the exact data collected. Do not send email addresses, raw MIDI, passwords, JWTs, IP addresses or other sensitive values as analytics event properties.
