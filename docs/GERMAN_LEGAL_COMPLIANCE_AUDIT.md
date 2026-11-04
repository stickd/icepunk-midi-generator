# German legal/privacy compliance audit

Audit date: 2026-11-04. This is an engineering evidence review, not legal advice; German counsel must approve launch terms.

## Confirmed current facts

* `/impressum` now displays the operator name, German service address and email supplied by the operator. `/datenschutz` and `/terms` still display unresolved controller/provider, retention, licence and age-policy placeholders.
* Email/password registration, email verification, public community packs/uploads, reporting/moderation primitives, account export/deletion and storage-backed files exist.
* Optional Google Analytics consent code is present in source but GA remains disabled unless a public build-time ID is supplied.
* No verified Factory MIDI-source licence trail was found.

## Requirements and risk

| Area | Finding | Risk / action owner |
| --- | --- | --- |
| DDG §5 Impressum | Operator identity/address and email are published. A direct-contact channel beyond email and confirmation of any conditional register/VAT/authority details remain unresolved. | **P1 / counsel confirmation** — operator + counsel. |
| GDPR Art. 5/6/7/13 | Current notice cannot identify controller, processors, legal bases, transfers, rights channel or actual retention in a complete way. | **P0** — operator/counsel, with processor contracts evidence. |
| TDDDG §25 + GA4 | Optional analytics must remain off until consent. Source design supports this; it needs network regression verification and legal notice/Google transfer review before enablement. | **P1** — operator/counsel/engineering. |
| Community/DSA | Reporting endpoint exists, but public policy, receipt/decision communications, statement-of-reasons/appeal process and transparency workflow are not fully evidenced. | **P1 before broad UGC launch** — moderation owner/counsel. |
| UrhG/licensing | Factory source provenance and licences absent. | **P0** — operator/counsel. |
| Consumer/payments | No sale/paid plan verified in current product. Pricing, withdrawal/VAT and consumer-contract duties must be reviewed before monetisation. | **Future monetisation blocker**. |

## Primary sources checked

* [TDDDG §25](https://www.gesetze-im-internet.de/ttdsg/__25.html): device storage/access needs informed consent unless a statutory exception applies.
* [DDG §5](https://www.gesetze-im-internet.de/ddg/__5.html): readily recognisable, directly accessible, permanently available provider identity/contact information and conditional business details.
* [GDPR Regulation (EU) 2016/679](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679): lawfulness, minimisation, consent and information duties.
* [Digital Services Act, Regulation (EU) 2022/2065](https://eur-lex.europa.eu/eli/reg/2022/2065/oj/eng): notice/action, decision notices and redress requirements for in-scope hosting/platform activity.

## Not legal conclusions

Whether iCEPUNK is a trader, which supervisory authority applies, whether a DPO is required, exact processor transfer mechanism, VAT/register details, minor policy and the copyright/licensing outcome cannot be inferred from code. They require verified operator facts and legal review.
