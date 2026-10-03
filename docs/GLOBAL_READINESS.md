# Global readiness

MetricOra is sold to organisations in any country. This is where the product
already works anywhere, where it still assumes the UK, and what to fix next.
Counts are from a search of the repository on 3 October 2026.

## Works anywhere

- Multi-tenant by design: every query carries the organisation.
- Electricity location-based factors for about 125 countries (ADEME Base
  Carbone, by ISO code), UK (DEFRA) and US (EPA) libraries, spend factors in
  GBP, USD and EUR, ECB currency conversion, CPI deflation for GBP, USD, EUR.
- `Organization.hqCountry` and `reportingCurrency` exist.
- New in this release: `lib/i18n/org-format.ts` formats numbers, dates and
  money from the organisation's country and currency. The sustainability
  report and the climate disclosure use it. The climate disclosure has no
  jurisdiction, currency or scenario set built in.

## Still assumes the UK

| Area | What | Effect elsewhere | Suggested fix |
|---|---|---|---|
| Formatting | 317 `toLocale…("en-GB")` calls; 195 files mention `en-GB`, `GBP` or `£` | Dates and numbers read as UK everywhere else; money shown as £ | Move each report and page to `orgFormat()`; start with the PDFs customers send out |
| Currency | `reportingCurrency` defaults to `GBP`; the social value model records pounds only | A non-UK org that never sets it sees GBP | Ask for the currency at sign-up from the HQ country; label social value as GBP wherever it appears (done in the sustainability report) |
| Units | A bare `gallon` converts as the UK gallon (4.546 L); a US gallon is 3.785 L | A US org importing "gallon" is out by 20% | Added explicit `us gal`, `uk gallon`, `imperial gallon`. Next: decide the bare word from `hqCountry` and bump the methodology version, because it changes figures |
| Regulation | PPN 006 CRP, SECR, PPN 026 and National TOMs social value, Find a Tender, Considerate Constructors, UK postcodes for local spend, BREEAM, NHS Evergreen | Meaningless to a non-UK buyer, but harmless | Show UK-only items only when `hqCountry` is GB (or the org opts in); add equivalents when customers ask (for example Australia's NGER, California SB 253, EU CSRD is partly covered by ESRS pages) |
| Language | English only, UK spelling | Fine for English-speaking markets; no translation layer | Not started. Translate the app shell first, reports second |
| Time zones | Dates are stored as dates; report times are UTC or server time | Off by up to a day in far time zones for timestamps | Use the organisation's time zone for display only |
| Distances | Commuting survey asks miles | Odd outside the UK and US | Offer km or miles by locale |
| Tenders and bids | Bid carbon pack follows UK tender rules | Not relevant abroad | Keep as is; add other regions on demand |

## Rules for new work

1. No country, currency, regulator or scenario set hard-coded in a shared
   feature. If one is needed, make it data the organisation chooses.
2. Format through `orgFormat()`/`formatters()`. A figure in a fixed currency
   (like GBP social value) says so in its label.
3. Do not copy a standard's text. Use our own labels, with a reference to the
   standard.
4. A report says it is consistent with a framework only when the organisation's
   own records show it is, and a person has approved it.
5. Test with a non-UK organisation (for example `de-DE`, EUR; `en-US`, USD).
