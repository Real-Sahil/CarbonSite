# Third-party sources: what we may use, and how

Checked on 3 October 2026 from the publishers' own pages and the files they distribute. Re-check before loading anything new. This is a working register, not legal advice.

| Source | Terms found | What we do |
|---|---|---|
| EFRAG VSME Digital Template 1.3.0 (Excel) | MIT licence, copyright 2025 EFRAG (the template's own Licence sheet). | May reuse structure, datapoint names and the fuel converter. Keep the MIT notice. Build after EFRAG's Q4 2026 update, which follows the Commission's Voluntary Standard of 3 July 2026. |
| EFRAG VSME XBRL taxonomy | EFRAG describes it as a "license-free, open format". | May use. |
| EFRAG Digital Template to XBRL Converter | MIT licence. | May use or integrate. |
| AIB European Residual Mixes 2025 (report and Excel) | "Any use of the data ... should include a reference to AIB." "The calculated country and energy source/technology emission factors ... may not be sold, distributed or processed as part of a derivative tool." | **Not loaded into the factor library.** MetricOra is a commercial tool. A customer enters their own residual mix and we link to AIB. Ask AIB for a licence before changing this. |
| VSME disclosure list (B1 to B11, C1 to C9) | Public EU Recommendation; EFRAG's template and converter are MIT. | Catalogue carries numbers, our own short titles and guidance only (`catalogue/vsme.ts`). |
| UK SRS S1 and S2 (GOV.UK PDF) | IFRS Foundation copyright. Reproduction is licensed only for the purposes the notice lists; anything else needs a licence from licences@ifrs.org. | Reference only: clause references, short titles and our own guidance, never the text. Same rule as ISO. |
| Abu Dhabi MRV Technical Guidance v8 (27 Feb 2026) | The cover is marked "Classification: Confidential". | Read for design only. Do not redistribute or quote. |
| Abu Dhabi EAD facility template (Deliverable C v8) | One facility, one calendar year, Scope 1 only; mandatory fields marked. No licence statement found. | Possible export format. Ask the Environment Agency about reuse before building. Needs facility permit numbers first. |
| UAE Federal Decree-Law 11/2024, Cabinet Resolution 67/2024 | Official legal texts. | Reference by article number with our own summary. |
| d3-sankey (npm, Mike Bostock) | ISC licence (permissive, commercial use allowed, keep the notice). Checked in `node_modules/d3-sankey/LICENSE`, 4 October 2026. | Used by the dashboard flow diagram (`components/charts/kit/sankey-chart.tsx`) for layout only; loaded in the client chart. |
| Defra / DESNZ, EPA, ADEME | OGL v3, US Government work, Licence Ouverte v2.0. | Loaded, with attribution (see CLAUDE.md). |

Rules for new sources: read the licence or terms first; a tool that redistributes data needs permission that covers commercial redistribution; text of standards is never copied.
