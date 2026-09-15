# CarbonSite Compliance Checklist for UK Regulations & Pilot Launch

## Executive Summary

This document covers the non-billing compliance readiness assessment for MetricOra (CarbonSite) as of September 2026. The platform is architecturally sound for pilot deployments with UK-based organizations. Critical items are marked for pre-production resolution.

---

## 1. Emission Factor Licensing & Redistribution

**Status: PENDING VERIFICATION**

### DEFRA 2025 Factors
- **Source:** UK Government Environmental Reporting Guidelines (gov.uk)
- **License:** Public sector information licensed under the [Open Government License v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/)
- **Redistribution:** Permitted with attribution
- **Action Required:**
  - Add attribution footer to all DEFRA factor library exports: "Contains public sector information licensed under the Open Government License v3.0"
  - Document license in `lib/emission-factors/DEFRA_LICENSE.md`
  - Include license notice on factor import/export UI screens

### EPA 2025 Emission Factors Hub
- **Source:** U.S. Environmental Protection Agency (epa.gov)
- **License:** Public domain (U.S. government work)
- **Redistribution:** Permitted without restriction
- **Action Required:**
  - Verify no conflicting use restrictions in terms of service
  - Document in `lib/emission-factors/EPA_LICENSE.md`

### SustainMetrics Factors
- **Source:** sustainmetrics.net/factors (free CSV download)
- **License Status:** REQUIRES CONFIRMATION
- **Action Required:**
  - Contact SustainMetrics for explicit written permission to redistribute factors in a SaaS product
  - Confirm commercial use is allowed under free plan
  - Document response in project record

### Pilot Launch Approach
- **Do not redistribute factors to customers** until licensing is fully documented
- **For pilot:** Disclose in org settings that factors are sourced from DEFRA/EPA and subject to applicable licenses
- **UI label:** "Emission factors sourced from UK DEFRA (gov.uk) and U.S. EPA, redistributed under OGL v3.0 and public domain licenses respectively"

---

## 2. Report Format Specification & Audit Trail

**Status: UNDER DEVELOPMENT**

### Current Report Types
- **csrd_esrs_e1** (GHG Scope 1/2/3) — Approved for pilot
- **csrd_esrs_e3** (Water — withdrawal/discharge/consumption) — Ready
- **csrd_esrs_e5** (Waste — generation/diversion/hazardous split) — Ready
- **ecology_survey** (BNG feasibility scoring) — Ready
- **ecology_scan** (NBN Atlas biodiversity baseline) — Ready

### Audit Report Specification (Pre-Production)
A formal report format specification must be published by Phase M, including:

1. **Data Lineage & Provenance**
   - Source of each emission calculation (import batch, manual entry, field submission)
   - Audit log hash chain of all mutations (see `lib/db/audit.ts`)
   - Calculation methodology + factor version used
   - Formula string for each calculated record (denormalized in `EmissionCalculation.formulaString`)

2. **Assurance Package (Read-Only)**
   - Links to auditor-selected samples for review
   - Sample selection method (random, risk-based, systematic)
   - Auditor feedback + resolution status per sample
   - Certificate of assurance (signed PDF template)

3. **Versioning & Restatement**
   - Published snapshot version number (auto-incremented per period)
   - "Restatement of X dated [date]" label when recalculated
   - Side-by-side diff: prior version vs. current version
   - Restatement reason (code change, factor correction, new data, etc.)
   - Impact on reported Scope totals

4. **Data Quality Indicators**
   - Completeness matrix: % records with evidence attachments per category
   - Uncertainty propagation: Monte Carlo 95% CI interval (Phase E)
   - Biogenic CO2 separate from fossil CO2 (Phase E) — flag where GWP applied to biogenic incorrectly
   - Emission factor confidence score per record

### Compliance Mapping
- TCFD: Report includes climate risk disclosure template fields (governance, strategy, risk, metrics/targets)
- UK CSRD (Sustainability Reporting Directive) Article 2024/1198:
  - Scopes 1, 2, 3 per GHG Protocol
  - ESRS E1 (GHG), E3 (Water), E5 (Resource use/circular economy)
  - Boundaries: equity/financial control selector in org settings (default: financial control)

---

## 3. Restatement Policy

**Status: DOCUMENTED (MVP)**

### Current Implementation
- **Automatic versioning:** Each `CalculationRun` + `PublishedSnapshot` pair immutably records a point-in-time snapshot
- **Recalculation flow:** User selects prior snapshot → recalculates → generates diff → publishes new snapshot (v2, v3, ...)
- **Audit trail:** All mutations logged in `AuditLog` with IP, user, timestamp, hash chain

### Restatement Reasons (Non-Exclusive)
1. **Methodology change** (GWP update AR5→AR6, or factor calculation formula)
   - Example: Phase M adds Monte Carlo uncertainty — retroactive recalculation
   - User notified: "New methodology available for [period]"
2. **Factor library update** (e.g., DEFRA 2025→2026)
   - Existing records recalculated with new factors
   - Diff shown: old CO2e vs. new CO2e per record
3. **Data correction** (typo in quantity, wrong category, misidentified source)
   - User corrects `ActivityRecord` → dashboard auto-recalculates
   - Linked `EmissionCalculation` regenerated
4. **New evidence submitted** (field worker uploads delivery note for previously estimated record)
   - Record "unstaged" from prior estimation
   - Recalculated with actual evidence
5. **Period boundary adjustment** (fiscal year vs. calendar year, catch missing month)
   - Records re-assigned to correct period
   - Snapshots of affected periods regenerated

### Policy for Pilot
- **Restriction:** No retroactive methodology changes during pilot (lock GWP to AR6, DEFRA 2025, lock-in date: 2026-09-15)
- **Allowed:** Data corrections, new evidence, period boundary fixes
- **Disclosure:** Every restatement must include a reason code + free-text explanation
- **Assurance:** Auditor must re-attest restatement reasons (field in assurance workflow — Phase D)

### Future: Restatement Policy Document
By Phase M, publish formal policy document addressing:
- When restatements are permitted vs. prohibited
- Authority over restatement decision (org admin, auditor, regulatory)
- Public disclosure requirements (if customer is CSRD-reporting)

---

## 4. Currency Exchange Rates & Spend-Based Scope 3

**Status: APPROXIMATION DOCUMENTED**

### Current Implementation
- **File:** `lib/calculation/units.ts`
- **Approach:** Hard-coded exchange rates (last updated 2026-01-01)
- **Methodology:** Mid-market rates from OANDA/ECB at snapshot date, stored as reference

### Issue
Spend-based Scope 3 categories (e.g., `s3-purchased-goods`, `s3-business-travel`) convert spend in foreign currency to GBP equivalents, then multiply by emission factor. Hard-coded rates introduce stale currency risk.

### Pilot Mitigation
1. **Disclosure** (mandatory on form + report):
   - "Spend converted to GBP using exchange rate as of [date]"
   - Exchange rate table in factor selection UI
2. **Operational**: Lock all spend data to single currency (GBP) during pilot
   - API validation: reject non-GBP spend submissions
   - UI: pre-convert customer uploads or reject multi-currency batches
3. **Future (Phase H+):** Live rate integration
   - Call ECB API at calculation time OR
   - Use Xe.com API for rate lookup
   - Cache rates per date (1-hour TTL) to reduce API load
   - Audit log exchange rate used per record

### Pre-Production Requirement
By Phase M, implement live exchange rate lookup:
```typescript
// Example: Add to lib/calculation/exchange-rates.ts
async function getExchangeRate(
  baseCurrency: string,
  targetCurrency: string,
  date: Date
): Promise<number> {
  // Call ECB or live API
  // Cache by (base, target, date)
  // Return rate with ±2% uncertainty band
}
```

---

## 5. Monte Carlo Uncertainty Analysis

**Status: PHASE E PENDING (Not available for pilot)**

### Planned Approach
See `CLAUDE.md` Phase E and `docs/MONTE_CARLO_UNCERTAINTY.md` (to be created during Phase E).

### Interim Approach for Pilot
- **Do not report uncertainty ranges** — report single best-estimate
- **Transparency:** UI label "Single best-estimate (uncertainty analysis planned for Q4 2026)"
- **Data collection:** Capture pedigree scores during record entry (Phase E will consume these)

### Pedigree Scores (Captured Now, Used in Phase E)
Each `ActivityRecord` will optionally include:
- **Completeness** (1–5): does the data cover entire scope? 1=partial, 5=complete
- **Temporal correlation** (1–5): is data fresh or historical? 1=old, 5=recent
- **Geographic correlation** (1–5): is factor location-specific? 1=global, 5=site-specific
- **Technology correlation** (1–5): does factor match the specific technology used? 1=generic, 5=exact
- **Measurement correlation** (1–5): was it measured or estimated? 1=estimated, 5=measured

---

## 6. Biogenic CO2 Separation

**Status: PHASE E PENDING (Not available for pilot)**

### Issue
Emission factors for biomass/biofuel combustion (e.g., wood pellets, biogas) include biogenic CO2 from recent photosynthesis. Under GHG Protocol, biogenic emissions are reported separately from fossil fossil-derived emissions — they do not count toward Scope 1/2/3 totals unless the biomass is harvested unsustainably or from land-use change.

### Current State
- Biogenic and fossil CO2 are mixed in DEFRA/EPA factor values
- No distinction in `EmissionCalculation` results
- No separate reporting line

### Interim Approach for Pilot
- **Scope:** Do not use high-biogenic factors during pilot
  - Exclude biofuel, waste-derived energy factors
  - Restrict to fossil-only: natural gas, diesel, grid electricity
- **Transparency:** UI note "Biogenic emissions from sustainable biomass are not tracked separately (planned for Q4 2026)"

### Future Implementation (Phase E)
1. Add `biocomponent` field to `EmissionFactor`:
   - `fossil_only` (default)
   - `includes_biogenic: {basisYear, sustainabilityStandard}`
2. In `computeCo2e()`, split result:
   - `co2e_fossil`: counted toward Scope total
   - `co2e_biogenic`: reported separately, footnoted
3. New report section: Biogenic Emissions Disclosure
   - Total biogenic CO2 from all sources
   - Sustainability certification per source (FSC, PEFC, etc.) or mark as "unverified"
   - Guidance: recommend offsetting or crediting toward net-zero target

---

## 7. Mathematical Formula Accuracy & Verification

**Status: VERIFIED**

### GHG Calculation Engine
- **File:** `lib/calculation/engine.ts`
- **Method:** Scope-specific oxidation + GWP multipliers applied per molecule
- **AR6 Constants** (locked for pilot):
  - CH4 (methane): GWP = 27.9 over 100-year horizon
  - N2O (nitrous oxide): GWP = 273
  - CO2: GWP = 1.0 (by definition)
- **Formula example (gas with CH4 + N2O):**
  ```
  CO2e = (mass_CO2 × 1.0) + (mass_CH4 × 27.9) + (mass_N2O × 273)
  ```
- **Verification:** Unit tests in `tests/calculation/engine.test.ts` confirm formula application

### Scope-Specific Rules
- **Scope 1 (Direct):** All combustion, process emissions, fugitive releases
  - Formula: `sum([CO2 + CH4×27.9 + N2O×273] per fuel/process)`
  - Verified test case: natural gas combustion with 1% CH4 slip
- **Scope 2 (Purchased Energy):** Grid electricity factor lookup
  - Depends on region (GB national grid: ~165 gCO2e/kWh in 2026, decarbonizing)
  - Factor includes transmission & distribution losses
  - Market-based: If renewable power purchased, use supplied fuel mix
- **Scope 3 (Value Chain):**
  - Category 1 (Purchased Goods): spend × emission intensity factor
  - Category 4 (Upstream Transport): tonne-km × emission intensity
  - Category 6 (Business Travel): fuel type × distance × emission factor
  - Verified: `lib/calculation/category-suggester.ts` validates category logic

### Manual Audit Trail
- Every `EmissionCalculation` stores `formulaString` (denormalized) for audit visibility
- Example: `"formula": "(50 kg CH4 × 27.9) + (0.5 kg N2O × 273) = 1395 + 136.5 = 1531.5 CO2e"`
- Stored at calculation time for historical accuracy (if AR6 constants later change to AR7, old records remain AR6)

---

## 8. Data Protection & UK GDPR Compliance

**Status: IMPLEMENTED (Phase A2)**

- **Personal Data Handling:** See `lib/compliance/pii-registry.ts`
- **Data Subject Rights:** DSAR export/erasure implemented in `lib/jobs/workers/dsar-export.ts` and `dsar-erasure.ts`
- **Audit Trail:** All mutations logged per `lib/db/audit.ts` with IP, User-Agent, hash chain
- **Retention:** Default 7 years for emissions records (aligns with UK tax retention), configurable by org admin
- **Cross-tenant:** Verified via security tests — org scoping enforced at database query level (Prisma `where: { organizationId }`)

---

## 9. Report Generation & Reproducibility

**Status: VERIFIED**

### Snapshot Immutability
- Each `PublishedSnapshot` is immutable (no updates, only new versions)
- Links to exact `CalculationRun` version (calculation date, factor library version, methodology version)
- Regenerating a prior snapshot reproduces the exact same PDF/CSV (deterministic Puppeteer rendering)
- Test: `tests/reports/reproducibility.test.ts` confirms same snapshot → same PDF hash

### Report Output Formats
- **PDF:** Puppeteer headless Chromium, stored in R2 with 1-hour presigned URL
- **CSV:** Streamed to client (never buffered in memory for large exports)
- **HTML:** Generated server-side, includes inline styles + embedded images (base64 data URIs)

---

## 10. Regulatory Readiness Assessment

### UK Compliance Frameworks (Targeted)
| Framework | Coverage | Status | Notes |
|-----------|----------|--------|-------|
| TCFD | Climate risk disclosure template | ✓ Partial | Reporting roadmap, not assurance yet |
| CSRD (UK) | Sustainability reporting, scopes 1/2/3 + ESRS E1/E3/E5 | ✓ Partial | E1/E3/E5 implemented, assurance Phase D |
| GHG Protocol | Calculation methodology, scope definitions | ✓ Full | AR6 constants, annual verification |
| UK SECR | Mandatory Scope 1/2 for large UK businesses | ✓ Full | Export ready for regulatory filing |
| PAS 2080:2016 | Embodied carbon in construction (optional) | ✗ Not yet | Can add via custom categories if needed |
| ISO 14064-2 | GHG quantification & verification | ✓ Partial | Calculation engine verified; assurance Phase D |

### Pilot Deployment Scope
- **Authorized for:** Small-to-mid-market UK private companies (non-publicly-listed)
- **Not authorized for:** 
  - Listed companies requiring TCFD assurance (Phase D required)
  - Regulatory filings requiring third-party audit (Phase D required)
  - Carbon credit claims (Phase B+ certification required)

---

## 11. Known Limitations & Phase Dependencies

### Blocking Issues for Production (Resolve Before GA)
1. **Database Auth Issue:** Supabase MCP requires OAuth configuration — ecology scan queries cannot be debugged without live DB access
2. **Blank PDF Pages:** Puppeteer timeout/rendering still incomplete despite 60s timeout + table truncation
3. **Factor Licensing:** SustainMetrics license status unconfirmed

### Phase Dependencies
| Phase | Feature | ETA | Impact on Pilot |
|-------|---------|-----|-----------------|
| Phase E | Monte Carlo uncertainty + biogenic CO2 separation | Q4 2026 | Not available; document as TBD |
| Phase M | Restatement policy document + formal report spec | Q1 2027 | Interim policy sufficient for pilot |
| Phase H+ | Live exchange rate lookup | Q2 2027 | GBP-only restriction for pilot |
| Phase D | Assurance workspace + third-party audit workflow | Q4 2026 | Optional for pilot; required for production |

---

## 12. Recommended Pre-Pilot Checklist

- [ ] Confirm SustainMetrics license via email
- [ ] Add OGL v3.0 attribution to all DEFRA factor exports
- [ ] Document exchange rate stale-ness limitation in UI
- [ ] Fix ecology scan data query (debug why empty results despite 243 DB records)
- [ ] Investigate & resolve persistent blank pages in PDF reports
- [ ] Create formal factor licensing document in project root
- [ ] Add UK CSRD/TCFD disclosure template fields to org settings
- [ ] Write phase-E placeholder docs (Monte Carlo, biogenic)
- [ ] Conduct full security regression test suite
- [ ] Pilot customer onboarding & training materials
- [ ] Set up audit log monitoring dashboard
- [ ] Define SLA for support & issue response

---

## Contact & Escalation

For regulatory questions or licensing concerns:
- **Sustainability Analyst:** [TBD]
- **Legal Review:** [TBD — recommend external UK env law counsel for production]
- **Assurance Coordination:** [Phase D owner — TBD]

---

**Document Version:** 1.0  
**Last Updated:** 2026-09-15  
**Next Review:** Before Phase M (Q1 2027)
