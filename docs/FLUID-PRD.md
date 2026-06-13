# Fluid — Product Requirements Document (PRD)
## Enterprise Sustainability Intelligence Platform

**Version:** 2.0  
**Date:** 2026-06-13  
**Status:** Living Document — Engineering Reference  
**Owner:** Product & Engineering  
**Classification:** Internal

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Market Context & Competitive Analysis](#2-market-context--competitive-analysis)
3. [Strategic Positioning](#3-strategic-positioning)
4. [Platform Vision & Core Principles](#4-platform-vision--core-principles)
5. [User Personas](#5-user-personas)
6. [Functional Requirements — Web Platform](#6-functional-requirements--web-platform)
7. [Functional Requirements — Flutter Mobile App](#7-functional-requirements--flutter-mobile-app)
8. [Evidence Management System](#8-evidence-management-system)
9. [OCR & AI Extraction Engine](#9-ocr--ai-extraction-engine)
10. [Carbon Accounting Engine](#10-carbon-accounting-engine)
11. [Social Value Engine](#11-social-value-engine)
12. [Geospatial & Transport Engine](#12-geospatial--transport-engine)
13. [Reporting & Standards Engine](#13-reporting--standards-engine)
14. [Multi-Tenancy & White-Label Architecture](#14-multi-tenancy--white-label-architecture)
15. [RBAC & Permission Model](#15-rbac--permission-model)
16. [Integration Requirements](#16-integration-requirements)
17. [Security & Compliance Requirements](#17-security--compliance-requirements)
18. [Performance Requirements](#18-performance-requirements)
19. [Data Model Requirements](#19-data-model-requirements)
20. [Success Metrics](#20-success-metrics)
21. [Implementation Phasing](#21-implementation-phasing)

---

## 1. Executive Summary

**Fluid** is a multi-tenant, white-label enterprise sustainability intelligence platform that eliminates manual reporting by converting raw evidence directly into validated, auditable sustainability metrics.

Unlike carbon calculators (Greenly, Normative) or ESG survey platforms (EcoVadis), Fluid operates on a foundational principle: **no metric may exist without a traceable source document**. Every tonne of CO₂e, every £ of social value, every waste movement is anchored to a digital piece of evidence — a photo, a PDF, a scan, a receipt.

**Primary verticals at launch:**
1. **UK Construction** — waste tracking, transport emissions, BREEAM evidence, PPN 06/21 Carbon Reduction Plans
2. **Facilities & Property Management** — energy, utilities, fleet, supply chain
3. **Public Sector Supply Chain** — NHS Evergreen, government procurement (SECR, PPN 06/21)

**Competitive white space:** No single platform combines field-level evidence capture (offline OCR on construction sites) + automated transport carbon (postcode → distance → DEFRA factor) + National TOMS social value + PPN 06/21 reporting + white-label portals at a UK mid-market price point.

---

## 2. Market Context & Competitive Analysis

### 2.1 Competitor Landscape

#### BRE SmartWaste
**Position:** The dominant UK construction waste tracking tool.  
**Strengths:** BREEAM evidence generation, waste transfer note scanning, circular economy metrics, AI document scan (SmartWaste Scan), biodiversity tracking.  
**Weaknesses:** No social value engine, no offline mobile capture, limited Scope 3 depth, outdated UX, no API-first architecture, no white-label.  
**Pricing:** Annual licensing (tiered, vendor contact required).  
**What Fluid must match:** BREEAM evidence package generation, waste transfer note OCR, waste stream classification by EWC code.  
**What Fluid beats it on:** Offline-first mobile capture, real-time transport carbon calculations, National TOMS social value, modern API, white-label portals.

#### Watershed / Sweep
**Position:** Verdantix 2026 Leaders. Enterprise carbon management with 60+ integrations.  
**Strengths:** Best-in-class Scope 3, LCA capabilities, CSRD/SEC filing automation, SAP/Oracle connectors.  
**Weaknesses:** No construction vertical, no field worker app, no waste/transport calculation depth, US-first (limited UK public sector focus), £50k+ enterprise contracts only.  
**What Fluid must match:** Immutable calculation history, CSRD report automation, audit-ready data exports.  
**What Fluid beats it on:** UK construction focus, field capture, social value, PPN 06/21, accessible pricing.

#### Greenly
**Position:** SME-to-enterprise carbon, CSRD plans, £3.8k–£8k/year.  
**Strengths:** 100+ integrations, CSRD-specific plans, clean UX, strong European presence.  
**Weaknesses:** No mobile field capture, no waste-level detail, no social value, no construction vertical.  
**What Fluid must match:** Clean dashboard UX, transparent pricing tiers, CSRD report output.  
**What Fluid beats it on:** Field evidence capture, construction waste detail, BREEAM + TOMS + PPN 06/21.

#### Normative
**Position:** GHG Protocol-certified, 330,000+ emission factors, dedicated climate advisor.  
**Strengths:** 100% SBTi success rate, 100% audit pass rate, dedicated expert support.  
**Weaknesses:** No field app, no waste/construction vertical, premium pricing, no social value.  
**What Fluid must match:** Audit-ready calculation export with factor citations, methodological rigour.  
**What Fluid beats it on:** Evidence traceability, site-level capture, UK public sector.

#### EcoVadis
**Position:** Global supplier sustainability ratings platform, 100,000+ suppliers assessed.  
**Strengths:** Supplier benchmarking, SAP/Coupa/Ariba integration, CSRD compliance, market credibility.  
**Weaknesses:** A ratings platform, not a calculation tool — cannot produce SECR or DEFRA-compliant carbon data.  
**What Fluid must match:** Supplier performance view, supply chain carbon tracking.  
**What Fluid beats it on:** Actual carbon calculation depth, DEFRA factors, field evidence.

#### Sphera
**Position:** Enterprise EHS + ESG, Fortune 500, process safety.  
**Strengths:** Deep EHS integration, chemical compliance, quantitative risk assessment, global enterprise.  
**Weaknesses:** 9–18 month implementations, £100k+/year, not accessible to UK mid-market or construction.  
**What Fluid beats it on:** Time-to-value, UK vertical focus, accessible pricing, modern stack.

### 2.2 Standards Coverage Matrix

| Standard | Greenly | Normative | Watershed | SmartWaste | **Fluid Target** |
|---|---|---|---|---|---|
| GHG Protocol (Scope 1/2/3) | ✓ | ✓✓ | ✓✓ | Partial | ✓✓ |
| SECR | ✓ | ✓ | ✓ | Partial | ✓✓ |
| CSRD / ESRS | Partial | Partial | ✓ | ✗ | ✓ |
| PPN 06/21 (CRP) | ✓ | ✓ | ✓ | ✓ | ✓✓ |
| NHS Evergreen | ✗ | ✗ | ✗ | ✗ | ✓✓ |
| National TOMS | ✗ | ✗ | ✗ | Partial | ✓✓ |
| BREEAM evidence | ✗ | ✗ | ✗ | ✓✓ | ✓✓ |
| ISO 14001 | Partial | Partial | Partial | Partial | ✓ |
| TCFD | ✓ | ✓ | ✓ | ✗ | ✓ |
| CDP | ✓ | ✓ | ✓ | ✗ | ✓ |
| DEFRA factor depth | Partial | Partial | Partial | Partial | ✓✓ |
| EWC waste codes | ✗ | ✗ | ✗ | ✓✓ | ✓✓ |

### 2.3 Addressable Market

| Segment | Size (UK) | Primary driver |
|---|---|---|
| UK construction companies (Tier 1–3) | ~12,000 | PPN 06/21, BREEAM, net zero |
| NHS suppliers | ~80,000 | NHS Evergreen Level 1 (mandatory from April 2026) |
| Government suppliers >£5m | ~15,000 | PPN 06/21 / Procurement Act 2023 |
| Facilities management companies | ~8,000 | SECR, ISO 50001, net zero commitments |
| Waste hauliers & recyclers | ~4,000 | DEFRA reporting, Environment Agency |
| **Total addressable (UK)** | **~119,000** | |

---

## 3. Strategic Positioning

### Fluid is NOT a carbon calculator.

Fluid is an **Evidence → Intelligence → Reporting** platform.

**This distinction matters because:**
- Carbon calculators ask users to enter numbers manually → errors, omissions, audit failures
- Fluid captures the source document first → OCR extracts the data → calculations follow from evidence
- Every dashboard metric in Fluid traces back to a source file — this is the audit guarantee competitors cannot match

### Fluid's Defensible Moat

```
Field capture (offline OCR)  +  DEFRA transport auto-calculation
        +
National TOMS social value   +  PPN 06/21 / NHS Evergreen native
        +
White-label portals          +  UK mid-market pricing
        =
No single competitor delivers all of this
```

### Price Positioning

| Tier | Target | Monthly | Annual |
|---|---|---|---|
| **Starter** | SME, 1 org, ≤5 users, ≤10k records | £149 | £1,490 |
| **Professional** | Mid-market, ≤25 users, ≤100k records | £499 | £4,990 |
| **Enterprise** | Large org, unlimited users, all modules | £1,500+ | £15,000+ |
| **Platform** | Consultancies / resellers (white-label) | £3,000+ | £30,000+ |

Competitive benchmark: Greenly charges £3,800–£7,800/year for basic carbon reporting. Fluid at Professional (£4,990/year) includes field capture, transport calculation, social value, and BREEAM evidence — a 4× feature advantage at the same price point.

---

## 4. Platform Vision & Core Principles

### 4.1 Core Principles (Non-Negotiable)

1. **Evidence First.** No metric may exist without a traceable source document. Every KPI links to evidence.
2. **Everything Traceable.** Drill path: Dashboard → Calculation → Source Record → Source Document.
3. **Audit Reproducibility.** Any published report must be regeneratable identically from the same snapshot. Calculations are immutable.
4. **No Orphaned KPIs.** A dashboard value with no evidence link is a compliance failure, not a feature.
5. **Offline Capable.** Field workers must be able to capture evidence with zero connectivity. Sync happens later.
6. **White-Label Native.** Every UI element must be capable of carrying a tenant's brand. Nothing is hardcoded to "Fluid".
7. **UK Regulatory Native.** PPN 06/21, SECR, NHS Evergreen, National TOMS are first-class citizens — not bolt-ons.

### 4.2 Platform Hierarchy

```
Platform (Fluid)
  └── Tenant  (e.g., "Balfour Beatty")
        └── Business Unit  (e.g., "Infrastructure Division")
              └── Contract  (e.g., "HS2 Lot 1")
                    └── Project  (e.g., "Euston Station Groundworks")
                          └── Site  (e.g., "Excavation Zone A")
```

Every record in the system belongs to a Site. Every Site belongs to a Project. Every aggregation rolls up through this hierarchy automatically.

### 4.3 Primary Workflow

```
Evidence Capture (photo / PDF / scan / email)
  → Upload to Fluid (web or mobile)
  → OCR Extraction (ML Kit on mobile, Claude vision on web)
  → AI Classification (waste type, EWC code, category)
  → Entity Extraction (date, postcode, weight, supplier, vehicle)
  → Confidence Scoring
  → Human Review Queue (low-confidence records flagged)
  → Approval
  → Geospatial Analysis (postcode → geocode → route → distance)
  → Carbon Calculation (distance × DEFRA factor = CO₂e)
  → Social Value Calculation (TOMS measure × proxy value = £)
  → Dashboard Aggregation (rolled up by site → project → contract → BU → tenant)
  → Evidence Traceability (metric links to calculation links to source document)
  → Audit Trail (immutable log of every state change)
  → Report Generation (SECR / PPN 06/21 / CSRD / BREEAM / NHS Evergreen)
```

---

## 5. User Personas

### P1: Sustainability Director (Tenant level)
**Context:** Responsible for the company's net zero commitments, SECR filing, PPN 06/21 Carbon Reduction Plan.  
**Primary actions:** Review aggregate dashboards, publish snapshots, sign off reports, set reduction targets.  
**Pain points today:** Manual Excel aggregation from dozens of spreadsheets, no audit trail, data arrives late or inconsistently.  
**Fluid value:** Real-time aggregated dashboard, one-click SECR report, automatic PPN 06/21 CRP update.

### P2: Sustainability Manager (Tenant level)
**Context:** Day-to-day data management — importing CSV data, reviewing field submissions, running calculations, managing the review queue.  
**Primary actions:** Approve/reject field submissions, trigger calculation runs, manage imports, assign review tasks.  
**Pain points today:** Chasing subcontractors for data, re-keying data from PDFs, version conflicts in Excel.  
**Fluid value:** Field worker submissions arrive directly in the review queue with OCR pre-fill, single source of truth.

### P3: Contract Manager (Contract level)
**Context:** Responsible for a specific contract's carbon and social value performance (e.g., NHS contract).  
**Primary actions:** View contract-level dashboard, generate client-deliverable report, manage subcontractors, track social value commitments.  
**Pain points today:** No system to aggregate data from subcontractors, no standard format for client submission.  
**Fluid value:** Contract-scoped dashboard, PPN 06/21 CRP generation, TOMS social value tracking.

### P4: Site Supervisor / Field Worker (Site level)
**Context:** On-site subcontractor, tipper hire, or delivery driver. Photographs waste tickets, delivery notes, fuel receipts.  
**Primary actions:** Open Fluid mobile app, photograph document, review pre-filled form, submit.  
**Pain points today:** Paperwork gets lost, WhatsApp photos not usable for audit, re-entry required by office.  
**Fluid value:** One-tap capture, offline-first (no connectivity required on site), instant status updates.

### P5: Auditor (Read-only)
**Context:** External auditor verifying SECR/GHG Protocol compliance, or internal audit checking data quality.  
**Primary actions:** Browse activity records, inspect calculation explanations, download factor citations, export audit trail.  
**Pain points today:** No system audit trail, no factor version history, cannot reproduce calculations independently.  
**Fluid value:** Immutable calculation rows, factor library version pinned per calculation, timestamped audit log.

### P6: Client Viewer (External, per contract)
**Context:** The client who awarded the contract (e.g., NHS Trust, local authority). Has read-only access to their contractor's carbon and social value data for their specific contract.  
**Primary actions:** View contract dashboard, download formal report.  
**Pain points today:** Receive a PDF from the contractor with no traceability.  
**Fluid value:** Live portal access with drilldown to evidence, white-labeled with the contractor's branding.

### P7: Platform Owner (Fluid staff)
**Context:** Fluid engineering/operations team managing all tenants.  
**Primary actions:** Tenant onboarding, billing, white-label configuration, platform health monitoring.  
**Fluid value:** Full platform admin panel, tenant impersonation (audited), usage analytics.

---

## 6. Functional Requirements — Web Platform

### 6.1 Evidence Capture (Web)

| Req | Description | Priority |
|---|---|---|
| EV-01 | Drag-and-drop file upload accepting PDF, JPEG, PNG, HEIC, DOCX, XLSX, CSV | P0 |
| EV-02 | Bulk upload (ZIP containing multiple documents) — extract and process each | P0 |
| EV-03 | Email-to-upload inbound address per tenant (`evidence@[tenant].fluidplatform.com`) | P1 |
| EV-04 | OCR extraction on uploaded PDFs and images (Claude vision API) | P0 |
| EV-05 | Confidence score displayed per extracted field (0–100%) | P0 |
| EV-06 | Low-confidence fields highlighted in yellow; zero-confidence in red | P0 |
| EV-07 | Manual override and correction for any extracted field | P0 |
| EV-08 | Evidence linked to a record; record cannot be approved without evidence | P0 |
| EV-09 | Evidence viewer: zoom, rotate, annotate PDF/image inline | P1 |
| EV-10 | Duplicate detection: SHA-256 checksum dedup across the org | P0 |
| EV-11 | Evidence provenance: show upload date, uploader, OCR confidence, approval history | P0 |

### 6.2 Activity Records

| Req | Description | Priority |
|---|---|---|
| AR-01 | Manual record creation with full field set (date, category, amount, unit, site, postcode pair) | P0 |
| AR-02 | CSV/Excel bulk import with column mapping wizard | P0 |
| AR-03 | 40+ column alias support in import validator | P0 |
| AR-04 | Import state machine: uploaded → parsing → validating → staged → committed | P0 |
| AR-05 | Error CSV download listing invalid rows with reasons | P0 |
| AR-06 | Review workflow: draft → in_review → approved / rejected | P0 |
| AR-07 | Comment thread per record | P0 |
| AR-08 | Review task assignment to named reviewer | P0 |
| AR-09 | Record filtering: site, project, contract, category, scope, date range, status | P0 |
| AR-10 | Cursor-paginated record list (handles 100k+ records without timeout) | P0 |
| AR-11 | Inline edit for approved records (creates new version, preserves original calculation) | P1 |
| AR-12 | Record linking: one record can link to multiple evidence files | P0 |
| AR-13 | Anomaly flagging: records >3σ from category mean flagged for review | P1 |

### 6.3 Dashboard

| Req | Description | Priority |
|---|---|---|
| DB-01 | Executive summary: total CO₂e by scope, total social value £, data quality % | P0 |
| DB-02 | Hierarchy selector: drill from tenant → BU → contract → project → site | P0 |
| DB-03 | Scope 1/2/3 donut chart with category breakdown | P0 |
| DB-04 | Period-over-period trend line (monthly/quarterly/annual) | P0 |
| DB-05 | Top 10 emission sources (category × facility × supplier) | P0 |
| DB-06 | Data completeness panel: % of records with evidence, % approved, % calculated | P0 |
| DB-07 | Carbon intensity KPI: tCO₂e per £m contract value, tCO₂e per FTE | P1 |
| DB-08 | Social value dashboard: TOMS themes, £ by measure, target vs. actual | P0 |
| DB-09 | Waste performance: tonnes diverted from landfill, recycling rate %, EWC breakdown | P0 |
| DB-10 | Supplier performance: Scope 3 contribution by supplier | P1 |
| DB-11 | Fleet performance: vehicle types, distance, CO₂e by vehicle | P1 |
| DB-12 | Compliance status panel: SECR due date, PPN 06/21 status, NHS Evergreen status | P0 |
| DB-13 | Audit readiness score: 0–100% based on evidence coverage and approval rate | P0 |
| DB-14 | Every metric supports drill-down to calculations → source records → evidence | P0 |
| DB-15 | Forecast: projected annual CO₂e vs. reduction target (linear extrapolation) | P1 |
| DB-16 | Geospatial heatmap: emissions intensity by postcode/region (PostGIS) | P2 |
| DB-17 | Benchmark comparison: tenant vs. industry average (anonymised) | P2 |

### 6.4 Calculations

| Req | Description | Priority |
|---|---|---|
| CA-01 | Trigger calculation run for a reporting period | P0 |
| CA-02 | Immutable EmissionCalculation rows — never update, only append | P0 |
| CA-03 | Formula string stored: `amount × (co2 + ch4×27.9 + n2o×273)` | P0 |
| CA-04 | Factor library version pinned per calculation | P0 |
| CA-05 | Methodology version pinned per calculation | P0 |
| CA-06 | Per-record calculation explanation: factor used, selection reason, formula, GWP | P0 |
| CA-07 | Recalculation diff: show what changed vs. previous run before user confirms | P0 |
| CA-08 | Scope 2 dual-reporting: location-based and market-based methods | P0 |
| CA-09 | Automatic postcode-pair → road distance → HGV CO₂e chain | P0 |
| CA-10 | Spend-based EEIO fallback when quantity-based factor unavailable | P1 |
| CA-11 | DEFRA 2025 full factor library (500+ factors, all categories) | P0 |
| CA-12 | EPA 2025 factors (US tenants) | P1 |
| CA-13 | Historical recalculation when factors updated (creates new CalculationRun) | P1 |
| CA-14 | GWP version selector: AR5 vs. AR6 (AR6 default) | P1 |

### 6.5 Reports

| Req | Description | Priority |
|---|---|---|
| RP-01 | GHG Inventory Report (GHG Protocol) — PDF + CSV | P0 |
| RP-02 | SECR Directors' Report section — Word / PDF | P0 |
| RP-03 | PPN 06/21 Carbon Reduction Plan — government-mandated format | P0 |
| RP-04 | NHS Evergreen Level 1 Submission Pack | P0 |
| RP-05 | BREEAM Evidence Package (waste + transport + energy) | P0 |
| RP-06 | National TOMS Social Value Report | P0 |
| RP-07 | CSRD ESRS E1 (Climate Change) report | P1 |
| RP-08 | CSRD ESRS E2-E5 (Pollution, Water, Biodiversity, Resource Use) | P2 |
| RP-09 | Audit Package: all calculations + factor citations + evidence index | P0 |
| RP-10 | Monthly Snapshot Report | P0 |
| RP-11 | Contract Carbon Report (client-deliverable, per contract) | P0 |
| RP-12 | Supply Chain Carbon Report | P1 |
| RP-13 | CDP Questionnaire data export | P1 |
| RP-14 | TCFD disclosure narrative | P1 |
| RP-15 | Report versioning: every publish creates an immutable snapshot | P0 |
| RP-16 | Report total = dashboard total for the same snapshot (invariant) | P0 |
| RP-17 | White-labeled reports: tenant logo, colours, report header | P0 |
| RP-18 | 15-minute presigned download links (never expose storage keys) | P0 |
| RP-19 | Power BI OData export endpoint | P2 |
| RP-20 | Scheduled report delivery (email on the 1st of each month) | P1 |

### 6.6 Settings & Administration

| Req | Description | Priority |
|---|---|---|
| ST-01 | Org profile: name, industry, HQ country, reporting currency | P0 |
| ST-02 | Hierarchy management: create/edit BU, contract, project, site | P0 |
| ST-03 | User management: invite, role assignment, deactivate | P0 |
| ST-04 | Role assignment at hierarchy level (e.g., "contract manager on HS2 Lot 1") | P1 |
| ST-05 | Field worker invite links (time-limited, single-use) | P0 |
| ST-06 | Custom emission factor library (tenant uploads own factors) | P1 |
| ST-07 | Reporting period management: create, publish, lock | P0 |
| ST-08 | Branding configuration (logo, colours, favicon — Platform tier only) | P0 |
| ST-09 | Audit log viewer (filterable by user, action, resource) | P0 |
| ST-10 | Reduction targets: baseline period, target period, type (absolute/intensity) | P0 |
| ST-11 | Reduction initiatives: planned actions, expected CO₂e impact, status | P0 |

---

## 7. Functional Requirements — Flutter Mobile App

### 7.1 Authentication

| Req | Description | Priority |
|---|---|---|
| FL-01 | Invite link deep link → PIN setup (no email/password required for field workers) | P0 |
| FL-02 | Biometric unlock (Face ID / fingerprint) after PIN set | P1 |
| FL-03 | JWT stored in flutter_secure_storage | P0 |
| FL-04 | Auto-refresh on 401 via Dio interceptor | P0 |
| FL-05 | Session timeout: 30-day inactivity expiry | P0 |

### 7.2 Evidence Capture

| Req | Description | Priority |
|---|---|---|
| FL-06 | Open camera or pick from gallery | P0 |
| FL-07 | Multi-page document capture (stitch multiple photos) | P1 |
| FL-08 | On-device ML Kit OCR (~1–2s, works offline) | P0 |
| FL-09 | Live OCR overlay showing detected text regions in real time | P1 |
| FL-10 | Document type selector: Waste Ticket / Delivery Note / Fuel Receipt / Other | P0 |
| FL-11 | AI classification from OCR output (suggests document type if not selected) | P1 |

### 7.3 Entity Extraction & Form Pre-fill

| Req | Description | Priority |
|---|---|---|
| FL-12 | Waste ticket extraction: weight (kg/tonnes), EWC code, date, vehicle reg, site address | P0 |
| FL-13 | Delivery note extraction: material type, quantity, supplier name, delivery postcode, date | P0 |
| FL-14 | Fuel receipt extraction: fuel type, volume (litres), vehicle reg, date, total cost | P0 |
| FL-15 | Mileage log extraction: from/to postcodes, vehicle, purpose, miles | P1 |
| FL-16 | Utility bill extraction: account number, period, kWh/m³, total spend | P1 |
| FL-17 | Confidence indicator per field: green (>80%), amber (50–80%), red (<50%) | P0 |
| FL-18 | Manual override for any field | P0 |
| FL-19 | GPS auto-tag (with permission prompt, optional) | P0 |
| FL-20 | Site selector: list of sites the user is assigned to | P0 |
| FL-21 | Barcode/QR scanner for waste manifests (mobile_scanner) | P1 |

### 7.4 Offline Sync

| Req | Description | Priority |
|---|---|---|
| FL-22 | All submissions saved to local SQLite (drift) before network attempt | P0 |
| FL-23 | Offline banner when no connectivity (connectivity_plus) | P0 |
| FL-24 | Background sync drains queue when network returns | P0 |
| FL-25 | Idempotency key prevents duplicate submissions on retry | P0 |
| FL-26 | Submission status per record: pending / syncing / submitted / approved / rejected | P0 |
| FL-27 | Sync failure shows error with retry button | P0 |

### 7.5 Dashboards & Notifications

| Req | Description | Priority |
|---|---|---|
| FL-28 | Home screen: total CO₂e for assigned contract, recent submissions | P0 |
| FL-29 | Scope breakdown bar chart (fl_chart) with accessible list fallback | P0 |
| FL-30 | FCM push notification for submission approved / rejected / needs info | P0 |
| FL-31 | Deep link from notification → submission detail | P0 |
| FL-32 | Reports list: tap to view/share published contract reports (share_plus) | P1 |
| FL-33 | Social value summary: TOMS measures logged, £ total | P1 |

### 7.6 Platform Support

| Req | Description | Priority |
|---|---|---|
| FL-34 | Android (minSdk 23+) | P0 |
| FL-35 | iOS (iOS 14+) | P0 |
| FL-36 | Tablet layout optimised for Android tablets (site supervisors) | P1 |
| FL-37 | Dark mode support | P2 |

---

## 8. Evidence Management System

### 8.1 Supported Document Types

| Document Type | OCR Fields Extracted | Carbon Link | Social Value Link |
|---|---|---|---|
| Waste Transfer Note (WTN) | Weight, EWC code, waste carrier, collection/disposal postcodes, date | Transport CO₂e + waste treatment CO₂e | — |
| Waste Collection Ticket | Weight, waste stream, vehicle reg, date | Transport CO₂e | — |
| Delivery Note / GRN | Material, quantity, supplier, delivery postcode, date | Upstream transport CO₂e + materials CO₂e | SME/local supplier (TOMS) |
| Supplier Invoice | Supplier name, amount £, VAT, line items | Spend-based Scope 3 CO₂e | SME spend (TOMS T5/M1) |
| Fuel Receipt | Fuel type, volume, vehicle reg, date, site | Scope 1 mobile combustion CO₂e | — |
| Mileage Log | From/to, miles, vehicle type, purpose | Scope 1/3 transport CO₂e | — |
| Utility Bill | Account, period, kWh/m³, spend | Scope 2 electricity / Scope 1 gas CO₂e | — |
| Recycling Certificate | Material, weight, recycling facility | Diversion from landfill credit | — |
| Training Record | Course, attendees, hours, date | — | TOMS T1/M2 (training hours) |
| Volunteering Record | Activity, hours, participants, date | — | TOMS T3 (volunteering hours) |
| Apprenticeship Contract | Name, start date, NVQ level | — | TOMS T1/M3 (apprenticeship) |
| Employment Record | Local hire, job title, start date | — | TOMS T1/M1 (local employment) |
| Community Investment | Project, amount £, beneficiary | — | TOMS T3 |
| Hazardous Waste Record | Classification, quantity, disposal route | — | Regulatory compliance |
| PDF / Scanned Document | All above, via Claude vision OCR | Depends on classification | Depends on classification |

### 8.2 Document Lifecycle

```
Upload (web or mobile)
  → Virus scan (ClamAV or Cloudflare WAF)
  → Store to R2: org/{orgId}/evidence/{id}/{filename}
  → SHA-256 checksum computed + stored
  → Duplicate check (checksum vs. existing org evidence)
  → OCR extraction job queued
  → OCR completed → fields extracted + confidence scored
  → Linked to ActivityRecord (or FieldSubmission awaiting approval)
  → Record reviewed → approved
  → Calculation run references the record
  → EmissionCalculation links back to ActivityRecord links to EvidenceFile
  → Report references the snapshot which includes the calculation
  → Audit trail: every step logged in AuditLog
```

### 8.3 Evidence Requirements per Record Type

| Category | Evidence Required | Minimum Confidence |
|---|---|---|
| Waste (any) | Waste Transfer Note or Collection Ticket | 70% on weight + EWC code |
| Transport / Fleet | Fuel receipt OR mileage log OR delivery note | 70% on date + volume/distance |
| Electricity | Utility bill with period + kWh | 80% on kWh reading |
| Gas | Utility bill with period + m³/kWh | 80% |
| Purchased goods | Invoice or GRN | 60% (spend-based fallback allowed) |
| Social value (apprenticeship) | Apprenticeship contract | 90% |
| Social value (employment) | Employment record or payroll extract | 80% |

Records below evidence threshold are flagged with `evidenceStatus: missing | partial`.

---

## 9. OCR & AI Extraction Engine

### 9.1 Architecture

**Mobile (on-device):** `google_mlkit_text_recognition 0.15.0`
- Runs entirely on device — no cloud API, no cost, works offline
- ~1–2 second inference time
- Used by: `mobile/lib/features/capture/ocr_extractor.dart`

**Web (cloud):** Claude `claude-sonnet-4-6` vision API
- Used for: uploaded PDFs, DOCX, scanned images via web interface
- Input: rendered page image (Puppeteer → PNG) or raw text from `pdf-parse`
- Output: structured JSON matching extraction schema
- Cost: ~£0.01–0.03 per document at Sonnet pricing

**Classification AI:** Claude (same model)
- Input: OCR raw text + document type hint
- Output: `{ documentType, ewcCode, emissionCategory, confidence, reasoning }`

### 9.2 Extraction Schema

```typescript
interface OcrExtractionResult {
  documentType: "waste_ticket" | "delivery_note" | "fuel_receipt" | "utility_bill" |
                "training_record" | "employment_record" | "apprenticeship" | "other";
  confidence: number; // 0–100 overall
  fields: {
    date?: { value: string; confidence: number };
    weight?: { value: number; unit: "kg" | "tonne"; confidence: number };
    ewcCode?: { value: string; confidence: number }; // e.g. "17 05 04"
    vehicleReg?: { value: string; confidence: number };
    collectionPostcode?: { value: string; confidence: number };
    disposalPostcode?: { value: string; confidence: number };
    supplierName?: { value: string; confidence: number };
    fuelType?: { value: string; confidence: number };
    volume?: { value: number; unit: "litre" | "m3" | "kWh"; confidence: number };
    spendAmount?: { value: number; currency: string; confidence: number };
    quantity?: { value: number; unit: string; confidence: number };
    materialType?: { value: string; confidence: number };
    employeeCount?: { value: number; confidence: number };
    hours?: { value: number; confidence: number };
  };
  suggestedEmissionCategory?: string;
  suggestedEwcCode?: string;
  warnings: string[];
}
```

### 9.3 Review Workflow

```
overall confidence ≥ 80%  → auto-stage for review (green)
overall confidence 50–79% → flagged for manual review (amber)
overall confidence < 50%  → blocked, must be manually entered (red)
```

Field workers and web users can always override any extracted field. Corrections are tracked: `corrected_fields: string[]` stored on `FieldSubmission.ocrExtractedData`.

### 9.4 Learning Feedback Loop

Every correction creates a training signal:
- `OcrCorrection` event logged: field, original value, corrected value, document type
- Weekly batch exports corrections to inform future prompt improvements
- Platform operator reviews correction patterns monthly and updates extraction prompts

---

## 10. Carbon Accounting Engine

### 10.1 Calculation Pipeline (current + enhanced)

```
ActivityRecord (approved)
  ↓
Step 1: Unit normalisation
  normalizeUnit(amount, unit) → { normalisedAmount, normalisedUnit }
  Canonical units: kg, kWh, litre, km, GBP, m³, tonne-km

Step 2: Postcode → distance chain (new)
  if (pickupPostcode && deliveryPostcode && !manualDistance):
    getOrCreateRouteDistance(pickup, delivery) → distanceKm
    activityRecord.distanceAmount = distanceKm
    activityRecord.distanceUnit = "km"

Step 3: Factor selection
  selectFactor(category, scope, geography, date, scope2Method)
  → EmissionFactor row
  Precedence: exact match > regional > national > global

Step 4: CO₂e computation
  if factor is gas-specific:
    co2e = amount × (factor.co2 + factor.ch4 × 27.9 + factor.n2o × 273)
  if factor is scalar:
    co2e = amount × factor.co2e

Step 5: Persist EmissionCalculation (immutable)
  {
    activityRecordId, calculationRunId, emissionFactorId,
    factorLibraryVersion, methodologyVersionName,
    originalAmount, originalUnit, normalisedAmount, normalisedUnit,
    co2, ch4, n2o, totalCo2e,
    formula: "3.5t × (2.10 kg CO₂/t + 0.00103 kg CH₄/t × 27.9 + ...)",
    warnings: ["no exact UK region match, using national GB factor"]
  }

Step 6: Rebuild DashboardAggregate
  Incremental upsert per (org, period, snapshot, scope, category, facility, BU)
```

### 10.2 Emission Factor Library Requirements

**Current state:** 38 factors (DEFRA 2025 + EPA 2025, MVP categories)

**Required for enterprise launch (500+ factors):**

| Category | Factors needed | Source |
|---|---|---|
| Scope 1 — Stationary combustion | Natural gas, LPG, burning oil, coal, wood pellets, biogas | DEFRA 2025 |
| Scope 1 — Mobile combustion | Diesel, petrol, CNG, LPG, HVO (HGV, van, car, motorcycle, plant) | DEFRA 2025 |
| Scope 1 — Refrigerants | R-11, R-12, R-22, R-32, R-134a, R-404A, R-407C, R-410A, R-507A, R-744, HFOs | DEFRA 2025 |
| Scope 2 — Electricity | UK grid (location-based), UK regions (National Grid ESO), Renewable (market-based), US grid by eGRID region | DEFRA 2025 + ESO |
| Scope 2 — Heat/steam | District heating UK | DEFRA 2025 |
| Scope 3 — Business travel | Car (small/medium/large, petrol/diesel/EV), domestic/short/long-haul flight, rail (UK/international), taxi | DEFRA 2025 |
| Scope 3 — Commuting | Car, bus, rail, walking, cycling (per commuter km) | DEFRA 2025 |
| Scope 3 — Upstream transport | HGV (by weight class), LGV, van, sea freight (bulk/container), air freight, rail freight | DEFRA 2025 |
| Scope 3 — Purchased goods | ICE Database v3 (construction materials: concrete, steel, timber, glass, insulation, aggregate, asphalt) | ICE DB v3 |
| Scope 3 — Waste treatment | Landfill (by waste type), incineration, composting, anaerobic digestion, reuse, recycling (by material) | DEFRA 2025 |
| Scope 3 — Water | Mains water supply, wastewater treatment | DEFRA 2025 |
| Scope 3 — Spend-based | EEIO (all UK SIC codes) | EPA USEEIO v2.0 |
| Transport chain | Multimodal: road + sea + air combinations | DEFRA 2025 |

**Factor management requirements:**
- No hardcoded factors in application code — all in database
- Factor versioning: DEFRA updates annually (January)
- When new factors published: create new `FactorLibrary` version, existing calculations unaffected
- Historical recalculation on demand (new CalculationRun with new library version)
- Admin import tool for new factor libraries (CSV upload)

### 10.3 Transport Carbon Auto-Chain

When an `ActivityRecord` has `pickupPostcode` + `deliveryPostcode` but no explicit `distanceAmount`:

```
1. Geocode both postcodes (postcodes.io → lat/lng, cached in PostcodeGeocode)
2. Calculate road distance (OSRM self-hosted or HERE Routes API)
3. Cache route in RouteDistance (unique by pickup+delivery+provider hash)
4. Select vehicle type factor from DEFRA Scope 3 upstream transport
5. Compute CO₂e: distanceKm × loadTonnes × HGV factor
6. Store distanceSource: "osrm_calculated" | "manual_override"
```

If no vehicle type specified: use "average HGV" as default, log warning.

### 10.4 DEFRA Methodology Compliance

- Methodology version: `ghg-protocol-v2026-01` (seeded)
- GWP values (AR6): CH₄ = 27.9, N₂O = 273 (stored on MethodologyVersion)
- GWP version selectable per CalculationRun (AR5 / AR6)
- Scope 2: dual-reporting (location-based + market-based) supported simultaneously
- Scope 3 category 1 (purchased goods): spend-based EEIO fallback available
- All factors have `effectiveStartDate` and `effectiveEndDate` — engine selects the factor valid on `ActivityRecord.activityDate`

---

## 11. Social Value Engine

### 11.1 National TOMS Framework

**Source:** Social Value Portal National TOMs (2025 edition)

**5 Themes → 20 Outcomes → 48 Measures:**

| Theme | Code | Measures (examples) |
|---|---|---|
| Jobs & Skills | T1 | M1: Local employment (FTE), M2: Training hours, M3: Apprenticeship starts |
| Growth | T2 | M1: SME supply chain spend, M2: VCSE supply chain spend, M3: Local supply chain spend |
| Social | T3 | M1: Volunteering hours, M2: Fundraising/donations, M3: Community investment £ |
| Environment | T4 | M1: Carbon reduction (tCO₂e), M2: Waste diverted (tonnes), M3: Biodiversity net gain |
| Innovation | T5 | M1: R&D investment £, M2: Social enterprise support |

**Proxy financial values (illustrative — use current TOMS workbook for actuals):**

| Measure | Unit | Value (£) |
|---|---|---|
| T1/M1 Local employment (FTE) | per FTE/year | £18,500 |
| T1/M2 Training hours | per hour | £16.09 |
| T1/M3 Apprenticeship starts | per start | £8,000 |
| T2/M1 SME supply chain spend | per £ spent | £0.02 |
| T3/M1 Volunteering hours | per hour | £16.09 |
| T4/M1 Carbon reduction beyond target | per tCO₂e | £264 |
| T4/M2 Waste diverted from landfill | per tonne | £35 |

### 11.2 Social Value Calculation Engine

```
For each SocialValueRecord:
  valuePounds = quantity × measure.valuePerUnit

For contract:
  totalSocialValue = Σ valuePounds where record.contractId = contractId

For contract:
  socialValueScore = (totalSocialValue / contractValue) × 100
  Target (PPN 06/21): typically 10% of contract value
```

### 11.3 PPN 06/21 Compliance

PPN 06/21 (Carbon Reduction Plans) requires:
1. Net zero commitment by 2050 (verified from org profile)
2. Baseline emissions footprint (taken from first published CalculationRun)
3. Current emissions (latest approved CalculationRun)
4. Reduction targets (ReductionTarget model)
5. Actions taken (ReductionInitiative model)
6. Methodology statement (MethodologyVersion + factor citations)

Fluid generates the Carbon Reduction Plan PDF automatically from these inputs. Users review and sign off; Fluid provides the formatted document.

### 11.4 NHS Evergreen Level 1

Requirements (from April 2026):
1. Net zero commitment publicly available (link stored in org profile)
2. Carbon Reduction Plan complying with PPN 006 (generated by Fluid)
3. Submit via Atamis supplier portal (Fluid generates the required data extract)

Fluid pre-populates the NHS Evergreen submission pack from the approved CRP. Manual submission to Atamis is a copy-paste step.

---

## 12. Geospatial & Transport Engine

### 12.1 UK Postcode Intelligence

Every postcode submitted via web or mobile is geocoded:

```
Submitted postcode (e.g., "S1 2JE")
  → Normalise (uppercase, remove spaces, validate format)
  → Check PostcodeGeocode cache (exact match on normalizedPostcode)
  → If miss: call postcodes.io API
  → Store: { latitude, longitude, region, localAuthority, county, nation }
  → PostGIS geography column (future): POINT(lng lat)
```

**Supported nations:** England, Scotland, Wales, Northern Ireland (including BT postcodes via OS Places API fallback).

### 12.2 Route Calculation

```
(pickupPostcode, deliveryPostcode)
  → Geocode both (cached)
  → Generate routeHash: SHA-256(normalised_pickup + normalised_delivery + provider)
  → Check RouteDistance cache
  → If miss: call routing API (OSRM self-hosted UK network)
  → Store: { distanceKm, durationSeconds, provider, routeHash }
  → Expiry: never (road distances are stable)
```

**Routing provider:** Self-hosted OSRM with UK OSM road network (replaces public OSRM endpoint which has no SLA and sends client addresses to a third party).

### 12.3 PostGIS Spatial Requirements

| Requirement | Description |
|---|---|
| GS-01 | Enable PostGIS extension on PostgreSQL | 
| GS-02 | Add `geography(Point, 4326)` column to `PostcodeGeocode` |
| GS-03 | GiST spatial index on geography column |
| GS-04 | `ST_Distance` for nearest facility to site |
| GS-05 | `ST_Within` for region-based factor selection (postcode region → DEFRA region) |
| GS-06 | Geospatial API: `GET /api/orgs/[orgId]/geo/nearest-facility?postcode=S12JE` |
| GS-07 | Dashboard heat map: emissions density by postcode district (PostGIS cluster) |

---

## 13. Reporting & Standards Engine

### 13.1 Report Generation Architecture

```
Report request (web or API)
  → Validate: snapshot published, user has permission
  → requestHash dedup (prevents double-generation)
  → pg-boss "reports" queue
  → processReport() worker:
    1. Fetch PublishedSnapshot + DashboardAggregate + top emitters
    2. Fetch tenant branding (logo, colours) from TenantBranding
    3. Select report template by type
    4. Generate HTML using template engine
    5. Inject branding: logo in header, primary colour for table headers
    6. Puppeteer: render HTML → PDF
    7. SHA-256 checksum
    8. Upload to R2: org/{orgId}/reports/{reportId}/report.pdf
    9. Update Report.status → "ready"
    10. AuditLog entry
  → 15-min presigned download URL returned to client
```

### 13.2 Report Templates Required

#### Template 1: GHG Inventory Report
**Standard:** GHG Protocol Corporate Standard  
**Sections:** Executive summary, boundary and methodology, Scope 1 by source, Scope 2 (LB + MB), Scope 3 by category, data quality assessment, factor citations (appendix), calculation methodology statement

#### Template 2: SECR Directors' Report Section
**Standard:** Streamlined Energy & Carbon Reporting (UK, 2019)  
**Required fields:** UK energy consumption (kWh), global energy (if applicable), Scope 1 + 2 emissions (tCO₂e), intensity ratio (per FTE or £m revenue), energy efficiency measures taken, prior year comparison, methodology statement  
**Format:** Narrative + table, ready to paste into Directors' Report

#### Template 3: Carbon Reduction Plan (PPN 06/21)
**Standard:** Cabinet Office PPN 06/21 / PPN 006  
**Sections:** Organisation commitment (net zero by 2050), current emissions footprint (all scopes), baseline year, reduction targets, actions taken and planned, methodology, sign-off  
**Format:** Government-mandated layout (follows PPN 06/21 template PDF structure)

#### Template 4: NHS Evergreen Level 1 Pack
**Standard:** NHS England Evergreen Sustainable Supplier Assessment  
**Sections:** Net zero commitment evidence, Carbon Reduction Plan link, methodology statement, summary table for Atamis submission  
**Format:** PDF + structured data extract (CSV for Atamis import)

#### Template 5: BREEAM Evidence Package
**Standard:** BREEAM UK New Construction / Refurbishment  
**Credits covered:** Wst 01 (construction waste), Tra 01 (transport assessment), Ene 01 (energy performance)  
**Sections:** Waste tonnage by EWC chapter, recycling rate %, transport emissions by mode, energy consumption by type, evidence index (links to source documents)

#### Template 6: National TOMS Social Value Report
**Standard:** Social Value Portal National TOMs  
**Sections:** TOMS theme breakdown, total £ social value, evidence per measure, contract value comparison (% social value vs. contract)  
**Format:** Tables + narrative, suitable for public sector tender responses

#### Template 7: Audit Package
**Standard:** GHG Protocol + ISAE 3410 (limited assurance)  
**Sections:** Full inventory, every EmissionCalculation row, factor citations (EmissionFactor.externalId + library version), methodology version, data quality log, incomplete evidence log, AuditLog extract  
**Format:** PDF + CSV of all calculations + CSV of all factor citations

#### Template 8: CSRD ESRS E1 (Climate Change)
**Standard:** EU CSRD ESRS E1  
**Sections:** Climate governance, strategy (risks/opportunities), targets and metrics, GHG inventory (all scopes), transition plan, energy consumption, EU Taxonomy eligibility  
**Format:** Structured tables per ESRS E1 disclosure requirements (DR E1-1 through E1-9)

### 13.3 Report Invariant

> **The total CO₂e in any report MUST equal the total CO₂e in the dashboard for the same snapshot.**

This is enforced by always reading from `DashboardAggregate` (keyed by `snapshotId`) — both the dashboard and report use the same data source. Any deviation is a P0 bug.

---

## 14. Multi-Tenancy & White-Label Architecture

### 14.1 Tenant Hierarchy (Schema additions required)

**New models needed:**

```prisma
model Platform {
  id        String @id @default(cuid())
  name      String @default("Fluid")
  createdAt DateTime @default(now())
}

model PlatformMembership {
  id        String @id @default(cuid())
  userId    String
  role      PlatformRole
  createdAt DateTime @default(now())
  user      User @relation(...)
  @@index([userId])
}

enum PlatformRole {
  platform_owner
  platform_support
  platform_analyst
}

model Contract {
  id                String @id @default(cuid())
  organizationId    String
  businessUnitId    String?
  name              String
  clientName        String?
  contractReference String?
  contractValue     Decimal? @db.Decimal(18, 2)
  currency          String   @default("GBP")
  startDate         DateTime?
  endDate           DateTime?
  ppn06_21_required Boolean  @default(false)
  nhs_evergreen_required Boolean @default(false)
  status            ContractStatus @default(active)
  createdByUserId   String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  projects          Project[]
  socialValueRecords SocialValueRecord[]
  socialValueTargets SocialValueTarget[]
  @@index([organizationId, status])
}

model Project {
  id             String @id @default(cuid())
  organizationId String
  contractId     String
  name           String
  projectCode    String?
  startDate      DateTime?
  endDate        DateTime?
  status         ProjectStatus @default(active)
  createdAt      DateTime @default(now())
  sites          Site[]
  @@index([organizationId, contractId])
}

model Site {
  id             String @id @default(cuid())
  organizationId String
  projectId      String
  name           String
  postcode       String?
  addressLine1   String?
  city           String?
  createdAt      DateTime @default(now())
  activityRecords ActivityRecord[]
  fieldSubmissions FieldSubmission[]
  @@index([organizationId, projectId])
}

model TenantBranding {
  id                    String @id @default(cuid())
  organizationId        String @unique
  subdomain             String @unique
  customDomain          String?
  primaryHex            String @default("#0f4c8a")
  accentHex             String @default("#e8f0fe")
  logoStorageKey        String?
  faviconStorageKey     String?
  reportHeaderLogoKey   String?
  emailFromName         String?
  emailFromDomain       String?
  fontFamily            String @default("Inter")
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  organization          Organization @relation(...)
}
```

### 14.2 Subdomain Routing

```typescript
// middleware.ts — tenant resolution by subdomain
const hostname = request.headers.get("host") ?? "";
const subdomain = hostname.split(".")[0];

if (subdomain && subdomain !== "www" && subdomain !== "app") {
  const branding = await db.tenantBranding.findUnique({
    where: { subdomain },
    select: { organizationId: true, primaryHex: true, logoStorageKey: true }
  });
  if (branding) {
    // Inject org context header for downstream server components
    request.headers.set("x-tenant-org-id", branding.organizationId);
    request.headers.set("x-tenant-primary-hex", branding.primaryHex);
  }
}
```

### 14.3 White-Label Theme Injection

```tsx
// app/(app)/layout.tsx — inject CSS custom properties per tenant
const branding = await getTenantBranding(orgId);
const css = branding ? `
  :root {
    --brand-primary: ${branding.primaryHex};
    --brand-accent: ${branding.accentHex};
    --brand-font: '${branding.fontFamily}', Inter, sans-serif;
  }
` : "";

return (
  <html>
    <head><style dangerouslySetInnerHTML={{ __html: css }} /></head>
    <body>{children}</body>
  </html>
);
```

### 14.4 Tenant-Aware Storage

All R2 keys scoped by `orgId`. No cross-tenant key access is possible:
```
org/{orgId}/evidence/{evidenceId}/{filename}
org/{orgId}/imports/{importId}/source.csv
org/{orgId}/reports/{reportId}/report.pdf
org/{orgId}/branding/logo.png
org/{orgId}/branding/favicon.ico
```

---

## 15. RBAC & Permission Model

### 15.1 Roles (15 roles across 3 scopes)

**Platform scope:**
- `platform_owner` — full platform control, billing, all tenants
- `platform_support` — read all tenants, impersonate (audited)
- `platform_analyst` — read-only platform metrics

**Tenant scope:**
- `tenant_admin` — full tenant control, users, branding, contracts
- `sustainability_director` — publish snapshots, sign off reports, set targets
- `sustainability_manager` — day-to-day: imports, calculations, review queue
- `reviewer` — approve/reject records and field submissions
- `auditor` — read-only + export; all reads timestamped
- `viewer` — read-only dashboard and reports

**Hierarchy scope (contract / project / site):**
- `contract_manager` — manage their contract, invite subcontractors
- `project_manager` — manage one project's sites and records
- `site_manager` — manage one site's records
- `supervisor` — submit records, manage field workers on their site
- `field_worker` — submit field submissions only, own data only

**External:**
- `client_viewer` — read-only access to one contract's carbon + social report

### 15.2 Permission Inheritance

Roles inherit downward through the hierarchy:
- A `sustainability_manager` can act as `reviewer` and `viewer` on any resource
- A `contract_manager` can act as `project_manager` on any project within their contract
- A `client_viewer` can only see the contract they were explicitly granted access to

---

## 16. Integration Requirements

### 16.1 Priority Integrations

| Integration | Type | Priority | Use case |
|---|---|---|---|
| Cloudflare R2 | Storage | P0 | Evidence, reports, imports |
| postcodes.io | Geocoding | P0 | UK postcode → lat/lng |
| OSRM (self-hosted) | Routing | P0 | Road distance calculation |
| HERE Routes API | Routing | P1 | Production routing fallback |
| Resend | Email | P0 | Transactional notifications |
| Firebase FCM | Push | P0 | Mobile notifications |
| Puppeteer | PDF | P0 | Report generation |
| Claude API | AI/OCR | P0 | Web document extraction + classification |
| Power BI (OData) | Analytics | P1 | Enterprise BI integration |
| Microsoft Entra / Azure AD | SSO | P1 | Enterprise SSO |
| SAP S/4HANA | ERP | P2 | Scope 3 procurement data |
| Oracle Fusion | ERP | P2 | Procurement + fleet data |
| Xero / QuickBooks | Accounting | P1 | SME spend-based Scope 3 |
| Procore | Construction PM | P1 | Project sync, subcontractor data |
| Atamis | NHS procurement | P1 | NHS Evergreen submission export |

### 16.2 API-First Design

All Fluid functionality exposed via REST API:
- JWT authentication for API clients (same Better Auth token endpoint)
- Versioned API (`/api/v1/...`)
- OpenAPI 3.1 schema auto-generated from Zod schemas
- Rate limits: 60 req/min for Standard, 600 req/min for Enterprise API tier
- Webhook support: `POST /api/webhooks/{event}` for calculation complete, submission approved, report ready

---

## 17. Security & Compliance Requirements

### 17.1 Authentication

| Req | Description |
|---|---|
| S-01 | Email/password (web) via Better Auth with bcrypt |
| S-02 | Microsoft Entra ID / Azure AD SSO (SAML 2.0) |
| S-03 | Google OAuth (optional) |
| S-04 | MFA: TOTP (app-based) mandatory for `tenant_admin` and above |
| S-05 | JWT for Flutter mobile (stored in flutter_secure_storage) |
| S-06 | PIN-based auth for field workers (no email/password required) |
| S-07 | Session expiry: 7 days rolling (web), 30 days (mobile) |
| S-08 | Session revocation on role change |

### 17.2 Data Protection

| Req | Description |
|---|---|
| S-09 | Encryption at rest: Neon Postgres AES-256, R2 server-side encryption |
| S-10 | Encryption in transit: TLS 1.3 minimum |
| S-11 | GDPR Article 17 (right to erasure): user deletion cascade |
| S-12 | Data residency: Neon EU West region for EU tenants |
| S-13 | 90-day audit log retention minimum (configurable to 7 years for NHS) |
| S-14 | Data processing agreement (DPA) signed with: Neon, Cloudflare, Resend, Anthropic |

### 17.3 Application Security

| Req | Description |
|---|---|
| S-15 | Content Security Policy header (default-src 'self') |
| S-16 | HSTS: max-age=63072000, includeSubDomains, preload |
| S-17 | CSRF protection (Better Auth CSRF tokens) |
| S-18 | Rate limiting: Redis-backed (Upstash), not in-memory |
| S-19 | Cross-tenant access tests in CI (automated regression) |
| S-20 | Row-level security: every query filtered by organizationId |
| S-21 | No raw storage keys exposed to clients (presigned URLs only, 15-min TTL) |
| S-22 | Dependency vulnerability scanning (GitHub Dependabot + CodeQL) |
| S-23 | Secrets scanning (no API keys in commits) |
| S-24 | Penetration test annually (third party) |

### 17.4 Compliance Certifications (Roadmap)

| Certification | Timeline | Notes |
|---|---|---|
| Cyber Essentials | Q3 2026 | Required for NHS/government contracts |
| Cyber Essentials Plus | Q4 2026 | Enhanced verification |
| ISO 27001 | 2027 | Enterprise procurement requirement |
| SOC 2 Type II | 2027 | US enterprise customers |
| NHS DSPT (Data Security and Protection Toolkit) | Q4 2026 | Required for NHS data processing |

---

## 18. Performance Requirements

| Metric | Target | Mechanism |
|---|---|---|
| Dashboard load | < 3s for 100k records | DashboardAggregate pre-computed, no live aggregation |
| API response (list endpoints) | < 500ms p95 | Cursor pagination, composite indexes |
| Import processing | < 2 min for 25k rows | Async pg-boss job, streaming CSV parse |
| PDF report generation | < 60s | Async worker, Puppeteer warm |
| OCR processing (web) | < 10s per document | Claude API, async job |
| OCR processing (mobile) | < 2s | On-device ML Kit |
| File upload | < 30s for 50 MB | Direct to R2 via presigned URL, bypasses Next.js |
| Route distance lookup | < 200ms (cached) | PostcodeGeocode + RouteDistance cache |
| Route distance calculation | < 3s (uncached) | OSRM API call |
| Full calculation run | < 5 min for 100k records | pg-boss concurrency 4, batch upsert |

---

## 19. Data Model Requirements

### 19.1 New Models Required (beyond current schema)

| Model | Purpose | Priority |
|---|---|---|
| `Contract` | Link BU → projects, hold PPN 06/21 flag | P0 |
| `Project` | Link contract → sites | P0 |
| `Site` | Physical location (more granular than Facility) | P0 |
| `TenantBranding` | White-label config per org | P0 |
| `PlatformMembership` | Platform-level roles | P0 |
| `SocialValueMeasure` | TOMS measure definitions + proxy values | P0 |
| `SocialValueRecord` | Evidence-linked social value activity | P0 |
| `SocialValueTarget` | Per-contract £ target | P0 |
| `OcrCorrection` | Learning feedback (field corrected after OCR) | P1 |
| `EvidenceClassification` | AI classification output per document | P0 |
| `Plan` | Subscription plan definition | P1 |
| `Subscription` | Tenant → plan, billing dates | P1 |
| `ApiKey` | API authentication token per tenant | P1 |
| `Webhook` | Outbound webhook endpoint per tenant | P1 |

### 19.2 Modified Models

| Model | Change | Priority |
|---|---|---|
| `Organization` | Add `planId`, `subdomain` (or move to TenantBranding) | P0 |
| `ActivityRecord` | Add `siteId`, `contractId`, `projectId` FKs | P0 |
| `FieldSubmission` | Add `siteId`, `contractId` | P0 |
| `Report` | Add `contractId`, extend `ReportType` enum with new types | P0 |
| `OrgRole` enum | Add 9 new roles | P0 |
| `EmissionCategory` | Add 25+ new categories (construction materials, waste treatment, water) | P0 |

---

## 20. Success Metrics

### 20.1 Adoption Metrics

| Metric | 3-month target | 12-month target |
|---|---|---|
| Paying tenants | 10 | 100 |
| Active users | 50 | 1,000 |
| Evidence documents processed | 1,000 | 100,000 |
| Mobile submissions | 500 | 50,000 |
| Reports generated | 50 | 5,000 |
| PPN 06/21 CRPs generated | 10 | 200 |

### 20.2 Quality Metrics

| Metric | Target |
|---|---|
| % records with at least one evidence document | ≥ 90% |
| OCR auto-fill success rate (confidence ≥ 80%) | ≥ 70% of documents |
| Report total = Dashboard total (invariant) | 100% — P0 bug if violated |
| Calculation traceability (every calculation has factor + formula) | 100% |
| Dashboard load under 3s | ≥ 99% of page loads |
| Cross-tenant access test suite pass rate | 100% always |

### 20.3 Business Metrics

| Metric | Target |
|---|---|
| MRR | £15,000 at 3 months, £150,000 at 12 months |
| Churn | < 5% monthly |
| NPS | ≥ 50 |
| Time to first report | < 2 hours for a new tenant |
| Support tickets per tenant per month | < 1 |

---

## 21. Implementation Phasing

### Phase 1 — Production Safety (Weeks 1–2)
Delete duplicate rate-limit module, add CSP header, cross-tenant test suite, session invalidation on role change, HERE Routes API (replace public OSRM — data protection), CodeQL in CI.

### Phase 2 — Hierarchy & White-Label (Weeks 3–6)
Add Contract / Project / Site models + migrations. Add TenantBranding + subdomain routing. Add PlatformMembership + platform admin routes. Extend RBAC to 15 roles. Update all record creation forms to include contract/project/site selectors.

### Phase 3 — Carbon Engine Expansion (Weeks 7–9)
Seed full DEFRA 2025 (500+ factors). Add construction materials (ICE Database v3). Add EWC-chapter waste treatment factors. Implement auto-chain: postcode pair → road distance → CO₂e. Add spend-based EEIO fallback in factor-selector.

### Phase 4 — Social Value Engine (Weeks 10–12)
Add National TOMS models and seed proxy values. Social value record creation (web + mobile). Per-contract TOMS aggregation. Social value dashboard panel.

### Phase 5 — Enterprise Reporting (Weeks 13–16)
SECR report template. PPN 06/21 Carbon Reduction Plan template. NHS Evergreen Level 1 pack. BREEAM evidence package. National TOMS report. Audit Package report. White-labeled PDF headers (tenant logo + colours in Puppeteer).

### Phase 6 — AI & OCR Enhancement (Weeks 17–19)
Web-side Claude vision OCR for uploaded documents. AI waste classification + EWC code suggestion. Evidence classification model stored on EvidenceClassification. OCR correction feedback logging.

### Phase 7 — Integrations (Weeks 20–24)
OpenAPI 3.1 schema auto-generated from Zod. Power BI OData endpoint. Microsoft Entra / Azure AD SSO. Xero/QuickBooks Scope 3 spend import. MFA (TOTP) implementation.

### Phase 8 — PostGIS & Spatial (Weeks 25–26)
Enable PostGIS on Neon. Migrate PostcodeGeocode to geography type. GiST indexes. Nearest-facility API. Emission heat map data endpoint.

---

*End of Fluid PRD — Version 2.0*  
*Next review: Before Phase 2 kickoff*  
*Owner: Product & Engineering*
