// Field-level encryption for sensitive PII (GPS coordinates, postcodes).
// Uses AES-256-GCM with random IV per encryption.
//
// DESIGN NOTES:
// - Each encrypted value stores: IV (12 bytes, random per encryption) + ciphertext + auth tag
// - Decryption requires the same encryption key
// - All application queries must decrypt in-memory after fetching from DB
//
// TRADE-OFFS:
// - ✓ GPS/postcodes encrypted at rest in PostgreSQL
// - ✓ Survives database backups and pg_dump exports
// - ✗ Cannot perform range queries (WHERE latitude > 51.5) at SQL level — must decrypt all rows
// - ✗ Cannot join on GPS distance (ST_Distance) or postcode lookups — needs application logic
// - ✗ Decryption per-record adds CPU overhead to read-heavy queries
// - ✗ If encryption key is compromised, entire dataset can be decrypted
//
// RECOMMENDED SCOPE (MVP):
// Only encrypt postcodes initially (smallest payload, biggest privacy win).
// Defer GPS encryption to Phase 2 — PostcodeGeocode model is simpler (smaller dataset).
// Document that GPS is captured and stored unencrypted for now.

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const TAG_LENGTH = 16;
const IV_LENGTH = 12;

export type EncryptedValue = {
  iv: string; // base64-encoded IV
  ciphertext: string; // base64-encoded ciphertext + auth tag
};

// Derive a stable encryption key from an application secret.
// In production, this should come from a key management service (AWS KMS, Vault, etc.).
// For MVP, store in an environment variable (FIELD_ENCRYPTION_KEY=base64-encoded-32-bytes).
function getEncryptionKey(): Buffer {
  const keyEnv = process.env.FIELD_ENCRYPTION_KEY;
  if (!keyEnv) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY not set. Field-level encryption is disabled. " +
      "To enable, generate a 256-bit key: `node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"`" +
      " and set FIELD_ENCRYPTION_KEY in .env.",
    );
  }
  return Buffer.from(keyEnv, "base64");
}

export function encryptField(plaintext: string): EncryptedValue {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  const ciphertextWithTag = Buffer.concat([encrypted, authTag]);

  return {
    iv: iv.toString("base64"),
    ciphertext: ciphertextWithTag.toString("base64"),
  };
}

export function decryptField(encrypted: EncryptedValue): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encrypted.iv, "base64");
  const ciphertextWithTag = Buffer.from(encrypted.ciphertext, "base64");
  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - TAG_LENGTH);
  const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}

// JSON storage format for encrypted fields (stored as JSONB in Postgres).
export function encryptedToJson(value: EncryptedValue): Record<string, string> {
  return value;
}

export function encryptedFromJson(json: unknown): EncryptedValue {
  if (typeof json === "object" && json !== null && "iv" in json && "ciphertext" in json) {
    return {
      iv: String((json as Record<string, unknown>).iv),
      ciphertext: String((json as Record<string, unknown>).ciphertext),
    };
  }
  throw new Error("Invalid encrypted value format");
}
