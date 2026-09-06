# Field-Level Encryption Spike

**Status:** Design phase only. Implementation deferred pending spike completion.

**Goal:** Determine feasibility and migration path for encrypting sensitive location data (GPS coordinates, postcodes) at the application level.

## Context

MetricOra captures location data for emissions quantification:
- **PostcodeGeocode:** UK postal codes → geocoded GPS + region/easting/northing
- **ActivityRecord:** May include GPS coordinates for field work verification
- **FieldSubmission:** Field workers photograph documents; GPS auto-tagged on camera

This data is sensitive PII under UK GDPR / DPA 2018, especially when associated with named suppliers or facilities.

**Current state:**
- No field-level encryption; data stored plaintext in PostgreSQL
- User-uploaded evidence files are stored in R2 (outside database)
- Audit log records actions but not encrypted payloads

## Encryption Design

**Implementation:** `lib/security/field-encryption.ts` provides AES-256-GCM utilities.
- **Algorithm:** AES-256-GCM (authenticated encryption, standard for PII)
- **Key derivation:** Environment variable `FIELD_ENCRYPTION_KEY` (base64-encoded 32 bytes)
- **IV:** Random 12-byte IV per encryption (stored with ciphertext)
- **Storage:** Ciphertext + IV + auth tag stored as JSONB in Postgres

**Example:**
```sql
-- Before encryption
SELECT postcode FROM postcode_geocodes WHERE postcode = 'SW1A1AA';

-- After encryption
SELECT
  'encrypted':= {
    'iv': 'base64-encoded-random-iv',
    'ciphertext': 'base64-encoded-ciphertext'
  }
FROM postcode_geocodes WHERE id = ?;
-- Query: must fetch all rows and decrypt in application
```

## Spike Tasks

### 1. Query Impact Analysis (2–3 days)
Quantify the performance impact of decrypting location data on read-heavy queries:

- **Current:** `SELECT * FROM activities WHERE facility_id = ? AND latitude > 51.5` (SQL-level filtering)
- **Post-encryption:** Fetch all activities, decrypt GPS in application, filter in-memory

Query patterns to audit:
- Dashboard aggregation queries (currently use `SELECT SUM(co2e) FROM ...`)
- Map visualizations (currently use GPS for rendering)
- Route distance calculations (currently use `ST_Distance` for join filtering)
- Postcode region/normalization queries (currently use `LIKE` on postcode column)

**Deliverable:** Report on which queries are most affected and proposed workarounds.

### 2. Decryption Pattern Design (3–5 days)
Design application-level decryption patterns to minimize overhead:

- **Selective decryption:** Only decrypt fields when needed (lazy decryption)
- **Batch decryption:** Cache decrypted values in-request to avoid repeated work
- **Denormalized fields:** Store encrypted + plaintext (e.g., `postcode_encrypted` + `region_name` for filtering)
- **Caching strategy:** Redis cache for frequently accessed decrypted values?

**Recommendation:** Start with selective decryption of postcodes only (smallest dataset).

### 3. Key Rotation Strategy (2–3 days)
Design key rotation without downtime:

- **Dual-key period:** Support both old + new encryption keys during rotation window
- **Background migration:** Scheduled job to re-encrypt all values with new key
- **Rollback:** Can we decrypt with old key if new key fails?
- **Key versioning:** Store which key version encrypted each field?

**Decision point:** Is dual-key per field, or per-row, or per-table?

### 4. Audit Trail Integration (2–3 days)
Ensure decrypted data doesn't leak into audit logs:

- **AuditLog.metadata:** Should not store decrypted GPS/postcodes (even if user-submitted)
- **Error logs:** Ensure error messages don't include decrypted values
- **Sentry integration:** Configure Sentry to redact encrypted fields

### 5. Migration Design (2–3 days)
Plan data migration from plaintext → encrypted:

- **Zero-downtime migration:** Feature flag encryption on/off during transition period
- **Backfill strategy:** Background job to encrypt existing rows in batches
- **Verification:** How to verify all rows were encrypted correctly?
- **Rollback:** Can we decrypt back to plaintext if needed?

## Open Questions

1. **Key management:** Is environment variable sufficient for production, or use AWS KMS / Vault?
2. **GPS range queries:** Can we afford to decrypt all rows for map-based filtering?
3. **Postcode normalization:** Should `PostcodeGeocode.postcode` stay plaintext for lookups, and only encrypt GPS?
4. **Compliance:** Does encryption at rest satisfy GDPR/DPA requirements, or do we also need field-level access controls?
5. **Performance SLA:** Current dashboard target is <3s for 100k rows. What's the tolerable decrypt overhead?

## Phasing Recommendation

### Phase 1 (MVP):
- Encrypt **postcodes only** (smallest dataset, biggest privacy win)
- Use selective lazy decryption (decrypt only on UI display, not in calculations)
- Store `PostcodeGeocode.region_name` plaintext for filtering and joins

### Phase 2 (Post-MVP):
- Encrypt GPS coordinates (larger dataset, requires more analysis)
- Implement caching strategy to reduce per-request decrypt overhead

### Phase 3 (Future):
- Implement key rotation
- Integrate with external key management service (AWS KMS)

## Success Criteria

- ✓ Spike document completed with query-impact analysis
- ✓ Encryption utility is working and tested
- ✓ Proposed migration path documented
- ✓ Go/no-go decision made on Phase 1 (postcode encryption)
