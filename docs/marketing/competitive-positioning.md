# CarbonSite Competitive Positioning Map

Strategic analysis of CarbonSite's competitive landscape. This document identifies market segments, competitor profiles, and positioning strategy for each segment.

---

## Market Segmentation (3 Tiers)

| Tier | Players | Size | Motives | Decision Timeline |
|------|---------|------|---------|-------------------|
| **Enterprise** | Persefoni, Watershed, Normative, Emitwise | €10k–100k/year | CSRD compliance, brand reputation, financial materiality | 6+ months, executive approval |
| **Mid-Market** | Plan A, Gaia, CarbonChain, Sweep | €2k–10k/year | CSRD readiness, SBTi targets, ESG reporting | 3–6 months, director approval |
| **SMB/Specialized** | CarbonSite, Greenly, Persefoni (entry), Normative (starter) | €0–5k/year (or free) | First time carbon accounting, pilot, supplier emissions | 1–3 months, manager approval |

CarbonSite competes primarily in **SMB/Specialized** + lower **Mid-Market**, with expansion potential into **Mid-Market** as features ship (real-time dashboards, SSO, advanced analytics).

---

## Competitor Profiles

### 1. Persefoni (Enterprise Leader)
- **Founded:** 2010
- **Funding:** $500M+ (last valuation: $5B+, public SPAC)
- **Market Position:** Enterprise emissions accounting + climate disclosure platform
- **Strengths:** 
  - Deep financial reporting integration (multi-GAAP, consolidation)
  - Enterprise UI polish (dashboards, reporting, mobile)
  - Extensive calculator library (20k+ emission factors)
  - SSO, data integrations, API
  - Large customer base (Fortune 500 tech/retail/energy)
- **Weaknesses:**
  - Expensive ($50k–150k/year for large orgs)
  - Closed-source (black-box methodology)
  - Long implementation (3–6 months)
  - Limited field worker/supplier capture
  - Scope 3 requires manual supplier surveys or third-party data feeds
- **CarbonSite vs:** Undercut on price (10x cheaper), win on field capture + transparency, lose on polish/integrations

### 2. Watershed (Enterprise + Mid-Market)
- **Founded:** 2020
- **Funding:** $50M+ Series B
- **Market Position:** Climate tech platform for procurement + supply chain
- **Strengths:**
  - Supplier data collection (API + portal)
  - Spend-based Scope 3 modeling (ERP integration, machine learning)
  - Clean UX, brand prestige (backed by Lowercarbon Capital)
  - Real-time dashboards + goal tracking
- **Weaknesses:**
  - Heavy on procurement/supply chain (not general-purpose emissions accounting)
  - Limited on direct facility emissions (Scope 1/2)
  - No field worker capture
  - Expensive ($20k–80k/year)
  - Closed-source
- **CarbonSite vs:** Differentiate on field-first (we own facility + supplier capture), win on transparency, lose on polish/procurement integrations

### 3. Normative (Mid-Market + SMB)
- **Founded:** 2019
- **Funding:** $20M+ Series A
- **Market Position:** Low-code carbon accounting for SMBs + mid-market
- **Strengths:**
  - Freemium model (attracts SMBs, viral adoption)
  - Simple UX (less overwhelming than enterprise tools)
  - Growing factor library + methodology docs
  - Free tier (up to some record limit)
- **Weaknesses:**
  - Limited field worker/mobile experience
  - Supplier data collection weak
  - Dashboard less sophisticated than Watershed/Persefoni
  - Closed-source
  - Small data integrations library (Stripe, Plaid, basic APIs)
- **CarbonSite vs:** Win on field capture + transparency + free tier, tie on price, lose on dashboard sophistication (but roadmap closing the gap)

### 4. Gaia (Mid-Market)
- **Founded:** 2022
- **Funding:** Bootstrapped or undisclosed early stage
- **Market Position:** Italian carbon accounting platform (EU focus)
- **Strengths:**
  - EU-centric (CSRD alignment, local regulatory knowledge)
  - Simple SMB-friendly interface
  - Growing user base (500–1k companies)
- **Weaknesses:**
  - Very limited data integration
  - No mobile/field worker experience
  - Small factor library (nascent)
  - Closed-source
  - No supplier management
- **CarbonSite vs:** Win on features, transparency, field capture; narrow on EU regulatory focus

### 5. Greenly (SMB + Mid-Market, Europe-heavy)
- **Founded:** 2018
- **Funding:** €10M+ (bootstrapped + early VC, undisclosed recent rounds)
- **Market Position:** Simple carbon footprint calculator + ESG reporting
- **Strengths:**
  - Very simple UX (mass market appeal)
  - Free tier + freemium (viral adoption in France, EU)
  - Green tech brand prestige
- **Weaknesses:**
  - Limited to Scope 1+2 (minimal Scope 3)
  - No field worker/mobile
  - Lightweight calculator (not for audit-level work)
  - Closed-source
- **CarbonSite vs:** Win on audit readiness + field capture + Scope 3; lose on simplicity/brand

### 6. Plan A (SMB + Mid-Market, D2C)
- **Founded:** 2021
- **Funding:** €5M+ early stage
- **Market Position:** Direct-to-consumer carbon footprint calculator
- **Strengths:**
  - Extremely simple (SMS/web form based)
  - Free to use
  - Engagement-focused (gamification, targets)
- **Weaknesses:**
  - Not for B2B organizational accounting
  - No field worker/supplier
  - No data integrations
  - Closed-source
- **CarbonSite vs:** Different market (we are B2B org accounting, they are D2C engagement); no direct competition

### 7. CarbonChain (Supply Chain Specific)
- **Founded:** 2013
- **Funding:** $10M+ 
- **Market Position:** Supply chain emissions analytics (agriculture, mining focus)
- **Strengths:**
  - Deep vertical expertise (farm emissions data, supply chain traceability)
  - Real-time visibility (IoT, blockchain-based tracking)
  - Sustainability-focused brand
- **Weaknesses:**
  - Not a general-purpose emissions accounting platform
  - Limited to specific industries (agriculture, apparel)
  - High implementation cost
- **CarbonSite vs:** Different vertical; no direct competition; complementary (they are supply chain, we are org-wide accounting)

### 8. Sweep (Expense Data Automation)
- **Founded:** 2021
- **Funding:** $3M+ seed/Series A
- **Market Position:** Automated emissions from credit card + expense data
- **Strengths:**
  - Novel angle (expenses → emissions, near-zero data entry)
  - Integrates with accounting systems (QuickBooks, Xero)
  - Freemium model
- **Weaknesses:**
  - Only covers spend-based Scope 3 (can't capture direct emissions)
  - No facility/supply chain management
  - No field worker/mobile
  - Limited customer data (pre-Series B)
- **CarbonSite vs:** Complementary (they do spend automation, we do facility + supplier capture); could integrate together

### 9. Emitwise (Enterprise, UK-focused)
- **Founded:** 2020
- **Funding:** $5M+ early stage
- **Market Position:** Enterprise emissions accounting + compliance for UK
- **Strengths:**
  - CSRD-aligned from day 1
  - Regulatory intelligence (UK climate law tracking)
  - Strong on compliance/audit workflows
- **Weaknesses:**
  - Limited geographic scope (UK only)
  - Small team + customer base
  - Limited integrations + field worker capabilities
  - Closed-source
- **CarbonSite vs:** Win on global applicability + field capture + transparency; lose on UK regulatory specialization

---

## Feature Comparison Matrix

| Feature Category | Feature | CarbonSite | Persefoni | Watershed | Normative | Gaia | Greenly | Plan A | Emitwise |
|---|---|---|---|---|---|---|---|---|---|
| **Data Capture** | Field worker mobile app + OCR | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Supplier portal | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | API integrations | ✅ (basic) | ✅ | ✅ (Salesforce, ERP) | ✅ (Stripe, basic) | ❌ | ❌ | ❌ | ✅ |
| | Spend data automation | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Calculation** | Scope 1/2 calculation engine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | Scope 3 estimation (ML) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| | Anomaly detection | ✅ | ✅ (basic) | ✅ (basic) | ❌ | ❌ | ❌ | ❌ | ❌ |
| | GHG Protocol v2 ready | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Methodology** | Open-source code | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Public emission factors | ✅ (GitHub) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Calculation transparency (formula visible) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| | Factor versioning + audit trail | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Reporting** | Dashboard + KPIs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | Real-time updates | 🚧 (roadmap) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | PDF report generation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| | CSRD report template | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| | Data export (CSV, JSON, API) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Compliance** | Audit trail (append-only) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| | SOC 2 certified | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | 🚧 |
| | GDPR/CCPA ready | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Enterprise** | SSO/SAML | 🚧 (roadmap Q2 2026) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| | Multi-org management | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Role-based access control (6+ roles) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| | SLA/support | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Pricing** | Transparent pricing (public) | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ |
| | Freemium tier | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| | Price range | $0–200/mo | $50k–150k/yr | $20k–80k/yr | $0–5k/yr | €100–500/mo | €99–500/mo | Free | Bespoke |

Legend:
- ✅ = Shipped and available
- 🚧 = Roadmap item (planned, not yet shipped)
- ❌ = Not available or not planned

---

## Positioning Strategy by Segment

### Segment 1: SMB First-Time Carbon Accounting (Price-Sensitive, Features-Light)

**Personas:** Startup founders, small business owners, NGO coordinators
**Decision Driver:** Cost + ease-of-use
**Incumbent:** Greenly (free), Normative (freemium)

**CarbonSite Positioning:**
- **Headline:** "Free carbon accounting that actually works"
- **Proof:** Transparent, open-source, no black boxes
- **Differentiation:** Field capture (if they have field operations)
- **Price:** Free tier, pay-as-you-grow
- **CTA:** "Start free trial"

**Win Strategy:**
- Compete on transparency (code audit, formulas visible)
- Attract technical buyers (engineers, data analysts)
- Upsell later: premium features, supplier management, reporting

**Lose Against:** Greenly (simpler UX), Normative (stronger brand)

---

### Segment 2: Mid-Market: Manufacturing + Logistics (Scope 1/2 Focus + Supplier Needs)

**Personas:** Sustainability Manager, Operations Director, Supply Chain Lead
**Decision Driver:** Supplier data collection ease + cost control
**Incumbent:** Watershed (supply chain), Normative (SMB-friendly)

**CarbonSite Positioning:**
- **Headline:** "Supplier emissions without the survey fatigue"
- **Proof:** Field workers photograph tickets → automatic OCR → no manual data entry
- **Differentiation:** Field-first workflow (photos of actual manifests, not surveys)
- **Price:** €2k–10k/year depending on facility count + supplier count
- **CTA:** "See field capture demo"

**Win Strategy:**
- Emphasize supplier ease-of-use (no emails, no portals, deep link activation)
- Show ROI: "Save X hours/month on data collection"
- Highlight audit readiness (append-only logs, calculation transparency)
- Leverage open-source (auditors can inspect code)

**Lose Against:** Watershed (bigger platform, better UX), Normative (simpler entry)

---

### Segment 3: Mid-Market: Finance + Audit (CSRD Compliance, Audit Readiness)

**Personas:** CFO, Finance Lead, Audit Manager, Compliance Officer
**Decision Driver:** Audit trail + calculation reproducibility + CSRD prep
**Incumbent:** Persefoni (gold standard), Emitwise (UK-focused)

**CarbonSite Positioning:**
- **Headline:** "Audit-ready emissions data, no consultant needed"
- **Proof:** Immutable audit logs, calculation formulas in plain code (GitHub), factor versioning
- **Differentiation:** Open-source transparency (code audit by external auditors), append-only logs, no retroactive edits
- **Price:** €5k–20k/year (1/10th of Persefoni)
- **CTA:** "Download audit architecture whitepaper"

**Win Strategy:**
- Undercut Persefoni on price (10x cheaper)
- Win on transparency (open-source code, visible formulas)
- Emphasize audit readiness (immutable logs, factor audit trail)
- Target CFOs who are cost-conscious + technical
- Prepare CSRD compliance playbook (EU-specific)

**Lose Against:** Persefoni (polish, brand, integrations), Emitwise (UK regulatory expertise)

---

### Segment 4: Enterprise: Multi-Facility, Multi-Facility Emissions + Scope 3

**Personas:** Chief Sustainability Officer, VP Operations, Enterprise Procurement
**Decision Driver:** Scalability + real-time dashboards + integrations + compliance
**Incumbent:** Persefoni, Watershed

**CarbonSite Positioning (Future):**
- **Headline:** "Industry-grade emissions accounting at startup economics"
- **Proof:** Handles 100k+ activity records, real-time dashboards, open-source audit trail
- **Differentiation:** Field worker capture at scale (retail chains, logistics networks), cost efficiency vs competitors
- **Price:** €20k–50k/year (10x less than Persefoni)
- **CTA:** "Request enterprise demo"

**Win Strategy:**
- Ship real-time dashboards (SSE) in Q2 2026 to compete on UX
- Add SSO/SAML in Q2 2026 to pass enterprise procurement gates
- Emphasize cost (100x smaller TCO than Persefoni over 5 years)
- Differentiate on field operations at scale (500+ field workers)
- Target CFOs + Sustainability teams at public companies with margin pressure

**Lose Against:** Persefoni (established, feature-rich), Watershed (brand, supply chain expertise)

---

## Pricing Strategy

| Segment | Tier | Price | Records/Month | Facilities | Suppliers | Roles | Features |
|---------|------|-------|---|---|---|---|---|
| **SMB** | Free | $0 | 100 | 1 | 5 | 2 (admin, viewer) | Dashboard, basic reporting |
| | Growth | $50 | 10k | Unlimited | Unlimited | 4 (admin, editor, reviewer, viewer) | + Scope 3 estimation, anomaly detection |
| **Mid-Market** | Professional | $500/mo | 100k | Unlimited | Unlimited | 6 (+ auditor, field_worker) | + API, webhook, advanced analytics |
| **Enterprise** | Custom | Bespoke | Unlimited | Unlimited | Unlimited | Custom | + SSO/SAML, real-time dashboards, SLA, dedicated support |

**Rationale:**
- Undercut Persefoni (€50k) by 100x on mid-market
- Match Normative on freemium (attract early users, upsell)
- Stay transparent (public pricing, no hidden fees)

---

## Product Roadmap Alignment with Competitive Positioning

### Q1 2026 (Current)
- Shipped: Field worker OCR, Scope 3 estimation, anomaly detection, audit logs, open-source
- **Positioning:** "Audit-ready + transparent" (SMB + mid-market audit focus)

### Q2 2026
- Ship: Real-time dashboards (SSE), SSO/SAML, API versioning
- **Positioning:** "Enterprise-ready" (compete on UX, auth, integrations)

### Q3 2026
- Ship: Advanced analytics (forecasting, scenario planning), supplier scorecards
- **Positioning:** "Intelligence platform" (upsell mid-market → enterprise)

### Q4 2026
- Ship: Integrated Scope 3 ML (predictive emissions), mobile app parity with web
- **Positioning:** "Predictive carbon intelligence" (thought leadership)

---

## Messaging by Competitive Set

### vs. Persefoni
- **Our advantage:** 100x cheaper, open-source audit trail, field worker capture
- **Their advantage:** Polish, brand, integrations, support
- **Our message:** "Enterprise-grade control at startup economics"
- **Our target:** CFOs at mid-market orgs tired of Persefoni pricing

### vs. Watershed
- **Our advantage:** Field-first workflow, transparency, lower cost
- **Their advantage:** Supply chain polish, real-time dashboards (for now), brand
- **Our message:** "Supply chain emissions from actual photos, not surveys"
- **Our target:** Procurement teams at manufacturing/logistics orgs

### vs. Normative
- **Our advantage:** Field worker mobile, audit trail, Scope 3 ML, open-source
- **Their advantage:** Simpler UX, larger brand
- **Our message:** "Normative for teams with field operations"
- **Our target:** Sustainability managers at companies with suppliers/contractors

### vs. Gaia
- **Our advantage:** Feature-rich, transparent, mobile, global
- **Their advantage:** EU regulatory focus
- **Our message:** "Gaia + field capture + open-source"
- **Our target:** EU mid-market orgs wanting more features

### vs. Greenly
- **Our advantage:** Audit-ready, Scope 3, field capture, open-source
- **Their advantage:** Simplicity, brand, D2C adoption
- **Our message:** "When you need more than simple carbon math"
- **Our target:** Businesses outgrowing Greenly, needs audit readiness

---

## Go-to-Market by Segment

| Segment | Channel | Message | Timeline |
|---------|---------|---------|----------|
| **SMB** | Organic (SEO, content), Product Hunt | "Free carbon accounting" | Ongoing |
| **Mid-Market** | Sales (LinkedIn, events), partnerships (consulting firms) | "Field capture + audit ready" | Q1-Q2 2026 |
| **Enterprise** | Enterprise sales, industry events (Climate + Finance), analyst coverage | "Industry-grade, startup cost" | Q2-Q4 2026 |

---

## Success Metrics

**Market Share (Year 1 Target):**
- SMB: 2% of addressable market (grow from 0)
- Mid-Market: 1% of addressable market (grow from 0)
- Enterprise: <0.1% of addressable market (entry point)

**Customer Acquisition:**
- SMB: 100+ free tier activations/month → 20+ paid conversions/month
- Mid-Market: 5+ qualified sales opportunities/month → 1–2 closes/month
- Enterprise: 2+ qualified opportunities/quarter → close 1+ in H2 2026

**Retention + NPS:**
- Target: >85% annual retention (mid-market + enterprise)
- Target: NPS >40 (industry benchmark 30–50)
