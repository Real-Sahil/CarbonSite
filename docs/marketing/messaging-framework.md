# CarbonSite Messaging Framework

## Hero Message (Primary)
**"Carbon data that holds up under audit"**

Emphasizes immutability, trust, compliance. Resonates with CFOs, compliance officers, auditors.

---

## Sub-Messages (Supporting Pillars)

### 1. Immutability
**Deep dive:** Append-only logs, SHA-256 hash chains, tamper detection

- **For:** Auditors, compliance leads
- **Evidence:** pgAudit integration, AuditLog table design, hash chain validation
- **Proof point:** "Every calculation decision is recorded. No historical data can be changed. Auditors see exactly what happened and when."

### 2. Field Transparency
**Deep dive:** OCR from source, offline-first, real-time sync

- **For:** Field operations managers, sustainability coordinators
- **Evidence:** Flutter mobile app, on-device ML Kit OCR, drift/SQLite offline sync
- **Proof point:** "Field workers photograph delivery tickets. System extracts data instantly on the device. No manual data entry. No lost submissions."

### 3. Supply Chain Collaboration
**Deep dive:** Supplier portal, automated collection, Scope 3 estimation

- **For:** Procurement leads, supply chain sustainability
- **Evidence:** FieldSubmission workflow, supplier performance analytics, invoice anomaly detection
- **Proof point:** "Invite suppliers via link. They submit data once. You get real-time visibility into Scope 3 emissions without chasing spreadsheets."

### 4. Built-in Intelligence
**Deep dive:** Anomaly detection, forecasting, data quality scoring

- **For:** Data analysts, sustainability directors
- **Evidence:** XGBoost anomaly detection, invoice validation, supplier performance trends
- **Proof point:** "System flags unusual emissions, detects duplicate invoices, scores supplier data quality. Your team focuses on reduction, not data wrangling."

---

## Target Personas (3)

### 1. Sustainability Manager (Mid-market, 50–500 employees)
- **Pain points:** Manual CSV uploads, field worker data entry errors, no visibility into supplier emissions
- **Goals:** Daily reporting, supplier collaboration, audit readiness
- **Decision criteria:** Mobile app ease-of-use, real-time dashboards, cost per user
- **Budget authority:** Partial (CFO approval required)
- **Buying timeline:** 30–90 days (if pilot successful)

### 2. Finance Lead / CFO (Enterprise, 500+ employees)
- **Pain points:** Scope 3 data accuracy, audit evidence gaps, no cost justification for sustainability
- **Goals:** Accurate total emissions, SBTi alignment, carbon offset ROI, regulatory compliance
- **Decision criteria:** Audit readiness, enterprise SSO, SLA guarantees, integration with accounting systems
- **Budget authority:** Full (approves CapEx + OpEx)
- **Buying timeline:** 60–180 days (requires vendor security review, legal, procurement)

### 3. Compliance Auditor (External, third-party firm)
- **Pain points:** Customers can't provide calculation methodology, data lineage is unclear, historical data trust unknown
- **Goals:** Validate emissions accuracy, verify compliance with standards (CSRD, SBTi, ISO-14064), sign off on reports
- **Decision criteria:** Transparency of formulas, immutable audit trails, framework-specific evidence export
- **Budget authority:** None (customer decides tooling)
- **Buying timeline:** Immediate (if customer's tool enables faster audits)

---

## Customer Segments (Priority Order)

### Segment 1: Mid-market Manufacturing & Logistics
**Profile:** 200–1000 employees, 5–20 facilities, high Scope 1 & 2, growing Scope 3 focus

**Why CarbonSite:** Field workers can photograph receipts → system extracts data. Supplier portal automates Scope 3. Audit trail ready for external review.

**Competitive advantage:** Field-first OCR + offline-first mobile app. Competitors require manual data entry or expensive integrations.

**Pilot timeline:** 4–8 weeks (import 1 facility, field test with 5 workers, calculate 1 month, publish 1 report)

### Segment 2: Enterprise Retailers & CPG (Supplier Networks)
**Profile:** 500+ employees, 100+ suppliers, critical Scope 3 dependency

**Why CarbonSite:** Supplier portal invites automated. Performance analytics show who's responsive. Invoice sync detects fraud/duplicates.

**Competitive advantage:** Scope 3 automation + supplier visibility. Competitors require supplier education programs or manual follow-ups.

**Pilot timeline:** 8–16 weeks (onboard 50 suppliers, collect 1 quarter of data, validate emissions estimates against actuals)

### Segment 3: Professional Services & Consulting (CSRD Readiness)
**Profile:** 100–500 employees, dual Scope 1/2 + business travel Scope 3

**Why CarbonSite:** Rapid deployment (no integration required). Audit trail + immutable logs built-in. CSRD mapping + evidence export ready.

**Competitive advantage:** Open-source transparency + compliance framework built-in. Competitors charge extra for compliance modules.

**Pilot timeline:** 2–4 weeks (import 3 months of data, generate 1 CSRD report, conduct audit trail walkthrough)

---

## Key Messaging Dos & Don'ts

✅ **DO:**
- Lead with audit readiness + compliance outcomes
- Emphasize field worker productivity (photos → extraction → done)
- Highlight supplier transparency (portal invites, no chasing)
- Show immutability + trust advantages clearly
- Reference real competitor gaps (no field OCR, no offline, closed-box formulas)

❌ **DON'T:**
- Use generic "sustainability platform" language
- Claim cost savings without context (depends on scope)
- Emphasize "easy to use" without proof (show mobile screenshots)
- Compare on features alone (emphasize outcomes: audit-ready in 30 days)
- Oversell ML/AI (position as data quality safeguard, not prediction)

---

## Elevator Pitches (by Persona)

### For Sustainability Manager
"CarbonSite combines field worker mobile capture with automated supplier data collection. Your team focuses on reduction strategies, not data entry. Built for audit from day one."

### For CFO
"Audit-ready emissions accounting with immutable trails. Supplier portal automates Scope 3 collection. CSRD-compliant evidence export. Your auditors spend 30 minutes, not 3 weeks, validating data."

### For Compliance Auditor
"Every emissions calculation is recorded with methodology, factor selection, and timestamp. Hash chains prove data integrity. Framework-specific evidence packages ready for export. Audit verification is automated."

---

## Marketing Calendar (Next 8 Weeks)

| Week | Milestone | Owner |
|------|-----------|-------|
| 1–2 | Publish blog posts (1–4) | Content writer |
| 1–2 | Launch pricing + comparison pages | Design + frontend |
| 2 | Case study research + interviews | Product + customer success |
| 3 | Publish blog posts (5–8) | Content writer |
| 3 | Case study draft + revisions | Writer + customer |
| 3 | Product guides + video demos | Product + video editor |
| 4 | SEO optimization (schema, links) | SEO specialist |
| 4–8 | Monitor GA4, search console, organic traffic | Analytics |
| 5–6 | Sales enablement (deck, one-pagers, ROI calc) | Marketing + sales |
| 7–8 | Competitor response + thought leadership | Product + marketing |
