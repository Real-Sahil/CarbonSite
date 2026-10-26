# Question keywords and Search Console regex

Working list for the UK SECR, PPN 006 and contractor carbon reporting niche. Question queries are the ones people type when they are stuck on a rule, so each one should have a page that answers it in the first paragraph.

Nothing here is a measured search volume. Volumes need Search Console data for the live site, or a keyword tool. Until then, treat the order as a judgement from what the results pages for these questions show, not a forecast.

## Question clusters

"Post" means a page already exists in `content/blog/`. "Gap" means no page answers it directly yet.

### SECR

| Question | Status |
|---|---|
| What is SECR? | Post: `what-is-secr` |
| Who has to report under SECR? | Post: `who-has-to-report-under-secr` |
| What are the SECR thresholds (250 employees, £36m turnover, £18m balance sheet)? | Post: `who-has-to-report-under-secr` |
| Do small companies have to report under SECR? | Post: `who-has-to-report-under-secr` |
| Does a subsidiary have to report under SECR? | Covered in `who-has-to-report-under-secr`; own page is a gap |
| What is the 40,000 kWh SECR exemption? | Covered in `what-is-secr`; own page is a gap |
| Do I need to report home working emissions under SECR? | Post: `secr-home-working-emissions` |
| How do I report SECR emissions? | Post: `secr-reporting-guide-for-contractors` |
| SECR report template or example | Post: `secr-report-template-and-example` |
| SECR emissions intensity ratio: which one to pick? | Gap |
| SECR vs PPN 006: what is the difference? | Post: `secr-vs-ppn-006` |
| SECR software or calculator | Gap (product page, not a post) |
| What did the 2026 SECR post-implementation review find? | Gap, date-sensitive; cite the DESNZ review directly |
| Why have the SECR thresholds stopped matching the Companies Act limits? | Covered in `who-has-to-report-under-secr`; own page is a gap |

### PPN 006

| Question | Status |
|---|---|
| What is PPN 006? | Post: `what-is-ppn-006` |
| Who needs a carbon reduction plan for a government contract? | Post: `what-is-ppn-006` |
| What is the £5m threshold? | Post: `what-is-ppn-006` |
| What is the difference between PPN 06/21 and PPN 006? | Covered in `what-is-ppn-006`; own page is a gap |
| How do I write a carbon reduction plan? | Post: `ppn-006-carbon-reduction-plan-guide` |
| Carbon reduction plan template or example | Post: `ppn-006-carbon-reduction-plan-example` |
| Does a subcontractor need a carbon reduction plan? | Post: `do-subcontractors-need-a-carbon-reduction-plan` |
| Do I need a carbon reduction plan for an NHS contract? | Gap. Do not repeat competitor claims that the NHS asks for commitments at every value; check the current NHS wording first |

### Contractor carbon reporting

| Question | Status |
|---|---|
| What are Scope 1, 2 and 3 emissions for a contractor? | Post: `scope-1-2-3-emissions-for-contractors` |
| How do I calculate site fuel emissions? | Post: `how-to-calculate-site-fuel-emissions-construction` |
| How do I report subcontractor emissions? | Gap |
| What is PAS 2080? | Gap |

## Search Console regex

Search Console uses RE2. Matching is partial unless anchored with `^` and `$`, and case-insensitive unless the pattern starts with `(?-i)`. Lookahead, lookbehind and backreferences do not work. `\b` is ASCII-only. Use **Custom (regex)** under Queries, then "Matches regex" or "Doesn't match regex".

All patterns below were tested against sample queries before they were written down.

| Use | Pattern |
|---|---|
| All question queries | `^(who|what|when|where|why|how|which|can|could|does|do|did|is|are|am|should|will|would)\b` |
| How-to queries | `^how (to|do|can|does|should)\b` |
| Comparison queries | `\b(vs|versus|compared?|comparison|difference between|alternatives?)\b` |
| SECR queries | `\bsecr\b|streamlined energy (and|&) carbon` |
| PPN and carbon reduction plan queries | `\bppn ?0?(06|6|06/21|26)\b|carbon reduction plan|\bcrp\b` |
| Threshold and exemption queries | `\b(threshold|limit|exempt|exemption|40,?000|250 employees|36m|18m|turnover|small compan(y|ies)|subsidiar(y|ies))\b` |
| Template and tool queries | `\b(template|example|guide|checklist|form|software|tool|calculator|pdf)\b` |
| Scope 3 and homeworking queries | `\b(home ?working|working from home|wfh|commut(e|ing)|scope 3)\b` |

To list only the non-question queries, use the question pattern with **Doesn't match regex**. To get SECR questions only, filter by the question pattern, then add a second Query filter with the SECR pattern; Search Console applies both.

Applying a query filter drops anonymised queries from the totals, so the filtered clicks will be lower than the property total.

## How to use it

1. Run the question pattern over the last three months. Sort by impressions.
2. A question with impressions and a position beyond 10 needs a page that answers it in the first paragraph.
3. Cross-check against the gap lists above before writing, so a new post does not compete with an existing one.
4. Write a post for a question only when the answer can be sourced from legislation or official guidance. Link the source.

## Sources

- Google Search Console help, regular expressions in filters (RE2 syntax).
- DESNZ, post-implementation review of SECR, 2026.
- The Companies Act 2006 (Strategic Report and Directors' Report) Regulations 2013 and SI 2008/410 Schedule 7 for the SECR thresholds.
- Cabinet Office, PPN 006 on taking account of carbon reduction plans in the procurement of major government contracts.
