<!-- /founder:competitor-matrix · 2026-09-25 · input: Run the skill for our startup -->

# MetricOra competitor matrix

Assumption: MetricOra's prices are those in the code and on the pricing page today: Starter £99/mo (£990/yr), Growth £299/mo (£2,990/yr), Enterprise from £750/mo. This replaces the older £49/£149 figures in facts.md.
Assumption: target customers are UK SME construction and FM contractors, bought by sustainability and bid managers (facts.md).

## 1. Market landscape

Prices were checked on 25 September 2026 through search results. Competitor sites could not be opened directly from this environment.

| Competitor | Founded and funding | Pricing | Segment | Differentiator |
|---|---|---|---|---|
| [Qflow](https://qualisflow.com/) | Seed rounds of £2.4M, then a $9.1M (£7.2M) Series A led by Systemiq Capital in May 2023 ([TechCrunch](https://techcrunch.com/2023/05/30/qflow-raises-9-1m-to-track-construction-receipts-making-it-easier-to-de-carbonize)). £2M strategic investment from Autodesk on 2 Feb 2026 ([Autodesk](https://adsknews.autodesk.com/en/news/autodesk-invests-in-qflow/)) | Not found (sales-led) | Tier 1 and large contractors | Photographed delivery and waste tickets become field-verified materials, waste and carbon data |
| [Seedling](https://www.seedling.earth/) | Founded 2022 in Bath; $317K seed in April 2024 ([Tracxn](https://tracxn.com/d/companies/seedling/__0JIwifB0gYcaWjJ0lxWXvqzSnPC60mGprjGjz95DIwY)) | Not found. Its own guide says SMEs usually pay £3,000 to £15,000 a year ([Seedling](https://www.seedling.earth/post/carbon-accounting-software-pricing)) | UK SMEs | Software plus a dedicated carbon expert, output for SECR, PPN 006, B Corp, EcoVadis |
| [Compare Your Footprint](https://www.compareyourfootprint.com/) | Founded 2016, Edinburgh, no external funding, about 10 staff ([Tracxn](https://tracxn.com/d/companies/compareyourfootprint/__yjqUkPcRI5oXY90T8I_Haw8FC9N4YjGydV1JBOyP1Cw)) | From £1,999 + VAT/yr for an unquoted company with up to 3 UK sites ([Small99](https://small99.co.uk/partners/compare-your-footprint/)) | UK SMEs | Carbon footprint software with SECR and net zero consulting |
| [Sustainable Contractor](https://www.sustainablecontractor.co.uk/) | Not found | From £995/yr ([site](https://www.sustainablecontractor.co.uk/)) | UK contractors, SME | Scope 1-3 "in 30 minutes" with AI upload, PPN 006 plans and SECR, supply chain management |
| [EcoHedge](https://ecohedge.com/industries/construction) | Not found | Free Lite plan; paid Express plan, price Not found ([pricing](https://www.ecohedge.com/pricing)) | UK small businesses | Spend-based footprint from Xero, QuickBooks and Sage; PPN 006 reports |
| [Social Value Portal](https://www.socialvalueportal.com/) | £3M Series A (2020, Beringea), £8.5M Series B led by Mercia in April 2023 ([UKTN](https://www.uktechnews.info/2023/04/19/social-value-portal-secures-8-5-million-series-b-investment-led-by-mercia/)) | Free for bidders; winning suppliers pay a percentage of contract value ([help](https://www.socialvalueportal.com/help-and-support)) | Public buyers and their suppliers | Owner of the National TOMs framework and social value measurement |
| [Greenly](https://greenly.earth/) | Not checked this session | About $1,950/yr under 10 employees, else by quote ([G2](https://www.g2.com/products/greenly/pricing)) | SME to mid-market, EU-led | General carbon accounting with an action-plan focus |

## 2. Feature comparison

Sources as above. "Unknown" means search results did not confirm it either way.

| Feature | MetricOra | Qflow | Seedling | Compare Your Footprint | Sustainable Contractor | EcoHedge | Social Value Portal |
|---|---|---|---|---|---|---|---|
| Scope 1, 2 and 3 inventory | Building (live) | Partial (materials, waste) | Yes | Yes | Yes | Yes | No |
| Offline mobile capture of site paperwork | Building (live on Android) | Yes | No | No | Unknown | No | No |
| On-device reading of tickets and notes | Building (live) | Yes (AI, server side) | No | No | Partial (AI upload) | No | No |
| Review queue before data counts | Building (live) | Yes | Unknown | Unknown | Unknown | Unknown | No |
| PPN 006 Carbon Reduction Plan | Building (live) | Unknown | Yes | Unknown | Yes | Yes | No |
| SECR report | Building (live) | Unknown | Yes | Yes | Yes | Unknown | No |
| Social value (National TOMs) | Building (live, Growth) | No | No | No | Unknown | No | Yes |
| Embodied carbon and PAS 2080 per project | Building (live, Growth) | Partial (embodied from deliveries) | No | No | Unknown | Partial (materials) | No |
| Plant telematics and idling | Building (live) | No | No | No | No | No | No |
| Accounting sync (Xero, QuickBooks, Sage) | Building (live, Growth) | Unknown | Unknown | Yes | Unknown | Yes | No |
| Expert support included | No | Unknown | Yes | Yes (consulting) | Unknown | No | Yes |
| Published self-serve price | Yes | No | No | Partial | Yes | Partial | Yes (fee model) |

## 3. Positioning gaps

**Gap 1: one dataset for carbon and social value in tenders.** Contractors answer carbon in one tool, such as Seedling or Sustainable Contractor, and TOMs in Social Value Portal, which charges a percentage of contract value. No competitor found holds both against the same contracts.
- Why it matters: bid managers rewrite both answers for every tender, and evaluators compare the figures.
- Build difficulty: low for MetricOra, which already has both. Positioning work, not engineering.
- Head start: Estimate: 12 to 18 months. Carbon tools would need TOMs content and measures; Social Value Portal would need a full GHG engine.

**Gap 2: field evidence for SMEs.** Qflow owns ticket capture but sells to large contractors and publishes no price. SME tools (Seedling, EcoHedge, Compare Your Footprint) start from spend and invoices, not site paperwork.
- Why it matters: SME subcontractors increasingly need to supply Tier 1s with activity data, not spend estimates.
- Build difficulty: high (offline app, OCR, review flow). MetricOra has shipped it.
- Head start: Estimate: 18 to 24 months for an SME tool to build a mobile capture app; less if Qflow launches a cheaper tier.

**Gap 3: plant fuel and idling tied to the inventory.** No competitor found reconciles telematics with fuel records.
- Why it matters: plant diesel is the largest Scope 1 source for civils firms, and idling is the cheapest cut.
- Build difficulty: medium (ISO 15143-3 feeds, reconciliation).
- Head start: Estimate: 12 months.

## 4. Threat assessment

1. **Qflow: high.** Most funding in the niche (about £11.6M, plus Autodesk's £2M). Its field capture overlaps MetricOra's core, and it is backed by Autodesk Construction Cloud. It shipped a new strategic deal in February 2026 and is expanding to North America ([Autodesk](https://adsknews.autodesk.com/en/news/autodesk-invests-in-qflow/)). Release history was not found.
2. **Seedling: medium.** Small funding, but strong content ranking for PPN 006 and SME carbon searches, and a service model buyers trust. Low feature overlap on field capture.
3. **Sustainable Contractor: medium.** Same buyer and price point (from £995/yr against MetricOra Starter at £990/yr), PPN 006 and SECR in a simple product. Funding and release pace Not found.

Social Value Portal is low on carbon threat but controls the TOMs relationship with buyers.

## 5. Strategic recommendations

- **Position to own:** UK civils and FM contractors with £5M to £100M turnover that bid for public work. Promise "one evidence trail for the PPN 006 plan, SECR and TOMs in every tender, from paperwork your site teams already photograph".
- **Feature to ship first:** a single tender answer export that puts the Carbon Reduction Plan, social value delivered and project carbon for a named contract side by side. It turns Gap 1 into something a bid manager can see in a demo.
- **Competitor to watch:** Qflow. A cheaper self-serve tier for subcontractors, or supply-chain data requests from its Tier 1 customers down to SMEs, would put it directly in this niche.

[Win or loss notes from your first 10 sales conversations naming which of these tools buyers already use]
