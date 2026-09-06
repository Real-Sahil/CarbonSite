# Data Subject Access Request (DSAR) Manual Process

**Organization:** MetricOra  
**Last Updated:** August 2026  
**Scope:** How to handle GDPR Article 15 (Access), Article 16 (Rectification), and Article 17 (Erasure) requests

---

## Overview

Data Subject Access Requests (DSARs) are legally mandated under UK GDPR and DPA 2018. MetricOra must respond within **30 calendar days** of receipt (extendable to 60–90 days for complex/manifestly unfounded requests).

This document covers:
1. How to identify and log a DSAR
2. How to fulfill each request type (access, rectification, erasure)
3. Manual escalation procedures
4. Record-keeping & audit trail

---

## 1. Receiving a DSAR

### 1.1 Channels

DSARs can arrive via:
- Email to **privacy@metricora.io** (monitored by compliance team)
- In-app DSAR endpoint `/api/account/dsar` (authenticated user self-service)
- Postal mail to [registered address]
- Phone call (rare; ask requester to send written confirmation via email)

### 1.2 Initial Intake & Logging

Upon receiving a DSAR (via any channel):

1. **Log Immediately**
   - Email template: "DSAR Received — [Subject Name]"
   - Ticket ID: Auto-assign via issue tracker (e.g., DSAR-2026-001)
   - Log in compliance system: timestamp, requester contact, request type (Access/Rectification/Erasure)

2. **Confirm Receipt**
   - Send acknowledgment within 24 hours (Art. 14(3) GDPR)
   - Subject: "Data Subject Access Request — Received & Being Processed"
   - Body: Ticket ID, 30-day deadline (or 60-90 days if complex), contact for updates

3. **Verify Identity**
   - For email requests: confirm requester is the data subject (or authorized representative)
   - Request: government ID photocopy (if doubts about identity)
   - If via `/api/account/dsar` endpoint (authenticated): auto-verified; proceed

### 1.3 Fees & Manifestly Unfounded Requests

- **Fee:** No fee unless request is manifestly unfounded or repetitive
  - Manifestly unfounded = clearly frivolous, no genuine interest in accessing data
  - Repetitive = same/substantially same request within 12 months
  - If you believe request is manifestly unfounded, document reason and propose fee (capped at €24.50 administrative cost)
  - Requester must agree to fee before proceeding

- **Reject Only If:** You have clear legal basis; otherwise, proceed and explain grounds in response letter

---

## 2. Type 1: Access Request (Art. 15)

### 2.1 Automated Processing (Self-Service)

Most access requests can be fulfilled automatically via the `/api/account/dsar` endpoint:

```
POST /api/account/dsar
{
  "organizationId": "org_xxx",
  "dataFormat": "csv" | "json"
}
Response:
{
  "requestId": "dsar_req_xxx",
  "status": "queued",
  "estimatedCompletionTime": "5 minutes",
  "presignedUrl": "https://r2.metricora.io/dsar/dsar_req_xxx.zip?signature=...",
  "expiresAt": "2026-08-25T15:00:00Z"  // 15 min
}
```

**What's Included in the ZIP:**
- User profile (email, name, roles)
- All activity records (org-scoped)
- All field submissions
- Import batches (metadata only; source files linked)
- Evidence files (download links inside ZIP)
- Audit logs (anonymized if older than 5 years)
- API keys (encrypted)
- DSAR request history

### 2.2 Manual Steps (Complex Requests)

If the requester asks for:
- Specific time period or data category (not org-wide)
- Narrative explanation of how data is used (not just export)
- Erasure of specific records only (escalate to Type 3)

Then:

1. **Scope the Request**
   - Email requester: "Your request includes [specific categories]. Can you confirm these are all you need?"
   - Document scope decision in ticket

2. **Generate Custom Export**
   - If org-wide is too broad: manually select date range / category filters
   - Use database queries (with org-scope enforcement) to build filtered dataset
   - Output to CSV or JSON per requester preference

3. **Create Presigned URL**
   - Upload file to R2 with 15-minute expiry
   - Attach presigned URL to response email

### 2.3 Response Letter

**Template: Access Request Fulfillment**

```
Dear [Requester Name],

Thank you for your Data Subject Access Request dated [date].

We have compiled all personal data we hold about you, organized into the 
following categories:

1. Account Information (email, name, roles, login history)
2. Activity Records (emissions data you entered or approved)
3. Field Submissions (mobile app submissions)
4. Audit Logs (actions taken on your account)
5. Evidence Files (utility bills, photos, documents you uploaded)

Your data is enclosed in the attached ZIP file. The link expires in 15 minutes 
for security. If you need additional time, please reply to this email.

**Your rights:**
- Right to Rectification (Art. 16): Correct inaccurate data by replying to this email
- Right to Erasure (Art. 17): Request deletion of specific records (see next section)
- Right to Portability (Art. 20): Data is provided in CSV format for re-use
- Right to Object (Art. 21): Opt-out of processing where lawful

For questions, contact privacy@metricora.io.

Best regards,
MetricOra Compliance Team
```

### 2.4 SLA & Follow-Up

- **Deadline:** 30 calendar days from receipt
- **Follow-up:** If requester doesn't download within 15 min, resend presigned URL (one additional resend)
- **Non-response:** If requester doesn't respond to clarification request within 7 days, close ticket (can be re-opened if requested again)

---

## 3. Type 2: Rectification Request (Art. 16)

### 3.1 Scope & Limitations

Rectification = correct **inaccurate or incomplete** data held about the data subject.

**Examples of Rectifiable Data:**
- Wrong name/email in profile
- Incorrect activity record amounts or dates (if user entered wrong number)
- Supplier name misspelled in activity record

**Not Rectifiable (these require dispute/erasure instead):**
- Disagreement with calculated CO2e (recalculate if methodology changed, not due to user request)
- Request to delete record (use Art. 17 / Type 3 instead)

### 3.2 Process

1. **Verify Request**
   - Email requester: "You've requested correction of [field]. Please provide evidence of the correct value."
   - If user has portal access: direct them to edit in-app (Activity Records → Edit)

2. **Implement Correction**
   - For in-app editable fields: user applies correction themselves (logged in audit trail)
   - For admin-only fields: compliance team updates directly; log in audit trail with reason

3. **Recalculate (if needed)**
   - If activity record amount changed: trigger recalculation run
   - Log recalculation reason in audit trail
   - Notify user: "Your record has been corrected and recalculated."

4. **Response Letter**

```
Dear [Requester Name],

We have corrected your record as follows:
- [Field]: [Old Value] → [New Value]

The corrected data is now reflected in your dashboard and all future reports.
Previous reports generated before this correction remain unchanged (historical record).

If you need additional corrections, please reply to this email.

Best regards,
MetricOra Compliance Team
```

### 3.3 SLA

- **Deadline:** 30 calendar days
- **Complications:** If correcting data triggers a recalculation and requires business-logic review, extend to 60 days with explanation

---

## 4. Type 3: Erasure Request (Art. 17)

### 4.1 Lawful Grounds for Refusal

Art. 17 is not unconditional. MetricOra may refuse if:

| Ground | Examples | Action |
|--|--|--|
| **Legal Obligation** | Tax records (7-year retention), GHG Protocol audit trail | Refuse; explain 7-year retention schedule |
| **Public Task** | Regulatory reporting (CSRD) | Refuse; explain public interest in GHG data |
| **Legitimate Interest** | Fraud investigation, active litigation | Refuse with reason; offer alternative (anonymization) |
| **Data Subject Gave Consent** | Explicitly consented to 7-year retention | Refuse; offer right to object (Art. 21) instead |

### 4.2 Erasure Process

If erasure is **lawful** (no legal hold, no retention obligation):

1. **Scope Request**
   - Email requester: "Which record(s) should be deleted: [list options]?"
   - Or: "All your activity records and field submissions (this will remove your emissions data from the platform)?"

2. **Trigger Erasure Job**
   - Email to privacy@metricora.io: "Approve DSAR-2026-XXX for erasure: [scope]"
   - Compliance lead confirms request is legitimate (not frivolous)
   - Backend team queues `/workers/dsar-erasure` job

3. **What Gets Deleted/Anonymized**
   - **ActivityRecord:** Anonymize amount, unit, supplier name; retain activity type, facility, timestamp for audit
   - **FieldSubmission:** Delete entirely (unless linked to approved Activity Record, then anonymize)
   - **User Account:** Soft-delete; 2-year retention then anonymize user ID in audit logs
   - **Postcode Data:** Delete plaintext postcode; leave encrypted copy until 7-year retention expires
   - **Evidence Files:** Delete from R2 (permanent deletion)
   - **Audit Logs:** Anonymize actor_user_id (retain action type, resource ID, timestamp)

4. **Confirmation Letter**

```
Dear [Requester Name],

Your erasure request has been processed as of [date].

The following data has been deleted:
- [List anonymized categories]

Please note:
- Some data cannot be fully deleted due to legal/regulatory requirements 
  (see attached Data Retention Schedule). This data has been anonymized.
- Historical reports generated before this erasure remain unchanged 
  (snapshot immutability).
- Your future data will not be collected unless you re-register.

If you have questions, contact privacy@metricora.io.

Best regards,
MetricOra Compliance Team
```

### 4.3 Refusal Letter (If Applicable)

```
Dear [Requester Name],

Thank you for your Erasure Request dated [date].

We are unable to fully comply with your request for the following reason(s):

1. [Legal Obligation / Public Task / Legitimate Interest]
   
   [Explanation of why deletion would violate law or MetricOra's obligations]

**Alternative Right:**
- Right to Object (Art. 21): You can object to further processing based on 
  legitimate interest (e.g., marketing). Reply to confirm.
- Right to Restrict (Art. 18): We can suspend processing while you dispute.

If you believe our refusal is unjustified, you have the right to lodge a 
complaint with the Information Commissioner's Office (ICO): https://ico.org.uk

Best regards,
MetricOra Compliance Team
```

---

## 5. Specialized Scenarios

### 5.1 Authorized Representative

If request is from a legal representative (not the data subject):

1. **Verify Authority**
   - Request: Power of Attorney / legal authorization document
   - Confirm representative is acting on behalf of data subject

2. **Proceed With Caution**
   - Still send confirmation to **data subject's email** (Art. 12(4) GDPR)
   - Include note: "This DSAR was received on behalf of [representative name]"
   - Data subject can confirm or object

### 5.2 Minor or Incapacitated Data Subject

- If requester is <18 years old: verify parental consent (written authorization)
- If requester is legally incapacitated: verify power of attorney

### 5.3 Third-Party Data (Your Company Data About My Employee)

If a data subject requests data about them held by a MetricOra customer organization:

- **Clarify:** Are you requesting data held by [Organization Name] via MetricOra?
- **Redirect:** "Please send your DSAR to [Organization Name] directly; they are the controller of that data."
- **Exception:** If data subject is MetricOra employee, follow normal process

### 5.4 Request During Legal Proceedings

If you receive a DSAR and there is **active or pending litigation** involving the data subject:

1. **Notify Legal Team Immediately**
2. **Do Not Process** until legal advises
3. **Place Legal Hold** on data (prevent automatic deletion)
4. **Suspend SLA** (30-day deadline may not apply during legal hold)

---

## 6. Record-Keeping & Audit Trail

### 6.1 What to Document

For every DSAR, maintain a file containing:

- Original DSAR (email screenshot or letter scan)
- Date received, date deadline
- Confirmation of receipt email sent (with timestamp)
- Identity verification evidence (if applicable)
- Scope clarification emails (if request was ambiguous)
- Decision (approve/refuse and reason)
- Action taken (export generated / rectification made / erasure triggered)
- Response letter sent (with timestamp)
- Data subject confirmation of receipt (if available)

### 6.2 Retention of DSAR Records

- **DSAR request metadata:** 3 years (audit trail; then anonymize requester email)
- **Response letter & supporting docs:** 3 years
- **Presigned URLs & download logs:** 90 days (then delete)

### 6.3 Audit Log Entry

Every DSAR triggers an audit log entry:

```
{
  "action": "dsar.received",
  "resourceType": "DsarRequest",
  "resourceId": "dsar_req_xxx",
  "metadata": {
    "requestType": "access|rectification|erasure",
    "requesterEmail": "[anonymized in future]",
    "scope": "org-wide|activity-record-123|...",
    "deadline": "2026-09-25",
    "status": "pending|approved|refused|completed"
  }
}
```

---

## 7. Common Mistakes & Pitfalls

| Mistake | Consequence | Prevention |
|--|--|--|
| **Not responding within 30 days** | GDPR violation; ICO fine | Set calendar reminders; track SLA in ticket system |
| **Charging a fee without legal basis** | Violates Art. 12(5); subject can file complaint | Only charge for manifestly unfounded; document reason |
| **Refusing erasure without legal ground** | Art. 17 violation; subject can complain to ICO | Always cite legal basis; document in refusal letter |
| **Not verifying identity** | Unauthorized access to PII; Art. 12(6) violation | Request ID for any non-authenticated requests |
| **Sending data to wrong person** | Data breach; Art. 33 notification required | Confirm email address; use presigned URL with email verification |
| **Deleting data during litigation hold** | Destruction of evidence; legal consequences | Notify legal immediately upon DSAR; legal team confirms hold status |
| **Slow or missing audit trail** | Can't prove compliance to ICO; regulatory fine | Log every step; timestamp everything |

---

## 8. Escalation & Exceptions

### 8.1 When to Escalate

- Request **manifestly unfounded** → Ask legal team to confirm fee decision
- Request **during litigation hold** → Notify legal immediately
- Request **from foreign regulator** (non-UK ICO) → Verify jurisdiction; legal review
- Request **for special category data** (health, race, etc.) → Security review; confirm no special category data is stored
- Request **from data subject who has died** → Verify estate authority; legal review

### 8.2 Contacts

- **Compliance Lead:** compliance@metricora.io
- **Legal Team:** legal@metricora.io
- **Privacy Officer (if appointed):** [DPO email]
- **ICO (for guidance):** canask@ico.org.uk

---

## 9. Performance Metrics

Track DSAR performance for annual compliance report:

| Metric | Target | Current |
|--|--|--|
| **Average Days to Respond** | <30 days | — |
| **% Responded On-Time** | >95% | — |
| **% of Requests Refused** | <5% | — |
| **Average Days to Refuse (if applicable)** | <30 days | — |
| **% Requiring Legal Review** | <10% | — |

---

## 10. Template Responses

### Access Request Received
Subject: "Your Data Subject Access Request — Reference [TICKET-ID]"

Dear [Name],

Thank you for contacting us on [date]. We have logged your Data Subject Access 
Request and will respond within 30 calendar days (by [deadline date]).

Your reference: **[TICKET-ID]**

In the meantime, if you have questions, please reply to this email.

Best regards,
MetricOra Privacy Team

---

### Erasure Approved
Subject: "Your Erasure Request — Completed"

Dear [Name],

Your erasure request of [date] has been processed. The following data has been deleted:
- [Categories]

Please allow 24 hours for deletion to complete across all systems.

Best regards,
MetricOra Privacy Team

---

## 11. Contacts & Escalation

- **Questions:** privacy@metricora.io
- **Urgent (Breach):** compliance@metricora.io
- **Legal Hold / Litigation:** legal@metricora.io
- **Regulator Response:** [DPO if appointed, else legal lead]

---

## Version Control

| Version | Date | Change |
|--|--|--|
| 1.0 | Aug 2026 | Initial DSAR process doc |

**Last Review:** August 2026  
**Next Review:** August 2027  
**Approval:** [Compliance Lead Name]  
**Date Approved:** [To be filled]
