<!-- /founder:pricing-strategy · 2026-09-26 · input: use the pricing strategy for plan tier (place the management systems / IMS module in the tiers) -->

# MetricOra pricing strategy

Assumption: no paying customers yet, so nothing here rests on conversion data.
Assumption: buyers need SECR figures or a PPN 006 Carbon Reduction Plan to bid, and most construction SMEs also hold, or are being asked for, ISO 14001, ISO 45001 and ISO 9001 in pre-qualification (Constructionline, CHAS, the Common Assessment Standard).
Assumption: field workers never log in to the web app.

Prices are unchanged from 25 September 2026 (facts.md). This run places the new management systems module (16 frameworks plus shared registers) in the tiers. Competitor pages could not be opened from this environment; figures come from search results, so check each link before quoting it.

## 1. Pricing model analysis

| Model | Fit (1-5) | Pros | Cons |
|---|---|---|---|
| Flat per organisation, tiered by sites, web users and frameworks | 5 | One annual line item; matches how ISO tools sell (per system, not per seat) | Large orgs on low tiers; fixed by limits |
| Usage-based | 2 | Tracks cost | Bills spike in bid season |
| Per-seat | 2 | Simple | Punishes inviting field workers, the differentiator |
| Freemium | 2 | Top of funnel | A free footprint or free ISO 14001 removes the reason to pay |
| Credits | 1 | Flexible | Confusing for a compliance purchase |
| One-time | 1 | Easy yes for one bid | Footprint and certification recur every year |

Recommendation: keep the flat per-organisation model and add one new limit, the number of frameworks adopted at once. Because standalone ISO tools price per standard (Activ sells ISO 9001 and ISO 27001 as separate £149 and £299 monthly products), so buyers already think "one price per standard", and the registers cost us nothing extra per framework.

## 2. Tier design

30-day trial with Growth features and 3 frameworks. Annual discount on every tier: 2 months free (17%).

### Starter: £99/month or £990/year
- 3 sites, 5 web users, unlimited field workers
- Scope 1, 2 and 3; SECR and PPN 006 Carbon Reduction Plan
- 10 reports and 500 field submissions a month
- **1 management system framework** (in practice ISO 14001), with all registers: risks, interested parties, policies, audits, findings, corrective actions, management reviews
- Email support

Upgrade trigger: a second standard. A contractor with ISO 14001 is asked for ISO 45001 at the next PQQ, because the Common Assessment Standard checks health and safety first.

### Growth: £299/month or £2,990/year (target tier)
- 15 sites, 25 web users
- Social value, bid carbon pack, PAS 2080, accounting sync
- **5 frameworks**: ISO 9001, 14001 and 45001 as one integrated system, plus two more (UK GDPR, Cyber Essentials or ISO 27001)
- Priority support and an onboarding call

Upgrade trigger: more than 15 contracts, SSO, or a sixth framework (a group running SOC 2 or NIS2 for a client).

### Enterprise: from £750/month, billed annually, sales-led
- Unlimited sites, users and frameworks
- SSO, invoice anomaly detection, live dashboard, named contact

Why these numbers: three core ISO standards on Growth is the "integrated management system" certification bodies audit together; IAF MD 11 allows up to 20% less audit time for an integrated system ([IAF MD 11:2023](https://iaf.nu/iaf_system/uploads/documents/IAF_MD_11_Issue_3_12092023.pdf)), which is the sales line for putting all three in one tool. Five leaves room for the two most asked-for extras without giving away every security framework.

## 3. Competitive pricing context

| Competitor | Price found | Includes | Where MetricOra sits |
|---|---|---|---|
| Activ (UK) | ISO 9001 QMS £149/month; ISO 27001 ISMS £299/month ([Activ QMS](https://www.myactiv.co.uk/products/qms-quality-management-software/), [Activ ISMS](https://www.myactiv.co.uk/products/isms-information-security-management-software/)) | One standard per product | Growth gives five frameworks plus carbon for £299, the price of one Activ ISMS |
| Effivity | From $187/month Starter to $556/month Enterprise ([Capterra](https://www.capterra.com/p/149424/effivity/)) | ISO QHSE modules | Starter is below; Growth is between |
| Mango QHSE | From about $250 to $400/month, quote-led ([ITQlick](https://www.itqlick.com/mango-qhse/pricing)) | QHSE, offline app, training matrix | Similar price; Mango has more QHSE depth, no carbon |
| Vanta / Drata | Vanta from about $10,000/year; Drata median $25,000/year ([Comp AI](https://www.trycomp.ai/vanta-pricing), [soc2auditors.org](https://soc2auditors.org/insights/drata-pricing/)) | Security automation with integrations | Not a competitor for construction SMEs; shows why SOC 2 stays capped |
| Compare Your Footprint | From £1,999 + VAT/year, 3 UK sites ([Small99](https://small99.co.uk/partners/compare-your-footprint/)) | Carbon only | Starter is half the price with an ISO framework included |

Checked 26 September 2026.

## 4. Unit economics check

Estimates, not invoices. Frameworks add storage only: Estimate: under £0.50 per organisation a month (a few thousand status and evidence rows).
- Starter: (99 - 3.50 hosting - 1.69 card - 20 support) / 99 = 75%
- Growth: (299 - 5.50 - 4.69 - 70 support, one more hour for IMS questions) / 299 = 73%
- Enterprise: (750 - 15.50 - 0 - 240) / 750 = 66%

Break-even on Estimate: £400/month tooling: 6 Starter, 2 Growth or 1 Enterprise. Target blended ARPU £240/month (40/50/10 mix less annual discounts).

## 5. Pricing psychology

- Anchor: Enterprise first on the page, so Growth reads as the middle.
- Decoy: Starter's single framework. A firm holding ISO 14001 and ISO 45001 cannot run both on Starter, and moving to Growth also brings social value and the bid pack, so the jump feels like three upgrades for one.
- Annual framing: "£249/month, billed £2,990 yearly, 2 months free", next to "5 ISO and privacy frameworks included".

## 6. Launch pricing vs. scale pricing

- Launch (first 90 days, first 20 organisations): 40% off year one, annual only, for a case study.
- Grandfathering: founding customers keep year-one price for year two, then list with 60 days' notice. Organisations already over a new framework limit keep what they adopted; only new adoptions are blocked.
- Increases: Growth to £349 once 10 Growth customers renew; +10% on all tiers once a certification body accepts MetricOra exports at a stage 2 audit, or once 3 case studies show a won tender. Review every April with the DEFRA factor set.

## Changes made in the product

- `lib/billing/limits.ts`: `frameworks` limit (trial 3, Starter 1, Growth 5, Enterprise unlimited), enforced by `requireCapacity(orgId, "frameworks")` on adoption; withdrawn frameworks do not count; pilots exempt.
- Billing settings: a "Management system frameworks" meter.
- Pricing page: a framework line on each tier and an FAQ answer.
