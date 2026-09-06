# Sub-Processor & Data Processing Agreement Inventory

**Organization:** MetricOra  
**Last Updated:** August 2026  
**Purpose:** GDPR Art. 28 compliance; transparency on third-party data processors

---

## Executive Summary

MetricOra uses seven primary sub-processors to deliver the platform. All maintain Data Processing Agreements (DPAs) or Standard Contractual Clauses (SCCs) as required by UK GDPR. This document lists each processor, confirms DPA status, and identifies any data residency constraints.

---

## 1. Core Infrastructure & Data Storage

### 1.1 Neon (PostgreSQL Database Hosting)

| Field | Value |
|-------|-------|
| **Service** | Managed PostgreSQL database |
| **Parent Company** | Neon (Autowaiter, Inc.) |
| **Data Hosted** | All customer data: activity records, users, audit logs, emission calculations, evidence metadata |
| **Data Residency** | UK / EEA regions (configurable; default: UK) |
| **Data Transfers** | No onward transfers; data remains in Neon infrastructure |
| **DPA Status** | ✅ Standard Data Processing Agreement in place |
| **SCC Status** | ✅ EU-UK SCCs included if transfers needed |
| **Backup Location** | Automated backups in UK/EEA (per Neon terms) |
| **Encryption** | Database encryption at rest (AES), TLS 1.3 in transit |
| **Compliance** | SOC 2 Type II, GDPR-ready |
| **Legal Contact** | legal@neon.tech |
| **DPA Link** | https://neon.tech/legal/dpa |
| **Audit Rights** | Included in Neon SLAs |
| **Termination** | 30-day notice; data deletion within 90 days |

---

### 1.2 Cloudflare R2 (Object Storage)

| Field | Value |
|-------|-------|
| **Service** | Object storage for evidence files (utility bills, photos, invoices) |
| **Parent Company** | Cloudflare, Inc. |
| **Data Hosted** | Uploaded evidence files (PDFs, images, documents) stored with checksums and metadata |
| **Data Residency** | Global CDN; files replicated across Cloudflare edge nodes (no single region guarantee) |
| **Data Transfers** | Content may cache in any Cloudflare edge location globally; no persistent transfer beyond CDN |
| **DPA Status** | ✅ Cloudflare Data Processing Addendum (DPA) executed |
| **SCC Status** | ✅ SCCs in place for global distribution |
| **Backup Location** | Automatic replication across Cloudflare global network |
| **Encryption** | AES-256 at rest, TLS 1.3 in transit, presigned URLs (15-min expiry) |
| **Compliance** | SOC 2 Type II, GDPR-ready, FedRAMP Authorized |
| **Legal Contact** | trust@cloudflare.com |
| **DPA Link** | https://www.cloudflare.com/legalcloud/dpa/ |
| **Audit Rights** | Available via Cloudflare compliance portal |
| **Termination** | 30-day notice; data deletion within 60 days |

---

### 1.3 Vercel (Hosting & Deployment)

| Field | Value |
|-------|-------|
| **Service** | Next.js application hosting, serverless edge functions, CDN |
| **Parent Company** | Vercel, Inc. |
| **Data Hosted** | Application code, session cookies (via Edge Runtime), static assets, build artifacts |
| **Data Residency** | US-based by default; regional deployment options available |
| **Data Transfers** | Application traffic cached globally; analytics sent to Vercel US servers |
| **DPA Status** | ✅ Vercel Data Processing Addendum (DPA) executed |
| **SCC Status** | ✅ SCCs cover US/global deployment |
| **Backup Location** | Distributed across Vercel's global infrastructure |
| **Encryption** | TLS 1.3 for all traffic; stored credentials encrypted |
| **Compliance** | SOC 2 Type II, GDPR-compliant |
| **Legal Contact** | trust@vercel.com |
| **DPA Link** | https://vercel.com/legal/dpa |
| **Audit Rights** | SOC 2 reports available; custom audits by request |
| **Termination** | Immediate; customer data removed within 30 days |

---

## 2. Communication & Email

### 2.1 Resend (Transactional Email)

| Field | Value |
|-------|-------|
| **Service** | Send transactional emails (invites, task assignments, import alerts, password resets) |
| **Parent Company** | Resend, Inc. |
| **Data Hosted** | Email address, subject, body (plain text only; no PII embedded in content) |
| **Data Residency** | US-based (with EU regional option at premium tier); default: US |
| **Data Transfers** | Email content may pass through Resend mail servers in US; no onward sharing |
| **DPA Status** | ✅ Data Processing Agreement in place |
| **SCC Status** | ✅ SCCs provided for US transfers |
| **Backup Location** | Resend mail logs retained 30 days; no long-term backup |
| **Encryption** | TLS 1.3 for submission and delivery, AES at rest |
| **Compliance** | SOC 2 Type II, GDPR-ready, HIPAA-eligible |
| **Legal Contact** | legal@resend.com |
| **DPA Link** | https://resend.com/legal/dpa |
| **Audit Rights** | SOC 2 attestation available |
| **Termination** | 14-day notice; email logs deleted after 30-day retention window |

---

## 3. Mobile & Notifications

### 3.1 Firebase Cloud Messaging (Google Cloud)

| Field | Value |
|-------|-------|
| **Service** | Push notifications for Flutter mobile app (task assignments, approvals, sync alerts) |
| **Parent Company** | Google Cloud (Google LLC) |
| **Data Hosted** | Device tokens, notification payloads (plain text; no PII) |
| **Data Residency** | US-based (Google Cloud); regional options available but not used by default |
| **Data Transfers** | Device tokens and payloads routed through Google FCM infrastructure globally |
| **DPA Status** | ✅ Google Cloud Data Processing Addendum (DPA) executed |
| **SCC Status** | ✅ SCCs cover international transfers |
| **Backup Location** | Google Cloud automated backups; token lifecycle: device token deleted on app uninstall |
| **Encryption** | TLS 1.3 for token submission/delivery; encrypted at rest (Google Cloud default) |
| **Compliance** | SOC 2 Type II, FedRAMP Authorized, GDPR-compliant |
| **Legal Contact** | legal@google.com |
| **DPA Link** | https://support.google.com/cloud/answer/10367380 |
| **Audit Rights** | Via Google Cloud security center; SOC 2 reports available |
| **Termination** | Immediate; tokens expire after 90 days of non-use; no persistent backup |

---

## 4. Monitoring & Observability

### 4.1 Sentry (Error Tracking & Observability)

| Field | Value |
|-------|-------|
| **Service** | Capture and log application errors, performance metrics, and server errors (optional; used for debugging) |
| **Parent Company** | Sentry.io, Inc. |
| **Data Hosted** | Error stack traces, request/response metadata, user context (anonymized email or ID if available) |
| **Data Residency** | US-based by default; EU region available (not currently in use) |
| **Data Transfers** | Error events sent from app servers to Sentry US endpoints; no onward sharing |
| **DPA Status** | ✅ Sentry Data Processing Agreement (DPA) executed |
| **SCC Status** | ✅ SCCs provided for US transfers |
| **Backup Location** | Sentry retains error data 30 days; no long-term backup |
| **Encryption** | TLS 1.3 for data submission; encrypted storage at Sentry |
| **Compliance** | SOC 2 Type II, GDPR-compliant |
| **Legal Contact** | legal@sentry.io |
| **DPA Link** | https://sentry.io/dpa/ |
| **Audit Rights** | SOC 2 Type II attestation available |
| **Termination** | 30-day notice; error logs deleted after 30-day retention |
| **Notes** | Sentry is **optional** and can be disabled for Edge Runtime (not initialized for middleware per security constraints). |

---

## 5. Public Data Services (No DPA Required)

### 5.1 postcodes.io (Postcode Geocoding)

| Field | Value |
|-------|-------|
| **Service** | UK postcode → latitude/longitude lookup (public API) |
| **Data Hosted** | Normalized postcode (query param); no PII stored by postcodes.io |
| **Data Residency** | UK-based |
| **DPA Status** | ❌ No DPA required (public, anonymized API; no personal data stored) |
| **Legal Contact** | admin@postcodes.io |
| **Privacy Policy** | https://postcodes.io/privacy |
| **Termination** | No contract; service provided as-is |
| **Notes** | No ongoing relationship or data retention at postcodes.io; only transactional postcode lookup |

---

### 5.2 OSRM (Open Route Service Map)

| Field | Value |
|-------|-------|
| **Service** | Route distance calculation (driving mode) between pickup/delivery coordinates |
| **Data Hosted** | GPS coordinates (lat/lng), no postcode or address lookup stored by OSRM |
| **Data Residency** | Germany-based (open-source community project) |
| **DPA Status** | ❌ No DPA required (public API, no personal data stored) |
| **Privacy** | OSRM does not store request metadata; see https://project-osrm.org |
| **Termination** | No contract; service provided as-is |
| **Notes** | OSRM route queries are transactional; no PII identifiable by lat/lng alone |

---

## 6. Sub-Processor Change Management

### 6.1 Notification & Approval Process

When adding or removing a sub-processor:

1. **Legal Review:** Assess DPA/SCC requirements and data transfer risks
2. **Technical Review:** Confirm encryption, access controls, audit logging
3. **Notification:** Email customers (per Art. 28(3)(e) GDPR) with 30-day opt-out window
4. **Documentation:** Update this inventory and RoPA
5. **Approval:** Record in audit log

### 6.2 Planned Sub-Processor Changes

| Processor | Status | Rationale |
|--|--|--|
| Planned: DocuSeal | On roadmap (post-MVP) | Digital signature for supplier declarations; will require DPA |
| Planned: Custom analytics (optional) | On roadmap | Internal dashboard; will require PECR consent banner and "soft opt-in" |

---

## 7. Data Residency Summary

| Data Category | Primary Location | Backup/CDN | Cross-Border SCC |
|--|--|--|--|
| Database (activity records, users, audit logs) | UK/EEA (Neon) | Automated EEA backup | None (in-region) |
| Evidence files | Global CDN (Cloudflare R2) | Global (Cloudflare nodes) | ✅ (SCCs in place) |
| Email delivery | US (Resend) | No backup | ✅ (SCCs in place) |
| Push notifications | US (Firebase) | Global (Google Cloud) | ✅ (SCCs in place) |
| Application hosting | US (Vercel) | Global CDN | ✅ (SCCs in place) |
| Error logs | US (Sentry, optional) | None | ✅ (SCCs in place) |
| Postcode lookups | UK (postcodes.io) | N/A | None |

---

## 8. DPA Compliance Checklist

- ✅ All sub-processors have executed DPAs or SCCs
- ✅ Customer data never shared with unrelated third parties
- ✅ Processors limited to technical processing (no secondary use)
- ✅ Encryption in transit and at rest for all processors
- ✅ No transfer of personal data outside scope of contract
- ✅ Subprocessor list reviewed annually
- ✅ Audit rights confirmed for each processor
- ✅ Data retention/deletion policies aligned with GDPR
- ✅ Incident notification procedures in place (72-hour ICO clock)

---

## 9. Contact & Escalation

- **DPA Questions:** privacy@metricora.io
- **Sub-Processor Issues:** Escalate via support@metricora.io → legal team
- **ICO Inquiry:** compliance@metricora.io (redirect to DPO/legal)
- **Audit Access:** Legal team coordinates SOC 2 / audit responses

---

## 10. Document Control

| Version | Date | Change |
|--|--|--|
| 1.0 | Aug 2026 | Initial RoPA/DPA inventory |
| — | — | — |

**Next Review:** August 2027  
**Approval:** [Compliance Lead Name]  
**Date Approved:** [To be filled]
