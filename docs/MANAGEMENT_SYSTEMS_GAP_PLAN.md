# Management systems: gap plan to an industry-standard IMS

Researched 26 September 2026 from published guidance, certification body notes and competitor listings. Standards themselves were not read (they are paid); where a change is described, the source is the certification body or committee page linked beside it. Check each against your own copy of the standard before building requirement text.

## Status (27 September 2026)

Built: items 1 to 9 below. ISO 14001:2026 and ISO 9001:2026 with the transition tool; reminders; document control with read and acknowledge; competence requirements, training records and the matrix; inspection checklists on the web and in the field app, and hazard and near-miss reports from the app; objectives, planned changes, complaints, nonconforming outputs, supplier evaluations and equipment; certification pack, Statement of Applicability, auditor links and the integrated view; pre-qualification answers for the Common Assessment Standard v5 and clients' own questionnaires.

Still open: ISO 45001's next edition (due 2027; watched), clause titles of the 2026 editions checked against a licensed copy, and automatic objective values from records.

## What we had before this plan

- 16 frameworks, edition-scoped slugs, shared requirements linked by `sharedKey`.
- Status per requirement, evidence links to the organisation's own records, readiness score.
- Shared registers: risks and opportunities, interested parties, policies (versioned approval), internal audits, findings, corrective actions (effectiveness required to close), management reviews.
- Organisation control of the guidance: own interpretation per requirement, competent-person review with a catalogue fingerprint.
- Around it, already in the product: legal register, environmental aspects, permits, environmental and H&S incidents (RIDDOR fields), method statements, suppliers, targets, evidence files, audit log, offline mobile capture, auditor role.

## Gaps, in the order to build them

### 1. New editions (must do: certificates move to them)

| Standard | Status | Source |
|---|---|---|
| ISO 14001:2026 | Published 15 April 2026; certificates to 2015 must transition by 30 April 2029 | [DNV](https://www.dnv.us/news/2026/ba_iso_14001_final_version/), [Amtivo](https://amtivo.com/uk/standards/iso-14001/technical/revisions/) |
| ISO 9001:2026 | Published 16 September 2026; about three years to transition; replaces 2015 plus Amd 1:2024 | [NSF](https://www.nsf.org/knowledge-library/iso-90012026-published-on-september-16-2026-what-quality-leaders-need-to-know), [LRQA](https://www.lrqa.com/en-ae/latest-news/iso-9001-revision-update-publication-date-confirmed/) |
| ISO 45001 | DIS ballot closed 9 August 2026; publication expected 2027 | [DQS](https://www.dqsglobal.com/en/about/newsroom/the-most-important-facts-about-the-revision-of-iso-45001-at-a-glance), [ISO/TC 283](https://committee.iso.org/sites/tc283/home/news/content-left-area/news-and-updates/news.html) |

Reported changes to reflect in our references and guidance:
- ISO 14001:2026: new 6.3 planning of changes; 8.1 widened from outsourced processes to externally provided processes, products and services with a life cycle perspective; life cycle noted in 6.1.2 aspects; 6.1.3 obligations "addressed through" the EMS ([CQI](https://www.quality.org/article/key-updates-iso-140012026), [Kaizen clause comparison](https://kaizenisoconsulting.com/articles/iso-14001-2026-clause-by-clause-comparison)).
- ISO 9001:2026: quality culture and ethical behaviour in 5.1.1, 7.3 and 7.1.4; 6.1 split into risks and opportunities (6.1.1 to 6.1.3); planning of changes reinforced; organisational knowledge ([TÜV SÜD](https://www.tuvsud.com/en-us/knowledge-hub/articles/iso-9001-everything-you-need-to-know-about-the-new-revision), [BSI](https://www.bsigroup.com/en-IE/products-and-services/standards-services/iso-9001-2026-key-changes-and-guidance/)).

Build:
- `iso-14001-2026` and `iso-9001-2026` catalogue files (references only, as now).
- A transition tool: adopt the new edition from the old one, carry statuses, interpretations and evidence across by clause mapping, and list what is new or changed to assess. Keep the 2015 adoption until the certificate moves.
- Watch ISO 45001 in the data upkeep workflow and add `iso-45001-2027` on publication.

What I need from you: a licensed copy of ISO 14001:2026 and ISO 9001:2026 (or a consultant's clause map) to confirm clause numbers and titles. Titles are short and factual, but must match.

### 2. Document control (every standard, clause 7.5)

Competitors all lead with it ([Mango](https://www.mangolive.com/software-qhse-compliance)). Policies cover part; procedures, forms and work instructions do not.
- A controlled document register: number, owner, version, approval, next review, status, file.
- Read and acknowledge: send a document to roles or people; record who confirmed and when.
- Superseded versions kept, read-only; the current one is the only one linked.

### 3. Competence and training (7.2, 7.3)

- Training matrix: requirements by role or site, each person's records with expiry (CSCS, SMSTS, first aid, asbestos awareness, toolbox talks), certificates as evidence.
- Toolbox talks and inductions logged from the mobile app with attendee sign-off.
- Expiry warnings through the existing notifications.

### 4. Reminders on every date we already store

Registers hold review dates, due dates and planned audits but nothing chases them. Add a daily monitor (pg_cron, like the others) that notifies owners before policy and risk reviews, corrective action due dates and planned audits, and flags overdue items on the overview.

### 5. Inspections and hazards from site (8.1, 9.1)

- Configurable inspection checklists (site, plant, housekeeping, spill kits), scheduled and completed offline in the app, a failed item raising a corrective action.
- Hazard and near-miss reporting from the app into the existing H&S incident flow; check how much the field submission link on `HsIncidentReport` already covers.

### 6. Objectives and KPIs (6.2, 9.1)

Targets are carbon only. Add management system objectives per framework (measure, target, owner, date) with values drawn from records where they exist (incident rates from H&S, waste diversion, complaints) and a trend line.

### 7. Quality-specific registers (ISO 9001)

Customer complaints and feedback (9.1.2), nonconforming outputs (8.7), supplier evaluation linked to the supplier module (8.4), calibrated equipment and plant inspections with due dates (7.1.5; plant register exists).

### 8. Certification support

- External auditor access: time-limited read-only link or account for a named certification body auditor, scoped to chosen frameworks, audit-logged. IAF MD 4 accepts remote audit by ICT when the risks are recorded ([IAF MD 4:2023](https://iaf.nu/iaf_system/uploads/documents/IAF_MD4_Issue_2_Version_4_14062023.pdf)).
- Certification pack (ZIP like the assurance pack): scope, requirement status with evidence index, legal compliance evaluation (ISO 14001 9.1.2), audit programme and findings, corrective actions, management review minutes, and for ISO 27001 a Statement of Applicability export.
- Integrated audit view: one audit plan covering 9001, 14001 and 45001 by shared clause. IAF MD 11 lets a certification body cut audit time by up to 20% for an integrated system ([IAF MD 11:2023](https://iaf.nu/iaf_system/uploads/documents/IAF_MD_11_Issue_3_12092023.pdf)), so this is worth showing.

### 9. Pre-qualification answers (UK construction)

Public construction pre-qualification uses the Common Assessment Standard (PPN 03/24 for works over the threshold; it replaced PAS 91), with health and safety core plus environmental, quality, equality, modern slavery and anti-bribery modules ([Build UK](https://builduk.org/information/common-assessment-standard/), [question set v5](https://builduk.org/wp-content/uploads/2025/07/Common-Assessment-Standard-Question-Set-Version-5.pdf), [Constructionline](https://www.constructionline.co.uk/insights/blog/demystifying-ppn-0324/)).
- Map each CAS question to the requirement statuses, registers and records that answer it, and produce a PQQ pack beside the bid carbon pack.
- What I need from you: which assessment scheme your customers use (Constructionline Gold, CHAS, SMAS, SafeContractor) so the mapping follows their evidence list first.

## Not planned

- Writing standard text or model procedures that copy ISO wording.
- Automated security evidence from cloud accounts (Vanta and Drata's model); construction SMEs rarely need it and it is a large build.
- NEN 7510 and the Saudi NCA controls, as before.

## Suggested order

1 (editions and transition) and 4 (reminders) first: small, and 1 is time-bound. Then 2 and 3, which every competitor has and every auditor asks for. Then 8 and 9, the differentiators that tie the module to what MetricOra already sells (evidence packs and bids). 5, 6 and 7 after.
