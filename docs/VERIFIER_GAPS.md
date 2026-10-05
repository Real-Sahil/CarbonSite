# Verifier briefing: known limits of the calculation and forecasting

For an independent verifier or technical reviewer. It lists what the platform does **not** yet do, or does with a caveat, and where each shows in the product, so nothing has to be found by accident. Nothing here has been reviewed by a third party yet; that is what this document is for.

Written 5 October 2026 from the repository at that date. Re-check against the code before relying on a line; the "Where" column names files and strings to search for.

## 1. How to reproduce a figure

1. Open a published snapshot and use **Trace a figure** (`/orgs/{orgId}/lineage`): headline split by evidence tier, category totals, then calculations largest first with record, factor, formula, selection reason, warnings and evidence.
2. Download the **assurance pack** (`GET /api/orgs/{orgId}/snapshots/{snapshotId}/assurance-pack`): `calculations.csv` (every calculation with factor, selection reason, formula, warnings, tier), `factors.csv`, `evidence-index.csv` plus the files, `audit-log.csv` with the hash chain, `manifest.sha256`.
3. Recompute a sample by hand: `amount (normalised unit) x factor` from `factors.csv`, using the formula string on each row. Calculation rows are immutable; a new run writes new rows.
4. Pick the sample with extra weight on the items in section 2.

Existing automated checks worth reading first: `lib/calculation/__tests__/` (units, factor selection, engine, Scope 2 instruments, spend, library fallback, regional grid, Monte Carlo, pedigree), `report-dashboard-reconciliation.test.ts` (report totals equal dashboard totals), `tests/golden/pilot-inventory.test.ts`, `tests/security/` (tenant isolation). These are the platform's own tests, not independent evidence.

## 2. Calculation: known limits

| # | Limit | What happens | Where it shows | Suggested check |
|---|---|---|---|---|
| C1 | **No factor found** | The record is saved at 0 kg CO2e, not refused. | Red alert on the dashboard (`noFactorCount`, `app/(app)/orgs/[orgId]/dashboard/page.tsx`); calculation row with 0 and a selection reason. | Count zero-valued calculations per run; confirm each was reviewed. |
| C2 | **Unit the factor cannot use** | Either a visible zero, or calculated with the warning "Unit mismatch: activity X vs factor Y" (`lib/calculation/engine.ts`); which one depends on whether the unit converts. Not traced for every library. | Warnings column in `calculations.csv`. | List all rows with that warning. |
| C3 | **Unverified factors** | A factor whose notes say "Unverified:" still calculates, with a warning. Affects the seeded DEFRA `eeio-2025-*` and EPA 3-digit `useeio-v1.3-naics-*` spend factors. | Warning text "The selected factor is marked Unverified" (`lib/calculation/industry-code.ts`). | Filter `calculations.csv` for it; ask for the spend records behind them. |
| C4 | **Library fallback uses another library or country** | A record the run's library cannot price is priced from DEFRA, then ADEME, with a warning naming the library and any other country as a proxy. Never for grid electricity or heat. Applies to EPA, NGA, ECCC, UBA, SEAI runs. | Selection reason starts "fallback library"; dashboard counts it as fallback kg (`lib/calculation/library-fallback.ts`). | Total the fallback kg per run; judge whether the proxy is acceptable for the regime submitted to. |
| C5 | **GWP basis mixed** | Methodology is IPCC AR6; EPA, USEEIO and NGA factors are published at AR5 and are not restated. | Stated on reports (`factorAttribution()` in `lib/reports/attribution.ts`). | Quantify the difference for the gases involved; confirm the statement appears on every report that uses those libraries. |
| C6 | **Single-gas libraries** | SEAI factors are CO2 only (no CH4 or N2O). ECCC is electricity only. | Attribution text on reports; library label in the run picker (`lib/calculation/library-options.ts`). | Confirm the report states it. |
| C7 | **Regional grid and eGRID selection is by named text or facility field only** | A state, province or eGRID subregion factor is used only when the record text or the facility field names it; otherwise the national figure. Western Australia is read as SWIS with a warning. | Selection reason; warning text on WA records (`lib/calculation/regional-grid.ts`, `egrid-subregion.ts`). | Check facilities in AU, CA and US have the field set where it matters. |
| C8 | **Factor hint matching changed** | Before methodology `ghg-protocol-v2026-05`, a fuel word in a record's detail text matched by substring, so "diesel" could select a "biodiesel" factor in a library that lists both. The new rule matches from the start of a word. Not checked whether any published DEFRA snapshot was affected. | Methodology changelog (full text, in the app); selection reason `detail matched "..."`. | In snapshots under versions before v2026-05, search for factor ids containing "biodiesel" on records whose text says diesel. |
| C9 | **FX and inflation fallbacks** | Spend is converted at the ECB rate for the record's date; if unavailable, today's rate, then a built-in rate. Deflation uses UK CPI, US CPI-U, euro area HICP or France HICP tables that are updated by hand each year (data upkeep job proposes the change). | The calculation states which rate source was used; `lib/calculation/price-index.ts`, `units.ts`. | List calculations that used the built-in rate; confirm the CPI table against the statistics offices. |
| C10 | **Spend factors need an industry code** | Without one, industry-priced spend factors are excluded and the calculation says to add the code. | Calculation message (`industryMissingWarning`). | Count spend records without a code. |
| C11 | **Gallons** | A bare "gallon" is US for US-country records, imperial elsewhere with a note. | Warning "enter US gallons if these are". | Check fuel records using gallons. |
| C12 | **Market-based Scope 2** | Uses the organisation's own certificates, PPAs and tariffs, then residual mix. Residual mix rates for the US are the Center for Resource Solutions' (cited, no licence found); AIB European residual mixes are not loaded. | Settings, Electricity contracts; calculation warnings when uncovered kWh fall back. | Check certificate evidence and that none is claimed twice. |
| C13 | **Uncertainty range** | Pedigree-matrix scoring (Weidema and Wesnaes basis) feeds a Monte Carlo range on totals. The simulation is seeded (default seed 42), so the same inputs give the same range. The scoring inputs come from record fields, so the range is only as good as those fields. | Calculation run page; `lib/calculation/pedigree.ts`, `monte-carlo.ts`. | Review how pedigree scores are assigned from record fields. |
| C14 | **Factor currency** | Libraries are loaded by hand from published files and checked weekly by a watch job that opens an issue; loading stays manual. | `data/sources/watched-sources.json`; GitHub issues labelled `data-upkeep`. | Compare each library version with the publisher's latest. |
| C15 | **Known US gaps** | No mobile CH4/N2O by vehicle year, no CNG by volume, no US battery-electric commuting factor (average car used, with a warning), refrigerant records naming no gas take an arbitrary HFC (with a warning). | `lib/calculation/selection-caveats.ts`. | Review commuting and refrigerant records for US sites. |
| C16 | **Scheme-specific methods are not implemented** | The platform calculates to the GHG Protocol with published factors. It does not apply a scheme's prescribed estimation methods (Australia's NGER, Canada's GHGRP, Germany's BEHG, EPA's GHGRP) and does not file with those schemes. | Compliance calendar lists dates only. | Do not describe any scheme submission as made from the platform. |

## 3. Data entry and review controls

| # | Limit | Where | Suggested check |
|---|---|---|---|
| D1 | Duplicate records are refused only when category, amount, unit, date, facility and supplier all match. | `lib/data-quality/duplicates.ts` | Test near-duplicates (different supplier spelling). |
| D2 | OCR and bill extraction are deterministic helpers; nothing is recorded until a person confirms. Low-confidence fields are flagged for review. | `lib/evidence/bill-extractor.ts`, `lib/field-submissions/ocr-confidence.ts` | Sample approved field submissions against their photos. |
| D3 | Data origin and evidence tier are labels on records ("Verified" needs primary data, complete evidence and approval). | `lib/data-quality/evidence-tier.ts` | Check the tier split of the headline. |
| D4 | The audit log is append-only with a hash chain; the nightly backup is encrypted and restore-tested weekly. | `lib/db/audit.ts`, `.github/workflows/backup.yml` | Verify the chain in `audit-log.csv`. |

## 4. Forecasting: known limits

Forecasts are planning aids. They are not part of any inventory or regulatory submission and must not be described as one.

| # | Limit | Detail | Where |
|---|---|---|---|
| F1 | **Not validated on real data** | Model selection and ranges were tested only on synthetic series and on the demo company (quarterly records spread over months, 24 months). `scripts/backtest-forecast-real-data.ts` exists to run the same checks on real organisation data and has not been run on any. | `lib/forecasting/select.ts` |
| F2 | **Ranges can be too narrow on short history** | On the demo series the share of actual values inside the 95% range was 77% with 9 months of history and 90% with 12. Confidence is labelled 0.65 under 19 samples. | `metadata.intervalMethod`, `intervalSamples` |
| F3 | **Prophet ranges can be overconfident** | On the demo series Prophet's ranges were very narrow and its holdout error was larger than simple models'. It competes only with 24 or more months and only if it reports a real holdout score. | `api/forecast.py`, `metadata.selection` |
| F4 | **Seasonal models untested in practice** | The demo data has no within-year seasonality, so the seasonal candidates were never the winner and their behaviour on real seasonal data is unproven. | `selectForecast()` |
| F5 | **Small samples** | Below 8 points the older engine answers without a model comparison. | `MIN_POINTS_TO_COMPARE` |
| F6 | **Heavier libraries not available** | `statsforecast`, `statsmodels`, `sktime`, `darts` exceed the 250 MB Vercel function limit (about 510 MB measured), so only dependency-free models and Prophet are used. | `CLAUDE.md`, Forecasting |

## 5. Suggested order of work for a verifier

1. Reproduce a stratified sample of 30 to 50 calculations by hand (include C1, C3, C4, C9 and C13 rows).
2. Confirm the factor libraries against the publishers' files in `data/sources/`.
3. Review the methodology statement and the changelog entries (full text in `lib/calculation/methodology.ts`).
4. Run `scripts/backtest-forecast-real-data.ts` on real series before any forecast is shown to a customer as reliable.
5. Record findings against the numbered items above so they can be closed one by one.
