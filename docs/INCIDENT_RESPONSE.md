# Incident Response Runbook

**Status:** MVP - Monitoring infrastructure in place. Full automation to come in Phase 2.

## Detection Sources

Security incidents are detected via:

1. **Error Tracking (Sentry)** — Critical errors, stack traces, error rates
2. **Security Alerting** (`lib/security/alerting.ts`) — Suspicious audit log patterns
3. **CSP Violations** (`/api/csp-report`) — Content Security Policy breaches
4. **Rate Limiting** — Brute force attempts, distributed attacks (IP + per-account)
5. **Health Checks** (`/api/health`) — Service availability and database connectivity
6. **Manual Review** — Security team periodic audit log review

## Incident Categories & Response

### A. Suspected Data Breach (Critical)

**Detection:** Unusual data exports, bulk download attempts, or unexplained large queries.

**Initial Response (< 15 minutes):**
1. Review audit log for recent bulk exports, deletions, or data access:
   ```sql
   SELECT * FROM audit_logs
   WHERE organization_id = ?
   AND created_at > NOW() - interval '1 hour'
   AND action IN ('audit.export_downloaded', 'dsar.export_completed', 'record.deleted')
   ORDER BY created_at DESC;
   ```
2. Check if the actor is authorized (check their role)
3. If unauthorized: Revoke user's API keys immediately
   ```sql
   UPDATE api_keys SET revoked_at = NOW() WHERE user_id = ?;
   ```

**Escalation (< 1 hour):**
1. Notify Data Protection Officer (DPO)
2. Initiate 72-hour ICO breach notification clock (UK GDPR Art. 33)
3. Review what data was exported (customer data types affected)
4. Determine if personal data of EU residents was involved
5. Begin drafting incident notification (GDPR Art. 34 for affected individuals if needed)

### B. Account Compromise / Brute Force (High)

**Detection:** Multiple failed logins from same account or distributed IPs.

**Response (< 30 minutes):**
1. Account is automatically locked for 30 minutes after 5 failed attempts (per-account lockout in A3.2)
2. Review failed login source IPs and geo locations in audit log:
   ```sql
   SELECT actor_user_id, ip_address, created_at
   FROM audit_logs
   WHERE action = 'auth.sign_in'
   AND created_at > NOW() - interval '1 hour'
   AND ip_address != ? -- exclude legitimate IP
   ORDER BY created_at DESC;
   ```
3. If account belongs to a high-privilege user (admin/auditor):
   - Reset their password
   - Clear active sessions
   - Require MFA re-enrollment
4. Notify user of suspected compromise

### C. Privilege Escalation (Critical)

**Detection:** User role changed to admin, or unexpected permission grant.

**Response (< 15 minutes):**
1. Review the audit log for who made the role change:
   ```sql
   SELECT * FROM audit_logs
   WHERE action = 'org.member.role_change'
   AND created_at > NOW() - interval '1 hour'
   ORDER BY created_at DESC;
   ```
2. Verify the actor is authorized to make role changes (check their role)
3. If unauthorized role change:
   - Revert the role change immediately
   - Revoke the actor's session and API keys
   - Notify security team and affected user

### D. Suspicious Audit Anomalies (Medium)

**Detection:** Bulk mutations, mass deletions, unusual activity patterns.

Examples:
- 50+ records deleted in one operation
- 100+ field submissions reviewed at once
- Mass postcode export

**Response (< 2 hours):**
1. Check who initiated the action (audit log)
2. Is the action legitimate? (e.g., seasonal cleanup, import re-run)
3. If unexpected: contact the organization admin
4. Preserve evidence (don't delete audit logs)

### E. CSP Violations / XSS Attempts (Low-Medium)

**Detection:** CSP report violations, unusual script injection attempts.

**Response (< 24 hours):**
1. Review `/api/csp-report` logs for violation patterns:
   - Same blocked script source repeated?
   - Specific URL pattern?
2. Evaluate:
   - Is this a legitimate third-party script? (Update CSP to allow it)
   - Is this malicious? (Investigate source, review user sessions from that time)
3. Update CSP policy if needed (widen) or investigate further (tighten)

### F. Database Connectivity / Service Degradation (High)

**Detection:** Health check fails, database unreachable, response latency spike.

**Response (< 5 minutes):**
1. Check `/api/health` status and error details
2. Verify database connectivity:
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```
3. Check Vercel deployment status and logs
4. If sustained (> 10 min): notify on-call engineer
5. Check if recent deployment caused the issue (rollback if needed)

## Escalation Path

```
Severity      Threshold              Action
───────────   ──────────────         ────────────────
Critical      Suspected data breach  → Contact DPO + ICO within 72h
              or account compromise
High          Privilege escalation   → Revoke access immediately
              or service down > 1h
Medium        Bulk mutations         → Investigate within 2h
              or CSP violations
Low           Performance degradation→ Monitor and investigate when time allows
```

## Post-Incident Review

After any incident classified as Medium or higher:

1. **Documentation:** Record what happened, when, and how it was resolved
2. **Timeline:** Create a detailed timeline of detection, response, and resolution
3. **Root Cause:** What allowed this incident to occur?
4. **Prevention:** What changes prevent this happening again?
5. **Lessons Learned:** Team retrospective within 5 business days

## Key Contacts (To Be Configured)

- **Data Protection Officer:** [DPO contact info]
- **On-Call Security:** [Phone / Slack]
- **ICO Breach Notification:** notifyus@ico.org.uk (UK: within 72 hours of discovery)

## Tools & Commands

### View Recent Audit Log
```bash
psql $DATABASE_URL -c "
  SELECT created_at, actor_user_id, action, resource_type, resource_id, ip_address
  FROM audit_logs
  WHERE organization_id = '?'
  AND created_at > NOW() - interval '24 hours'
  ORDER BY created_at DESC
  LIMIT 100;
"
```

### Revoke User API Keys
```bash
psql $DATABASE_URL -c "
  UPDATE api_keys
  SET revoked_at = NOW()
  WHERE user_id = '?'
  AND revoked_at IS NULL;
"
```

### Clear User Sessions
```bash
psql $DATABASE_URL -c "
  DELETE FROM sessions
  WHERE user_id = '?'
  AND expires_at > NOW();
"
```

### Check Rate Limit Buckets
```bash
psql $DATABASE_URL -c "
  SELECT key, count, reset_at
  FROM rate_limit_buckets
  WHERE key LIKE '%login:%'
  ORDER BY reset_at DESC
  LIMIT 20;
"
```

## Compliance Checklist

- [ ] GDPR Art. 33: Breach notification to ICO (if EU personal data affected)
- [ ] GDPR Art. 34: Individual notification to affected individuals (if high risk)
- [ ] DPA 2018 Sec. 4: UK ICO notification requirements
- [ ] PECR: Electronic Privacy Regulations (if email/SMS marketing involved)
- [ ] Cyber Essentials: Incident response maturity

---

**Document Version:** 1.0  
**Last Updated:** 2026-08-25  
**Next Review:** 2026-11-25 (quarterly)
