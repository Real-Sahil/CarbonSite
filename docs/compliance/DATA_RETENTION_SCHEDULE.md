# Data Retention Schedule

**Organization:** MetricOra  
**Last Updated:** August 2026  
**Purpose:** GDPR Art. 5(1)(e) compliance; defines retention windows for all data categories

---

## Overview

MetricOra retains personal data only for as long as necessary to provide the service and meet legal obligations. This schedule outlines retention periods, deletion methods, and responsible teams.

---

## 1. Core Emissions Data (7 Years)

| Data Type | Retention Period | Legal Basis | Deletion Method | Notes |
|--|--|--|--|--|
| **Activity Records** | 7 years post-calculation | UK tax (Companies House), GHG Protocol best practice | Anonymize fields (remove amounts, units, supplier names); retain anonymized record | Standard retention aligns with UK financial record-keeping requirements |
| **Emission Calculations** | 7 years | Same as Activity Records | Immutable records never deleted; only source record anonymization | Calculations remain tied to source for audit trail |
| **Evidence Files (Utility Bills, Invoices, Receipts)** | 7 years | Same as Activity Records | Delete file from R2 after 7 years; retain metadata link | Presigned URLs naturally expire after 15 min; R2 deletion is permanent |
| **Dashboard Aggregates** | 7 years | Same as Activity Records | Recalculated after source record anonymization | Aggregates are read-only snapshots of snapshots; no separate deletion needed |

---

## 2. Authentication & Access Control (7 Days / 2 Years)

| Data Type | Retention Period | Legal Basis | Deletion Method | Notes |
|--|--|--|--|--|
| **Session Tokens** | 7 days (web) / per-app policy (mobile JWT) | Contract (service delivery) | Auto-expire from Postgres; purge on deletion | Stale sessions automatically cleaned via scheduler |
| **User Accounts (Active)** | Indefinite (while org member) | Contract | N/A (account owned by user) | Users manage own account lifecycle |
| **User Accounts (Deleted)** | 2 years post-deletion | Legitimate Interest (fraud prevention, legal hold) | Soft-delete (mark `deleted_at`); anonymize after 2 years | Allows account recovery within 30 days if requested |
| **Password Hashes** | Indefinite while account active; deleted with account | Contract, Legitimate Interest | Overwritten on password change (bcrypt does not support versioning) | Never sent to external systems (only hashed comparison) |
| **Two-Factor Secret (2FA Backup Codes)** | Same as account | Contract | Deleted with account or when user regenerates | Stored encrypted; backup codes are single-use |

---

## 3. Audit Logs (5 Years)

| Data Type | Retention Period | Anonymization Policy | Deletion Method | Notes |
|--|--|--|--|--|
| **Audit Log Entries** | 5 years | After 5 years: anonymize `actor_user_id` (hash instead of UUID) | Scheduled job: replace user ID with hash after 5 years | Preserves action type, resource ID, timestamp for regulatory compliance |
| **Full Audit Entry (with User ID)** | 5 years | Within 5 years: retain for incident response | Automatic purge at 5-year mark via Postgres trigger/scheduler | User-identifiable for 5 years per UK GDPR Art. 33 (breach clock) |
| **IP Address & User Agent** | 5 years | Same as Audit Log | Deleted with anonymization; kept for DSAR/breach investigation | Essential for security incident reconstruction |

---

## 4. Location Data (GPS / Postcodes) (7 Years)

| Data Type | Retention Period | Encryption Status | Deletion Method | Notes |
|--|--|--|--|--|
| **Plaintext Postcodes** | At creation only; immediately encrypted | Encrypted after initial geocoding | Removed after encryption; retained encrypted only | Unique constraint on plaintext postcode, but stored as encrypted JSONB after creation |
| **Encrypted Postcodes** | 7 years (tied to activity record) | AES-256-GCM | Deleted with anonymization of activity record | Cannot decrypt without encryption key; key rotation per infosec policy |
| **GPS Coordinates (Field Submission)** | 7 years | No encryption (optional per user consent) | Deleted with anonymization of field submission | Optional field; users can decline GPS capture |

---

## 5. Field Submissions (7 Years / On-Demand Deletion)

| Data Type | Retention Period | Status Lifecycle | Deletion Method | Notes |
|--|--|--|--|--|
| **Field Submission (Approved)** | 7 years (becomes Activity Record) | pending → submitted → under_review → approved → archived | Convert to Activity Record; follow Activity Record retention | Once approved, submission data folds into activity record |
| **Field Submission (Rejected)** | 90 days | pending → submitted → rejected | Delete entire submission + linked files after 90 days | Rejected submissions not needed for audit trail; allows for resubmission |
| **Field Submission (Pending)** | 30 days | pending → stale | Auto-delete after 30 days without status change | Incentivizes field workers to follow up; reduces clutter |
| **OCR-Extracted Text** | Same as submission | Stored in `ocr_extracted_data` JSONB field | Deleted with submission or anonymized with field submission | Used for form pre-fill; not separately retained |

---

## 6. Device Tokens & Push Notifications (Until Uninstall / 30 Days)

| Data Type | Retention Period | Deletion Trigger | Deletion Method | Notes |
|--|--|--|--|--|
| **Firebase Device Token** | Until app uninstall (then FCM auto-expires after 90 days) | User uninstalls app; or 90 days of non-use | FCM auto-purge; manual purge if needed | Token lifecycle managed by Firebase; no PII in token |
| **Notification History** | 30 days | Auto-purge via scheduler | Delete log entries after 30 days | Allows troubleshooting recent delivery issues; then purged |
| **Notification Content** | 30 days | Same as history | Plain-text content stored in notification log; deleted with history | No PII embedded (only plain text subject + minimal body) |

---

## 7. Email Delivery & Communication (30 Days)

| Data Type | Retention Period | Deletion Responsibility | Deletion Method | Notes |
|--|--|--|--|--|
| **Email Send Logs (Resend)** | 30 days at Resend | Resend (as sub-processor) | Automatic purge per Resend SLA | We have no separate deletion control; Resend manages |
| **Email Invite Links** | 7 days (or until used) | MetricOra | Automatic purge after 7 days or immediate if used | Prevents reuse of old links; single-use tokens |
| **Password Reset Tokens** | 1 hour | MetricOra | Auto-expire; manual purge if requested | Prevents accidental password resets from old links |
| **Email Address (Account)** | Indefinite (account active) / 2 years (deleted account) | MetricOra | Anonymized after account deletion + 2 years | Can restore account within 30-day window if needed |

---

## 8. Supplier Data & Supplier Invites (7 Years / 30 Days)

| Data Type | Retention Period | Deletion Method | Notes |
|--|--|--|--|
| **Supplier Invite Link** | 30 days (or until used) | Auto-delete after 30 days; immediate if used | Single-use token; prevents reuse |
| **Supplier Portal Submissions (EPD/PCF)** | 7 years | Follow Activity Record retention (if approved into org) or delete after 2 years if not approved | Approved submissions become part of org's Scope 3 data (7-year retention) |
| **Supplier Email Address** | 30 days or until first login | Delete after 30 days if not used; then follow user account retention if supplier joins | Prevents spam; allows 1-month grace period for signup |

---

## 9. DSAR Requests & Exports (90 Days)

| Data Type | Retention Period | Deletion Method | Notes |
|--|--|--|--|
| **DSAR Request Metadata** | 3 years | Retain for audit; then anonymize request record | Allows subject to verify request was fulfilled; compliance record |
| **DSAR Export ZIP File** | 90 days (or until confirmed downloaded) | Auto-delete after 90 days; or delete after user confirms receipt | Presigned URL expires in 15 min; ZIP stored in secure location with expiry |
| **DSAR Fulfillment Log** | 3 years | Linked to request; auto-delete with request after 3 years | Audit trail showing what was exported, when, to whom |

---

## 10. Reporting & Snapshots (7+ Years)

| Data Type | Retention Period | Immutability | Deletion Method | Notes |
|--|--|--|--|--|
| **Published Snapshot** | 7+ years (indefinite for audit) | Immutable after publication | Archive to cold storage after 7 years; never delete | Core compliance artifact; retained for regulatory inspection |
| **Report PDF/CSV** | 7+ years (tied to snapshot) | Immutable; checksummed | Retained in R2; presigned URLs managed per snapshot lifecycle | Reports derive from snapshots; deleted when snapshot archived |
| **Report Access Logs** | 7 years | Audit trail of who downloaded report when | Linked to audit log; deleted with audit log anonymization | Tracks report dissemination for compliance |

---

## 11. Cookies & Session Storage (7 Days / Session-based)

| Data Type | Retention Period | Deletion Method | Notes |
|--|--|--|--|
| **Session Cookies** | 7 days or until logout | Auto-expire; deleted on browser close if session-only | Session token linked to database record; both expire together |
| **Local Storage (UI Preferences)** | Indefinite (browser-controlled) | User can clear via browser settings; no server-side purge | Stores non-sensitive data (theme, sidebar collapse state) |

---

## 12. Regulatory & Legal Holds

| Scenario | Extension | Duration | Notes |
|--|--|--|--|
| **Active Litigation** | Indefinite | Until case resolved + 2 years (record retention) | Legal hold supersedes normal retention; notify compliance before deletion |
| **ICO Investigation** | Indefinite | Until investigation closed + statutory period | Comply with ICO request; retain data specified in notice |
| **Audit / CSRD Assurance** | Indefinite | Until audit complete + 3 years post-audit | Auditor may request specific data; retain per request |

---

## 13. Retention Schedule & Responsibilities

### 13.1 Automated Retention Enforcement

| Scheduled Task | Frequency | Responsible Team | Log Location |
|--|--|--|--|
| **Session Purge** | Daily | Infrastructure (pg-boss scheduler) | `workers/logs/session-cleanup.log` |
| **Stale Submission Cleanup** | Daily | Backend worker | `workers/logs/field-submission-cleanup.log` |
| **Audit Log Anonymization** | Weekly | Backend worker (batch job) | `workers/logs/audit-anonymization.log` |
| **Field Submission (Rejected) Purge** | Weekly | Backend worker | `workers/logs/submission-purge.log` |
| **DSAR Export Cleanup** | Weekly | Backend worker | `workers/logs/dsar-cleanup.log` |
| **Old Report Archive** | Monthly | Manual + Cloud Storage lifecycle policy | `docs/compliance/archive-log.md` |

### 13.2 Manual Retention Oversight

- **Quarterly Audit:** Compliance team audits deletion logs to confirm automated processes ran
- **Annual Review:** Update this schedule based on regulatory changes or new data categories
- **Incident-Triggered Review:** If a deletion fails or legal hold is placed, immediately notify compliance team

---

## 14. DSAR Fulfillment & Erasure Integration

### Right to Access (Art. 15)
- Trigger automatic DSAR export via `/api/account/dsar` endpoint
- ZIP created from PII registry; includes all categories below
- Presigned URL emailed to subject (15-min expiry)
- ZIP deleted after 90 days if not confirmed received

### Right to Erasure (Art. 17)
- Trigger `/api/account/dsar/erase` endpoint
- For each data category: apply anonymization strategy from PII registry
- Activity records: anonymize amounts, supplier names (retain timestamps, activity type for audit)
- User records: soft-delete; anonymize after 2 years
- Audit logs: anonymize user ID (retain action/resource for compliance)
- GPS/postcodes: delete plaintext; delete encrypted copies after 7-year retention

---

## 15. Exceptions & Policy Overrides

| Exception | Condition | Override Authority | Duration |
|--|--|--|--|
| **Legal Hold** | Litigation, ICO investigation, regulatory audit | Legal team + compliance lead | Until legal/regulatory requirement lifted + 2 years |
| **Criminal Investigation** | Police/prosecution request | Legal team; must include warrant or court order | Per law enforcement request |
| **Backup Retention** | System recovery, disaster recovery | Infrastructure lead; document reason | Up to 90 days (standard backup window) |

---

## 16. Data Retention Policy Violations

### 16.1 Audit & Monitoring

- **Quarterly Logs Review:** Confirm deletion jobs executed successfully
- **Annual Compliance Audit:** Verify retention periods align with GDPR and legal obligations
- **Incident Report:** If data retained past expiry date due to system failure, notify compliance within 24 hours

### 16.2 Remediation

- If data retained past expiry: immediate escalation to compliance + legal
- If deletion fails: retry within 24 hours; log reason for failure
- If legal/regulatory hold forgotten: reinstate hold immediately; no retroactive deletion

---

## 17. Contact & Escalation

- **Retention Questions:** compliance@metricora.co.uk
- **Legal Hold / Exception:** legal@metricora.co.uk
- **Deletion Failure / Incident:** privacy@metricora.co.uk (escalate within 24 hours)
- **Regulatory Inquiry (ICO):** compliance@metricora.co.uk (forward to legal team)

---

## 18. Version Control

| Version | Date | Change |
|--|--|--|
| 1.0 | Aug 2026 | Initial retention schedule per GDPR Art. 5(1)(e) |

**Last Review:** August 2026  
**Next Review:** August 2027  
**Approval:** [Compliance Lead Name]  
**Date Approved:** [To be filled]
