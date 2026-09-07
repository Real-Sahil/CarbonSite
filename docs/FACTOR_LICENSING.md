# Emission Factor Library — Licensing Reference

MetricOra seeds its emission factor library from three sources. This document records the licensing terms that govern each, the attribution requirements, and outstanding items to resolve before redistribution or white-labelling.

---

## 1. DEFRA Greenhouse Gas Conversion Factors

**Source:** UK Department for Energy Security and Net Zero (DESNZ) / DEFRA  
**Dataset:** "Greenhouse gas reporting: conversion factors" (updated annually)  
**Current version seeded:** 2025 v1.0  
**Download URL:** https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting  

**Licence:** [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/)

The OGL v3.0 permits free use, adaptation, and redistribution (including commercial) subject to attribution. The required attribution statement:

> "Contains public sector information licensed under the Open Government Licence v3.0."

**Action required for production:** Include this attribution in any customer-facing report, PDF footer, or "About data sources" disclosure page. No further approval is needed from DEFRA.

**Redistribution:** Permitted. You may include DEFRA factor values in a SaaS product, a white-labelled platform, or a published report without seeking additional permission, provided the attribution is present.

---

## 2. US EPA GHG Emission Factors Hub

**Source:** United States Environmental Protection Agency  
**Dataset:** "Emission Factors for Greenhouse Gas Inventories" (updated periodically)  
**Current version seeded:** 2025 edition  
**Download URL:** https://www.epa.gov/climateleadership/ghg-emission-factors-hub  

**Licence:** US federal government works are in the public domain under 17 U.S.C. § 105. No copyright subsists in works prepared by an officer or employee of the United States government as part of that person's official duties.

**Action required for production:** No legal requirement, but attribution is standard practice and builds customer trust. Recommended footer line:

> "US EPA Emission Factors for Greenhouse Gas Inventories (2025)."

**Redistribution:** Unrestricted — public domain.

---

## 3. SustainMetrics Factor Library

**Source:** SustainMetrics (sustainmetrics.net)  
**Dataset:** SustainMetrics emission factors CSV  
**Current version seeded:** downloaded from https://sustainmetrics.net/factors (free download, no sign-up required at time of download)  

**Licence:** UNCONFIRMED — redistribution rights have not been independently verified.

**Risk:** SustainMetrics has not published a machine-readable licence alongside its factor CSV. "Free download, no sign-up" does not imply redistribution rights. Incorporating these factors in a commercial SaaS product (even indirectly, as seeded database rows) may require a licence agreement.

**Required actions before general availability / customer onboarding:**

1. Contact SustainMetrics (legal@sustainmetrics.net or via their website contact form) and ask:
   - What licence governs the factor CSV?
   - Is redistribution in a commercial application permitted?
   - Is attribution required?
2. Document the response (email or written confirmation) and store in this repo under `docs/licences/`.
3. If redistribution is not permitted, replace the SustainMetrics rows with DEFRA or EPA equivalents for the affected categories, or negotiate a commercial data licence.

**Current status:** The SustainMetrics rows are seeded in development and staging environments. They must not be included in a production deployment that redistributes them to customers until Step 1-2 above is complete.

---

## Summary Table

| Source | Licence | Attribution required | Redistribution permitted | Status |
|---|---|---|---|---|
| DEFRA 2025 | OGL v3.0 | Yes (standard text) | Yes | Ready |
| US EPA 2025 | Public domain (17 U.S.C. § 105) | Recommended, not required | Yes | Ready |
| SustainMetrics | Unconfirmed | Unknown | Unconfirmed | **Needs verification** |

---

## Methodology Version

The current GHG Protocol methodology version seeded in the platform is `ghg-protocol-v2026-01`. The GHG Protocol Corporate Standard is published by the World Resources Institute (WRI) and WBCSD under Creative Commons — use of the methodology's name and framework in a compliant tool does not require a licence from WRI. Only verbatim reproduction of the standard document itself would require permission.

GWP values used: AR6 (IPCC Sixth Assessment Report, 2021) — CH4 = 27.9, N2O = 273. These are IPCC data, which is publicly available without restriction.

---

*Last reviewed: 2026-09-07*
