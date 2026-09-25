<!-- /founder:competitor-matrix · 2026-09-25 · input: MetricOra competitive landscape brief (10 competitors, 8 moat pillars, "operational evidence to verified impact intelligence") -->

# MetricOra competitive landscape

Competitor feature lists come from the founder's brief unless a source is linked. Only Sustainable Contractor, TrackZero and PPN 026 were checked this session. Treat every unlinked competitor cell as "claimed in brief, not verified". Each MetricOra cell was checked against the code in this repository on 25 September 2026.

## 1. The regulatory change that reframes the market

**PPN 026: The Social Value Model** was published on 5 August 2026. It applies to central government procurements that start on or after **1 January 2027** with a value of **£1m or more including VAT** ([GOV.UK](https://www.gov.uk/government/publications/ppn-026-the-social-value-model/ppn-026-the-social-value-model-html), [Gowling WLG](https://gowlingwlg.com/en/insights-resources/articles/2026/ppn-026-and-the-new-social-value-model)).
- The model has two outcomes and six award criteria:
  - **Good Jobs:** high-quality jobs, fair working conditions, fair pay.
  - **Skills:** training and retraining, in-work progression, talent pipeline.
- **Carbon and environment are no longer part of central government social value** ([Stotles](https://www.stotles.com/resource/blog/ppn-026-explained-what-the-new-social-value-model-means-for-suppliers)).
- Weighting is at least 10% up to £5m and at least 20% at £5m and above ([Tussell](https://www.tussell.com/insights/the-central-govt-social-value-model-explained-ppn026)).
- PPN 026 sets no reporting metrics. Measurement goes into contract KPIs, with at least three social value KPIs on contracts of £5m or more ([Neighbourly](https://blog.neighbourly.com/ppn-026-initial-perspectives-on-the-new-social-value-model)).

What this means:
1. **Central government splits carbon from social value.** Carbon goes through PPN 006. Social value becomes jobs and skills. Local authorities, the NHS and housing associations still use National TOMs, so contractors will report both models at the same time. Nobody has one dataset that answers PPN 006, PPN 026 and TOMs from the same records.
2. **Social value becomes contract KPIs, not a bid-time number.** Delivered jobs, pay and training hours must be evidenced during the contract, so the demand moves from forecasting to evidence. That is MetricOra's ground, not the TOMs calculators'.
3. **The contract value threshold drops to £1m.** More SME contractors fall in scope, which is MetricOra's segment.

## 2. Benchmark

Key: **Y** yes, **P** partial, **N** no, **?** not known. MetricOra cells come from the code; others from the brief unless linked.

| Capability | MetricOra (code) | Sustainable Contractor | Sustainable Company | Impact Reporting | SV Consultancy | Flotilla | TrackZero | Ecologi | CareZero | Loop | Social Value Portal |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Scope 1, 2, 3 inventory | Y | Y [src](https://www.sustainablecontractor.co.uk/) | Y | P | Y | Y | Y [src](https://trackzero.eco/platform/) | Y | Y | N | N |
| PPN 006 CRP | Y (guided, readiness checks) | Y | Y | ? | Y | Y | Y [src](https://trackzero.eco/solutions/ppn0621/) | Y | Y | N | N |
| SECR | Y | Y | Y | ? | ? | ? | Y | ? | ? | N | N |
| PPN 026 Social Value Model | **N** | ? | ? | ? | ? | ? | ? | ? | ? | ? | Y (claims guidance) [src](https://www.socialvalueportal.com/news-and-insights/ppn-026-what-the-governments-new-social-value-guidance-means-for-you) |
| National TOMs | Y (Growth) | Y (TOMs v5) [src](https://www.sustainablecontractor.co.uk/) | Y | Y | Y | Y | N | N | Y | Y | Y (owner) |
| Offline mobile field capture | Y (Android live, iOS in review) | N | N | Y (mobile forms) | N | N | N | N | N | ? | N |
| On-device OCR, per-field confidence | Y (ML Kit, confidence dots) | N | N | N | N | N | N | N | N | N | N |
| AI invoice/bill extraction (server) | P (PDF parse, server OCR client; no invoice-to-record AI flow) | Y ("AI Smart Upload") [src](https://www.sustainablecontractor.co.uk/) | Y | ? | ? | ? | ? | ? | ? | ? | N |
| GPS and timestamp on evidence | Y | N | N | ? | N | N | N | N | N | ? | N |
| Meter readings from photos | Y (OCR pattern) | N | N | ? | N | N | N | N | N | N | N |
| Review queue before data counts | Y | ? | ? | ? | ? | ? | ? | ? | ? | ? | Y (validation) |
| Figure-to-source lineage | P (lineage page, calculation formula and factor per record, evidence status) | P (evidence library) | ? | Y (audit history) | ? | ? | Y ("audit-grade") | ? | ? | Y (evidence) | Y (validation) |
| Evidence quality tier | P (data origin, evidence status, pedigree score and CI per calculation; not one visible label) | N | N | ? | N | N | ? | ? | ? | ? | P |
| Supplier data requests / portal | Y (supplier data requests, supplier portal) | Y | P | Y | ? | Y | Y [src](https://trackzero.eco/supply-chain/) | Y | ? | ? | Y |
| Project and multi-site | Y (contracts, projects, facilities) | Y | Y | Y | ? | Y (portfolio) | Y | ? | ? | Y | Y |
| Embodied carbon / PAS 2080 / WLC | Y (delivery notes, PAS 2080) | N | P | N | Y (WLC) | N | P | N | N | N | N |
| Plant telematics and idling | Y | N | N | N | N | N | N | N | N | N | N |
| Combined carbon + SV tender pack | Y (bid carbon pack with TOMs per contract) | P | P | Y | ? | Y | N | N | Y | P | N |
| Report verification page (QR) | Y | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| Configurable framework engine | P (ESRS/framework datapoints, versioned factor libraries and methodology; no generic framework builder) | N | N | ? | ? | ? | ? | ? | ? | P (SV Model, Playbook) | P (TOMs versions) |
| BI / CRM integrations | P (Xero, QuickBooks, Sage, webhooks, API keys) | ? | ? | ? | Y (Power BI, CRM) | ? | ? | ? | ? | ? | ? |
| Economic impact | N | N | N | ? | ? | ? | N | N | N | P | P |
| ISO 14064-1 | P (GHG Protocol; ISO 14064-1 categories not reported) | Y [src](https://www.sustainablecontractor.co.uk/) | ? | N | ? | ? | ? | Y | ? | N | N |

## 3. Your eight moat pillars against the code

"Shipped" means it runs today. "Gap" means marketing must not claim it yet.

| # | Pillar | Shipped | Partial | Gap |
|---|---|---|---|---|
| 1 | Field-first capture | Camera, on-device OCR, waste tickets, delivery notes, fuel receipts, meter readings, GPS, timestamp, offline queue (drift) | Invoices: server-side PDF parse, not photo-to-record | iOS app not yet approved |
| 2 | Evidence intelligence | OCR field extraction (weight, EWC, date, reg, supplier) with per-field confidence; material matching on delivery notes; duplicate detection | Project/supplier identification relies on the user picking the project | Low-confidence items are not flagged in the web review queue |
| 3 | Unified impact engine | Carbon, waste, water, ecology, TOMs social value, H&S | ESG (ESRS/TCFD/TNFD pages exist but are separate modules) | Economic impact; PPN 026 jobs and skills |
| 4 | Evidence graph | Record to calculation to factor to snapshot to report, with formula and selection reason stored; lineage page; report checksums and QR verification | Source photo link is shown per record, not as one traversable graph | A single "click a report figure, see the tickets" view |
| 5 | Procurement intelligence | PPN 006 guided CRP, SECR, bid carbon pack, TOMs committed vs delivered | Client-specific frameworks | PPN 026 model and KPI tracking |
| 6 | Supply chain intelligence | Supplier data requests, supplier portal, subcontractor field workers | Supplier performance page | Supplier social value and compliance scoring in one view |
| 7 | Framework engine | Versioned factor libraries with effective dates, methodology versions, ESRS datapoints | Framework crosswalk | Generic configurable frameworks (evidence rules and reporting rules as data) |
| 8 | Evidence quality | Data origin (metered, invoiced, supplier-specific, calculated, estimated and more), evidence status (missing, partial, complete), pedigree score with confidence interval per calculation | Scattered across screens | One Verified / Partially verified / Estimated label on every figure, rolled up to reports |

**Honest read:** pillars 1, 4 and 8 are real and uncommon. Pillars 3, 5 and 7 are partly there. The biggest missing piece is PPN 026, which has a hard date: 1 January 2027.

## 4. Positioning

**Category line:** "Operational evidence to verified impact intelligence."

**Customer-facing line (plain words):** "Every carbon and social value figure in your bid, traced to the ticket, receipt or timesheet it came from."

**Against each group:**

| Group | Who | Their weak point | MetricOra line |
|---|---|---|---|
| SME carbon calculators | Sustainable Contractor, Sustainable Company, TrackZero, Ecologi | Start from invoices and spend; no field capture; carbon only or carbon plus TOMs log | "They calculate from invoices. We capture the evidence on site, then calculate." |
| Social value platforms | Social Value Portal, Loop, Impact Reporting, SV Consultancy | No GHG engine, or carbon as a side metric; bidder-side fees | "One dataset answers PPN 006, PPN 026 and TOMs." |
| Combined tender tools | Flotilla, CareZero | Tender output without site evidence underneath | "The same pack, with every number traceable to source." |

**Do not say:** "carbon calculator", "AI-powered" as the headline, "verified" for figures that are only estimated, or anything about PPN 026 until it is shipped.

## 5. Threats

1. **Social Value Portal: high.** It owns TOMs, is well funded, and is already publishing PPN 026 guidance. If it ships a PPN 026 KPI tracker before January, it keeps the social value half of every contractor.
2. **Sustainable Contractor: high in the SME segment.** Same buyer, published price from £995/yr, AI upload, TOMs v5, supply chain. Its gap is field evidence.
3. **Qflow (from the earlier matrix): medium to high.** It is the only other player with field-verified tickets, backed by Autodesk, but it sells to Tier 1s.
4. **TrackZero: medium.** Supply chain onboarding and consultant channel; weak on construction site data.

## 6. What to build next, in order

1. **PPN 026 Social Value Model (by December 2026).** Load its 2 outcomes and 6 criteria as a framework beside TOMs, with contract KPIs (at least 3 on £5m+ contracts). Capture jobs, pay and training evidence from the field app and timesheets. Add a PPN 026 section to the bid pack.
2. **One evidence quality label.** Derive Verified / Partially verified / Estimated from data origin, evidence status and review status. Show it on every record, dashboard total and report line, with the share of each tier. This turns pillar 8 into something a buyer can see.
3. **Figure-to-source view.** From any report or dashboard figure, open the records, calculations, factors and source photos behind it. The lineage data already exists; this is a view.
4. **Invoice photo to record.** Close the gap with "AI Smart Upload": photograph or upload a utility bill or fuel invoice, extract it into a draft record, and send it to the same review queue.
5. **Low-confidence flags in review.** Carry the app's per-field OCR confidence into the web review queue so reviewers check the weak fields first.

Items 2 and 3 cost least and make the positioning line true. Item 1 has the hard deadline.
