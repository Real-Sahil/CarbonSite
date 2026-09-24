<!-- /founder:pricing-strategy · 2026-09-24 · input: MetricOra: UK carbon, social value and environmental accounting SaaS for SME construction and FM firms. Buyers: sustainability/bid managers. Plans in code today: trial, starter, growth, enterprise. Need GBP monthly and annual prices. -->

# MetricOra pricing strategy

Assumption: no paying customers yet, so nothing here is based on conversion data.
Assumption: most buyers need a footprint for SECR or a PPN 06/21 Carbon Reduction Plan to win public contracts, and many also answer social value (TOMs) questions in the same bids.
Assumption: field workers (subcontractors, drivers) are occasional users who never log in to the web app.

Competitor prices below come from web search results in this session. The vendors' own pages could not be opened from this environment, so check each link before you quote it to a customer.

## 1. Pricing model analysis

| Model | Fit (1-5) | Pros | Cons |
|---|---|---|---|
| Flat subscription per organisation, tiered by sites and users | 5 | Matches how buyers budget (one line item per year); easy to compare with Compare Your Footprint's per-company price | Large orgs on a low tier; fixed by limits below |
| Usage-based (per record or per report) | 2 | Tracks cost | Bills rise in bid season, exactly when buyers are most price-sensitive; hard to budget |
| Per-seat | 2 | Simple | Punishes inviting field workers and suppliers, which is the product's differentiator |
| Freemium | 2 | Top of funnel | A footprint done once for free removes the reason to pay; support cost with no revenue |
| Credits | 1 | Flexible | Confusing for a compliance purchase |
| One-time purchase | 1 | Easy yes for a single bid | No recurring revenue; the footprint must be redone every year |

Recommendation: flat annual-first subscription per organisation, tiered by sites (contracts/facilities) and web users, with field workers and supplier logins unlimited on every paid tier. Because a construction firm's cost driver is how many sites and contracts it reports on, not how many people upload tickets.

## 2. Tier design

The 30-day free trial stays. Annual discount on every tier: 2 months free (17%).

### Starter: £99/month, or £990/year
For a firm that needs its SECR numbers and a Carbon Reduction Plan for bids.
- 1 legal entity, up to 3 sites
- 5 web users; unlimited field workers (mobile app)
- Scope 1, 2 and 3 with DEFRA, EPA and ADEME factors, spend-based Scope 3 by SIC code
- 500 field submissions a month, 25 imports a month
- GHG Protocol, SECR and PPN 06/21 Carbon Reduction Plan reports (10 a month)
- Published snapshots with the auditor CSV trail
- Email support, 2 working day response

Upgrade trigger: a fourth site, social value reporting, or a bid that asks for a carbon pack.

### Growth: £299/month, or £2,990/year (target tier)
For a contractor bidding for public work every month.
- Up to 15 sites or contracts, 3 legal entities
- 25 web users; unlimited field workers and supplier portal logins
- Social value (TOMs) measurement and reporting
- Bid carbon pack, PAS 2080 carbon management, project carbon budgets and burn-down
- Xero, QuickBooks and Sage connectors
- 5,000 field submissions a month, 50 reports a month
- Priority email support, 1 working day response, and one onboarding call

Upgrade trigger: more than 15 live contracts, SSO asked for by IT, or a client needing assured figures.

### Enterprise: from £750/month, billed annually (£9,000/year), sales-led
- Unlimited sites, entities and users
- SSO (SAML/OIDC), API access, invoice anomaly detection, live dashboard
- Assurance-ready evidence packs and a named contact
- Invoiced by bank transfer; custom terms

Upgrade trigger: not applicable; renewals are priced on sites.

## 3. Competitive pricing context

| Competitor | Price found | Includes | Where MetricOra sits |
|---|---|---|---|
| Compare Your Footprint | From £1,999 + VAT per year for an unquoted company with up to 3 UK sites ([Small99 partner page](https://small99.co.uk/partners/compare-your-footprint/)); search results also cite a basic tier from £299/year | Carbon footprint for UK SMEs | Starter (£990/yr, 3 sites) sits below it; Growth (£2,990/yr, 15 sites plus social value) sits above it with 5 times the sites |
| Greenly | About $1,950/year for businesses under 10 employees; otherwise by quote ([Greenly pricing on G2](https://www.g2.com/products/greenly/pricing); [Nerdisa review](https://nerdisa.com/greenly)) | Carbon accounting, no construction field capture | Starter is below it for similar scope |
| Coolset | Search results cite €5,000 to €9,000 per year for a full-scope footprint ([Coolset pricing on G2](https://www.g2.com/products/coolset/pricing)) | Carbon accounting and CSRD | Growth is well below it |
| Sweep, Normative, Plan A | No published price; enterprise quotes ([Normative](https://normative.io/insight/the-5-best-carbon-accounting-software-platforms-2026/); [Seedling pricing guide](https://www.seedling.earth/post/carbon-accounting-software-pricing)) | Enterprise platforms | Enterprise tier competes on price and UK construction fit |
| Social Value Portal | Free for bidders; after award, an annual fee as a percentage of contract value, paid by the winning supplier ([Social Value Portal help](https://www.socialvalueportal.com/help-and-support)) | TOMs submissions and contract social value reporting | Growth bundles social value with carbon at a fixed price, with no percentage of contract value |

The general SMB range reported in these results is roughly $1,000 to $10,000 a year (Seedling), with the most transparent entry prices around €990 to €1,200 a year (Hedgehog, via search). Current code prices (£49 and £149) sit below the whole market's floor, which signals a toy to a buyer spending bid budget.

## 4. Unit economics check

All costs are estimates; none were confirmed against invoices.

Variable cost per organisation per month:
- Hosting, database, storage, email and PDF rendering: Estimate: £3 Starter, £5 Growth, £15 Enterprise (Supabase, Vercel and R2 usage at SME data volumes).
- Card fees: Estimate: 1.5% + 20p per payment for UK cards on Stripe (check your Stripe rate). Starter £1.69, Growth £4.69. Enterprise pays by bank transfer: £0.
- Support: Estimate at £40/hour: Starter 0.5 h = £20, Growth 1.5 h = £60, Enterprise 6 h = £240.

Gross margin:
- Starter: (99 - 3 - 1.69 - 20) / 99 = 75%
- Growth: (299 - 5 - 4.69 - 60) / 299 = 77%
- Enterprise: (750 - 15 - 0 - 240) / 750 = 66%

Break-even on fixed tooling: Estimate: £400/month (Vercel Pro, Supabase Pro, Sentry, domains, email). Gross profit per customer: Starter £74, Growth £229, Enterprise £495. So 6 Starter, or 2 Growth, or 1 Enterprise customer covers tooling. Founder time is not included.

Target blended ARPU: £240/month, from a mix of 40% Starter, 50% Growth, 10% Enterprise at list price: 0.4 x 99 + 0.5 x 299 + 0.1 x 750 = £264, less about 10% for annual discounts.

## 5. Pricing psychology

- Anchor: show Enterprise ("from £750/month") first on the pricing page, so Growth reads as the sensible middle, because buyers compare against the most expensive option they see.
- Decoy: Starter's 3-site cap and missing social value push any firm that bids for public work to Growth, which is the tier built to be picked.
- Annual framing: show the annual price as "£249/month, billed £2,990 yearly, 2 months free", because bid managers budget per year and a monthly figure makes the saving concrete.

## 6. Launch pricing vs. scale pricing

- Launch price (first 90 days, first 20 paying organisations): 40% off the first year on annual plans only (Starter £594, Growth £1,794), in exchange for a case study and a testimonial. Because early references matter more than early revenue in a trust-led compliance market, and annual-only keeps churn out of the early numbers.
- Grandfathering: founding customers keep their year-one price for their second year, then move to list price with 60 days' notice.
- Price increases, with specific triggers:
  - Raise Growth to £349/month once 10 Growth customers renew.
  - Raise all tiers 10% once an independent assurance partner accepts MetricOra evidence packs, or once 3 published case studies show a won tender.
  - Review every April, alongside the new DEFRA factor set.

## Changes this needs in the product

- `lib/billing/limits.ts`: PLAN_PRICES to Starter 99 / 82.50, Growth 299 / 249.17. Limits: Starter 5 members, 3 facilities; Growth 25 members, 15 facilities. Gate social value, bid carbon pack and PAS 2080 to Growth.
- Pricing page: the new prices and the annual framing.
- Stripe: 4 GBP prices: Starter £99 monthly and £990 yearly, Growth £299 monthly and £2,990 yearly.
