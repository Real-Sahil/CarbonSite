# Record of Processing Activities (Art. 30 GDPR)

**Organization:** CarbonSite  
**Last Updated:** August 2026  
**Prepared For:** Data Protection Officer / Regulatory Compliance Review

---

## 1. Controller Information

- **Legal Entity:** CarbonSite Ltd.
- **Registered Address:** [To be filled by legal/compliance team]
- **Contact:** privacy@carbonsite.io
- **Data Protection Officer:** [To be filled if appointed]

---

## 2. Processing Activities

### 2.1 User Authentication & Account Management

| Field | Details |
|-------|---------|
| **Processing Activity** | Collect and store user credentials, email, name, 2FA setup |
| **Lawful Basis** | Contract (providing service), Legitimate Interest (security) |
| **Data Categories** | Email, password hash, name, IP address, device tokens |
| **Scope & Scale** | All platform users (employees, field workers, suppliers, auditors) |
| **Purposes** | Authentication, session management, security, audit trail |
| **Recipients** | Internal: app servers, audit logs. External: Sentry (errors only) |
| **Retention** | User accounts: active + 2 years after deletion. Sessions: 7 days. Audit logs: 5 years |
| **Data Subject Rights** | Access, rectification, erasure (subject to legal hold), portability, object |
| **Security Measures** | TLS 1.3+, bcrypt password hashing, CSRF protection, tamper-evident audit log |
| **Cross-Border Transfers** | No user credentials transferred outside UK/EEA. Session management in-region. |

---

### 2.2 Emissions Data (Activity Records)

| Field | Details |
|-------|---------|
| **Processing Activity** | Collect, store, calculate, and report on GHG emissions activity data |
| **Lawful Basis** | Contract (core service), Legal Obligation (CSRD/reporting), Legitimate Interest (calculation accuracy) |
| **Data Categories** | Quantities, units, dates, supplier names, facility IDs, source descriptions, biogenic CO2e flags |
| **Scope & Scale** | 100k–1M records per organization per year (variable per contract) |
| **Purposes** | Calculate CO2e, generate dashboards, produce reports, support CSRD/TCFD filing |
| **Recipients** | Internal: calculation engine, reporting, auditor portal. External: Sentry (errors). Sub-processors: Neon (DB), Vercel (hosting) |
| **Retention** | 7 years post-calculation (per GHG Protocol & UK tax requirements) |
| **Data Subject Rights** | Access (via data lineage UI), rectification (edit records), erasure (anonymize after retention), portability |
| **Security Measures** | Role-based access control (RBAC), organization-scoped queries, encrypted storage, audit trail |
| **Cross-Border Transfers** | Database hosted in EEA (Neon, UK region). Backup/CDN via Vercel (global, SCCs). |

---

### 2.3 Location Data (GPS & Postcodes)

| Field | Details |
|-------|---------|
| **Processing Activity** | Capture, geocode, and encrypt UK postcodes and GPS coordinates from field submissions and manual entries |
| **Lawful Basis** | Contract (route distance calculation), Legitimate Interest (data quality), Legal Obligation (GDPR compliance) |
| **Data Categories** | Pickup postcode, delivery postcode, GPS latitude/longitude (for field submissions) |
| **Scope & Scale** | Per activity record; ~50% of waste/logistics records expected to have postcodes |
| **Purposes** | Calculate route distance, validate postcode format, encrypt for at-rest protection, support field worker assignment |
| **Recipients** | Internal: calculation engine, field submission review, auditor portal. External: postcodes.io (public postcode lookup), OSRM (route calculation) |
| **Retention** | Encrypted storage retained with activity record (7 years); plaintext postcode lookup normalized, encrypted after creation |
| **Data Subject Rights** | Access (via lineage view), erasure (anonymize postcode after retention) |
| **Security Measures** | AES-256-GCM encryption, plaintext fields kept for SQL uniqueness constraints, graceful degradation if encryption unavailable |
| **Cross-Border Transfers** | postcodes.io queries: UK-based, no transfer. OSRM: Germany-based (SCCs applied). |

---

### 2.4 Evidence Files (Utility Bills, Invoices, Photographs)

| Field | Details |
|-------|---------|
| **Processing Activity** | Accept file uploads, store, scan for OCR (field submissions), link to activity records |
| **Lawful Basis** | Contract (supporting documentation), Legal Obligation (audit trail) |
| **Data Categories** | File content (PDF, image, DOCX), filename, mime type, byte size, checksum |
| **Scope & Scale** | Thousands of files per organization per year; can contain PII (supplier addresses, invoice numbers) |
| **Purposes** | Provide audit trail, support OCR extraction for field forms, enable auditor review, evidence preservation |
| **Recipients** | Internal: organization members (RBAC), auditors, platform support. External: Cloudflare R2 (object storage), Sentry (errors) |
| **Retention** | Retained with linked activity record (7 years) |
| **Data Subject Rights** | Access (download via presigned URL), erasure (delete file if no longer needed) |
| **Security Measures** | Encrypted in transit (TLS 1.3+), encrypted at rest (R2 default), presigned URLs (15 min expiry), access logs |
| **Cross-Border Transfers** | Stored in Cloudflare R2 (global CDN, zero egress, SCCs); not persistently transferred. |

---

### 2.5 Audit Logs

| Field | Details |
|-------|---------|
| **Processing Activity** | Log all user actions: authentication, data mutations, role changes, exports, imports, snapshot publication |
| **Lawful Basis** | Legal Obligation (UK GDPR Art. 33, breach notification, regulatory compliance), Contract (service reliability) |
| **Data Categories** | Actor user ID, action, resource type/ID, timestamp, IP address, user agent, metadata (affected fields, counts) |
| **Scope & Scale** | 100–1000 entries per organization per day |
| **Purposes** | Regulatory compliance (DSAR, breach investigation), security monitoring, incident response, data integrity verification |
| **Recipients** | Internal: admins, compliance team, incident response. External: Sentry (errors). UK ICO (upon breach notification). |
| **Retention** | 5 years; after 5 years, actor user ID anonymized (retain action/resource for audit trail) |
| **Data Subject Rights** | Access (DSAR fulfillment), erasure (anonymization after retention, not deletion) |
| **Security Measures** | Append-only table (never update), tamper-evident SHA-256 hash chaining, IP + user agent capture |
| **Cross-Border Transfers** | None (audit logs retained in-region). |

---

### 2.6 Data Subject Requests (DSAR) Processing

| Field | Details |
|-------|---------|
| **Processing Activity** | Receive, validate, and fulfill GDPR Art. 15 (access) and Art. 17 (erasure) requests |
| **Lawful Basis** | Legal Obligation (UK GDPR Art. 12–14, 15–17) |
| **Data Categories** | DSAR request metadata (requestor, date, status), exported datasets (all personal data per registry), erasure records |
| **Scope & Scale** | Estimated 1–10 per organization per year |
| **Purposes** | Fulfill legal data subject rights, maintain compliance audit trail |
| **Recipients** | Data subject only (presigned URL, 15 min expiry); internal: legal/compliance team for validation |
| **Retention** | DSAR request record: 3 years (for audit); fulfillment ZIP file: 90 days (until confirmed received by subject) |
| **Data Subject Rights** | Art. 15 (DSAR itself), Art. 16 (request correction), Art. 20 (portability via ZIP) |
| **Security Measures** | Presigned URLs (time-limited), encrypted ZIP contents, email delivery via Resend (TLS), validation via email challenge |
| **Cross-Border Transfers** | None (export file generated in-region, transmitted directly to requestor). |

---

### 2.7 Push Notifications (Firebase Cloud Messaging)

| Field | Details |
|-------|---------|
| **Processing Activity** | Collect device tokens from Flutter mobile app; send push notifications for task assignments, approvals, import alerts |
| **Lawful Basis** | Contract (mobile app feature), Legitimate Interest (user engagement) |
| **Data Categories** | Device token, notification content (plain text only; no PII embedded) |
| **Scope & Scale** | Field workers and org members who enable notifications; ~10–100 tokens per organization |
| **Purposes** | Notify users of work assignments, review tasks, import completion |
| **Recipients** | External: Firebase Cloud Messaging (Google). Notification content logged in app (Sentry). |
| **Retention** | Device token: kept while app installed; deleted on uninstall. Notification history: 30 days |
| **Data Subject Rights** | Can disable notifications in app settings; revokes token from FCM |
| **Security Measures** | FCM encryption in transit; device tokens scoped per app instance; no persistent user ID stored with token |
| **Cross-Border Transfers** | Device tokens sent to Google (Firebase, US-based); SCCs in place. |

---

### 2.8 Supplier Portal & Supplier Data Requests

| Field | Details |
|-------|---------|
| **Processing Activity** | Invite suppliers, collect Scope 3 emissions data via portal (PACT/PCF format), store supplier invites |
| **Lawful Basis** | Contract (Scope 3 data collection), Legitimate Interest (supply chain transparency) |
| **Data Categories** | Supplier email, company name, business unit, submitted EPD/PCF records, timestamps |
| **Scope & Scale** | 10–100 suppliers per organization per year |
| **Purposes** | Collect upstream/downstream Scope 3 emissions, build supplier emission factors |
| **Recipients** | Supplier portal users (email link), organization managers; external: Resend (email delivery) |
| **Retention** | Supplier invites: 30 days from creation (or until used). Submitted data: 7 years (per activity record retention) |
| **Data Subject Rights** | Suppliers can request their data be deleted (email to privacy@carbonsite.io) |
| **Security Measures** | Invite tokens (unique, single-use), presigned upload URLs, TLS, audit trail of submissions |
| **Cross-Border Transfers** | Supplier can be anywhere globally; data retained in UK/EEA unless supplier is outside EEA (then SCCs). |

---

### 2.9 Calculation Engine & Methodology

| Field | Details |
|-------|---------|
| **Processing Activity** | Apply emission factors and formulas to activity records; store immutable calculation results and data quality scores |
| **Lawful Basis** | Contract (core service), Legitimate Interest (calculation accuracy) |
| **Data Categories** | Calculation ID, factor ID, formula, normalized units, CO2e results, confidence intervals, data quality score |
| **Scope & Scale** | 1 calculation per activity record; 100k–1M per year per organization |
| **Purposes** | Compute GHG totals, track uncertainty, support audit trail, enable scenario modeling |
| **Recipients** | Internal: dashboard, reports, auditor portal, lineage UI. External: none. |
| **Retention** | 7 years (tied to activity record) |
| **Data Subject Rights** | Access (via lineage UI showing formula and inputs), not directly erasable (anonymize source record instead) |
| **Security Measures** | Calculations immutable (never updated), stored separately for integrity; linked to audit trail |
| **Cross-Border Transfers** | None (calculations remain in-region). |

---

### 2.10 Snapshots & Reports

| Field | Details |
|-------|---------|
| **Processing Activity** | Create published snapshots of calculation runs; generate PDF/CSV reports for download |
| **Lawful Basis** | Contract (reporting), Legal Obligation (CSRD/TCFD/CDP filing) |
| **Data Categories** | Snapshot metadata (period, publish date, user), report totals, drill-down data (aggregated at scope/category level) |
| **Scope & Scale** | ~1–12 snapshots per reporting period; 1–100 reports per snapshot |
| **Purposes** | Create immutable calculation state for audit, publish for external disclosure, archive for compliance |
| **Recipients** | Organization members, external auditors, regulators (on request), public if published |
| **Retention** | Snapshots: 7+ years (often permanently for audit trail). Reports: as long as snapshot retained |
| **Data Subject Rights** | Access (download report), portability (CSV export) |
| **Security Measures** | Snapshot immutable after publication, report PDF checksummed, presigned download URLs, audit trail |
| **Cross-Border Transfers** | Reports may be shared externally (e.g., with regulators); no additional transfer restrictions. |

---

## 3. Data Subject Categories & Lawful Bases Summary

| Data Subject Category | Scope | Lawful Basis | Retention |
|--|--|--|--|
| Platform Users (employees, admins, auditors, field workers) | ~10–1000 per organization | Contract, Legitimate Interest (security) | Account active + 2 years; audit 5 years |
| Suppliers (Scope 3) | ~10–100 per organization | Contract, Legitimate Interest | Invite: 30 days; data: 7 years |
| External Auditors | Ad-hoc access to snapshots/reports | Contract, Legitimate Interest (audit) | Same as reports (7+ years) |
| Regulatory Bodies (UK ICO, Ofgem, etc.) | Data breach notifications, DSAR compliance | Legal Obligation | As required by law (typically 3–10 years) |

---

## 4. Sub-Processors & Data Transfers

| Processor | Location | Purpose | DPA/SCC | Retention |
|--|--|--|--|--|
| Neon (PostgreSQL) | UK/EEA | Database hosting | DPA ✓ | 7 years |
| Cloudflare R2 | Global CDN | Evidence file storage | DPA ✓ | 7 years |
| Resend | US (with EU option) | Email delivery | DPA ✓ (SCC if US) | 30 days |
| Firebase Cloud Messaging (Google) | US-based | Push notifications | DPA ✓ (SCC) | Token: until uninstall |
| Vercel | Global | Hosting & CDN | DPA ✓ (SCC) | As per backup policy |
| postcodes.io | UK | Postcode geocoding | No DPA (public API) | N/A |
| OSRM | Germany | Route calculations | No DPA (public API) | N/A |
| Sentry | US | Error tracking | DPA ✓ (SCC, optional) | 30 days |

---

## 5. Security & Privacy by Design

- **Encryption in Transit:** TLS 1.3+ for all data flows
- **Encryption at Rest:** Database encryption (Neon), application-level AES-256-GCM for postcodes/GPS
- **Access Control:** Role-based access control (RBAC), org-scoped queries, field-level permissions
- **Audit Trail:** Tamper-evident SHA-256 hash-chained audit log with IP/user agent capture
- **Retention:** Automated anonymization after retention windows (user IDs, GPS data)
- **Incident Response:** 72-hour ICO breach notification, incident runbook in SECURITY.md

---

## 6. Data Subject Rights Process

| Right | Process | SLA |
|--|--|--|
| **Access (Art. 15)** | DSAR endpoint triggers ZIP export of all linked data; presigned URL emailed | 30 days |
| **Rectification (Art. 16)** | Users edit own profile; org admins edit activity records in-app | Real-time |
| **Erasure (Art. 17)** | Trigger erasure job; anonymize user ID in audit, delete session, anonymize PII in activity records | 30 days |
| **Portability (Art. 20)** | Included in DSAR ZIP (CSV files, JSON exports) | 30 days |
| **Object (Art. 21)** | Opt-out of optional notifications/analytics; case-by-case for legitimate interest balancing | Case-by-case |
| **Restrict (Art. 18)** | Suspend processing; contact compliance for manual hold | 30 days |

---

## 7. DPA & Data Protection Officer

- **Data Controller:** CarbonSite Ltd. (org level)
- **Data Processor:** [Sub-processors listed above]
- **DPO:** [Appoint or clarify if role delegated to legal team]
- **Contact:** privacy@carbonsite.io
- **Escalation (Regulator):** UK Information Commissioner's Office (ICO), ico.org.uk

---

## 8. Regulatory Compliance Mapping

- **UK GDPR:** Art. 13, 14, 15, 16, 17, 18, 20, 21, 30, 32, 33, 34 ✓
- **DPA 2018:** Part 2 (general processing), Part 3 (law enforcement) ✓
- **PECR:** Soft opt-in for marketing emails, consent for non-essential cookies ✓
- **CSRD / ESRS:** Art. 8 (data protection integral to GHG reporting) ✓
- **Cyber Essentials:** Security practices in Art. 32 (encryption, RBAC, audit) ✓

---

## 9. Review & Audit Cycle

- **Annual Review:** Align this RoPA with code changes, new data categories, sub-processor changes
- **Incident Review:** Update following breach or DPA request
- **Legal Review:** Engage external counsel for significant processing changes (new countries, new data types)
- **Version Control:** Track changes in this document; date and sign off on each update

---

**Document signed off by:**
- Role: [Legal/Compliance Lead]
- Date: [To be filled]
- Next Review: August 2027
