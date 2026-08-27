# CSRD Compliance Mapping

## Overview

The CSRD (Corporate Sustainability Reporting Directive) Compliance Mapper helps EU organizations navigate mandatory emissions reporting requirements. It maps CarbonSite emission categories to CSRD Article 8 requirements and provides a phased implementation roadmap.

**CSRD applies to:**
- Large EU companies (>500 employees) — reporting starts 2025
- Large non-EU companies with EU turnover >€150M — reporting starts 2026
- Listed SMEs — reporting starts 2028 (opt-out available)

## Regulatory Timeline

| Year | Deadline | Requirement | Status |
|------|----------|-------------|--------|
| **2025** | 31 Dec 2025 | First CSRD report (Scope 1 + 2 emissions, large orgs) | Active |
| **2026** | 31 Dec 2026 | Third-party assurance (limited or reasonable) | Upcoming |
| **2027** | 31 Dec 2027 | Scope 3 encouragement (non-mandatory pilot phase) | Upcoming |
| **2028** | 31 Dec 2028 | Scope 3 mandatory for all large orgs (if material) | Upcoming |
| **2029** | 31 Dec 2029 | Extended scope: non-EU orgs with EU presence | Upcoming |

## CSRD Article 8 Mandatory Disclosures

### Article 8.1(a) — Scope 1 Emissions
**Requirement:** Disclose direct emissions from owned/controlled sources
- Include: fuel combustion, process emissions, refrigerant leaks
- Unit: tCO₂e
- Timeline: Mandatory by 2025

**CarbonSite Categories:**
- `s1-stationary` — Direct fuel combustion (boilers, furnaces)
- `s1-mobile` — Company vehicle fleet
- `s1-fugitive` — Refrigerants, process venting

**Mapping:** CSRD Annex I, Part E, Section 1

### Article 8.1(b) — Scope 2 Emissions
**Requirement:** Disclose indirect energy emissions (both location-based and market-based)
- Include: purchased electricity, steam, heating, cooling
- Report both methods: location-based (grid average) and market-based (renewable procurement)
- Timeline: Mandatory by 2025

**CarbonSite Categories:**
- `s2-electricity-lb` — Location-based (grid mix)
- `s2-electricity-mb` — Market-based (RECs, green tariffs)

**Mapping:** CSRD Annex I, Part E, Section 2

**DNSH Criteria:** Transition to renewable electricity (50% by 2025, 100% by 2030)

### Article 8.1(c) — Scope 3 Emissions
**Requirement:** Disclose indirect value chain emissions if material
- Include: purchased goods, business travel, logistics, waste
- Materiality assessment: >5% of total Scope 1+2
- Timeline: Phased (encouraged 2027, mandatory 2028)

**CarbonSite Categories:**
- `s3-purchased-goods` — Supplier emissions
- `s3-upstream-transport` — Freight, logistics
- `s3-business-travel` — Air, rail, accommodation
- `s3-commuting` — Employee commuting
- `s3-waste` — Waste disposal

**Mapping:** CSRD Annex I, Part E, Section 3 (phased)

**DNSH Criteria:** Supplier emissions on declining trajectory; modal shift to lower-emission transport

### Article 8.1(d) — Energy Consumption
**Requirement:** Report total energy consumption (kWh) from renewable and non-renewable sources
- Timeline: Mandatory by 2025

### Article 8.1(e) — Methodology
**Requirement:** Disclose methodology, assumptions, and emission factors used
- Include: GHG Protocol methodology version
- Specify: boundary, scopes included, calculation approach
- Timeline: Mandatory by 2025

**CarbonSite Advantage:** Audit trail records methodology per calculation; automatic methodology disclosure

### Article 8.1(f) — Assurance
**Requirement:** Provide verified emissions data with third-party assurance
- Phased rollout: Limited assurance 2026, reasonable assurance 2027+
- Timeline: Starts 2026

## Compliance Checklist

### Now (2024-2025)
- [ ] Establish GHG accounting baseline (Scope 1 + 2, minimum)
- [ ] Select emission factors (DEFRA, EPA, regional defaults)
- [ ] Document methodology and scope boundaries
- [ ] Identify material Scope 3 categories
- [ ] Begin Scope 3 data collection (if material)
- [ ] Engage finance/sustainability teams on CSRD timeline

### 2025 Report (Due 31 Dec 2025)
- [ ] Finalize Scope 1 emissions (direct combustion)
- [ ] Finalize Scope 2 emissions (location-based + market-based)
- [ ] Document energy consumption by type (renewable vs. non-renewable)
- [ ] Disclose methodology and GHG Protocol version
- [ ] Prepare for audit/assurance process

### 2026 Report (Due 31 Dec 2026)
- [ ] Include third-party limited assurance on emissions
- [ ] Analyze Scope 3 materiality (if >5%, report it)
- [ ] Begin Scope 3 data collection (formal process)

### 2027-2028 Reports (Due 31 Dec 2027/2028)
- [ ] Mandatory Scope 3 reporting for material categories
- [ ] Supplier engagement program (emissions verification)
- [ ] Transition to reasonable assurance (if large org)

## Using CarbonSite for CSRD Compliance

### 1. Generate Compliance Status Report

```typescript
// API endpoint
POST /api/orgs/{orgId}/compliance/csrd
{
  "reportingYear": 2025,
  "scope1": 1500000,      // kg CO2e
  "scope2": 2300000,      // kg CO2e
  "scope3": 5200000       // kg CO2e (if material)
}

// Response
{
  "complianceStatus": "compliant",
  "mandatoryRequirements": [...],
  "missingData": [],
  "recommendations": [...],
  "nextSteps": [
    { "year": 2026, "deadline": "31 Dec 2026", "requirement": "Third-party assurance" }
  ]
}
```

### 2. View Category Mappings

```typescript
// Get Annex mapping for specific category
GET /api/orgs/{orgId}/compliance/csrd?category=s2-electricity-lb

// Response
{
  "mapping": {
    "categoryCode": "s2-electricity-lb",
    "categoryName": "Purchased electricity (location-based)",
    "csrdAnnexMapping": "Annex I, Part E, Section 2.1",
    "esaTaxonomy": "Renewable energy generation and distribution",
    "dnshCriteria": "Transition to renewable electricity sources"
  }
}
```

### 3. Track Compliance Progress

- **Dashboard Widget:** Display CSRD compliance status + upcoming milestones
- **Audit Trail:** All compliance assessments logged for regulatory review
- **Recommendations:** Automated guidance on missing data and next steps

## CSRD + SBTi Integration

**Alignment:**
- SBTi sets emission reduction targets aligned with 1.5°C/2°C science
- CSRD mandates transparent disclosure of those emissions
- CarbonSite bridges both: calculate targets (SBTi) → track progress (CSRD reports)

**Workflow:**
1. Set SBTi 1.5°C target (e.g., -4.2%/year through 2030)
2. Generate CSRD compliance baseline (2024 emissions)
3. Track annual progress vs. CSRD requirements
4. Report compliance status in annual CSRD disclosure

## CSRD + Scope 3 AI Assistant Integration

**Example Scenario:**
- Org has $50M annual spend; Scope 3 unknown
- Use Scope 3 AI Assistant to estimate: ~$50M spend → 1,200 tonnes CO₂e
- Add to CSRD compliance report: "Scope 3 estimated at 1,200t (~15% of total); materiality threshold met"
- Plan supplier engagement program based on estimate

## FAQ

### Q: Is CSRD reporting mandatory for my organization?
**A:** Check the requirements:
- Large EU company (>500 employees)? → Yes, 2025 reporting
- Non-EU company, >€150M EU turnover? → Yes, 2026 reporting
- Listed SME? → Optional (can opt-in), 2028 reporting
- Unlisted SME? → No requirement

### Q: Do I need to report Scope 3 emissions?
**A:** Phased approach:
- 2025: Not required (focus on Scope 1 + 2)
- 2026-2027: Encouraged if material (>5% of Scope 1+2)
- 2028+: Mandatory if material

Start collecting Scope 3 data now to prepare.

### Q: What is "materiality" under CSRD?
**A:** CSRD uses double materiality:
1. **Financial materiality:** Emissions impact business risks (stranded assets, carbon tax)
2. **Impact materiality:** Business impact on climate (emissions contribution to warming)

General rule: If Scope 3 >5% of Scope 1+2, it's material.

### Q: Do I need third-party assurance?
**A:** Phased rollout:
- 2025 report: Not required
- 2026 report: Limited assurance required
- 2027+: Reasonable assurance for large orgs

CarbonSite prepares audit trail; assurance is external process.

### Q: How does CSRD relate to GHG Protocol?
**A:** CSRD mandates GHG Protocol Scope 1, 2, 3 structure. CarbonSite uses GHG Protocol methodology; CSRD adds regulatory reporting/assurance layer.

## Regulatory References

- **CSRD Text:** https://eur-lex.europa.eu/eli/dir/2022/2464/oj
- **Double Materiality Guidance:** https://ec.europa.eu/finance/docs/sites/default/files/2023-04/csrd-faq_en.pdf
- **Annex I Category Definitions:** https://ec.europa.eu/finance/docs (Delegated Regulation)
- **DNSH Criteria:** https://ec.europa.eu/environment/business/sustainability_en.htm
- **ESRS (Reporting Standards):** https://www.efrag.org/web/public/standards

## Support & Audit Preparation

Use CarbonSite CSRD reports for audit preparation:
1. Export annual CSRD compliance report (PDF)
2. Share with external auditor for third-party verification
3. Track audit feedback in audit log
4. Update methodology/assumptions for next reporting cycle

## Roadmap

- **Phase 2c:** CSRD compliance mapping (current)
- **Phase 2d:** Supplier CSRD template (help suppliers report their emissions)
- **Phase 2e:** CSRD audit trail export (ready for external assurance)
- **Phase 3:** EU Taxonomy alignment (beyond emissions, add environmental/social scoring)
