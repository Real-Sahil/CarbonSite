import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Third-party integration credentials (Xero/QuickBooks/OIDC client secrets)
// are encrypted at rest with this key. There is no insecure fallback here —
// an unset key must fail loudly at first use, not silently encrypt every
// stored credential with a string that's sitting in source control.
function getEncryptionKey(): string {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY must be set — refusing to encrypt/decrypt with an insecure default.");
  }
  return key;
}

export function encryptCredential(plaintext: string): string {
  try {
    if (!plaintext) return "";

    const iv = crypto.randomBytes(IV_LENGTH);
    const key = crypto.scryptSync(getEncryptionKey(), "salt", 32);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt credential");
  }
}

export function decryptCredential(encrypted: string): string {
  try {
    if (!encrypted) return "";

    const [ivHex, authTagHex, ciphertext] = encrypted.split(":");
    if (!ivHex || !authTagHex || !ciphertext) {
      throw new Error("Invalid encrypted format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = crypto.scryptSync(getEncryptionKey(), "salt", 32);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt credential");
  }
}
