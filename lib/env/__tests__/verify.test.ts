import { describe, expect, test } from "vitest";
import { verifyEnvironmentConfiguration } from "../verify";

const baseEnv = {
  BETTER_AUTH_SECRET: "secret",
  BETTER_AUTH_URL: "https://app.carbonsite.example",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/carbonsite",
  EMAIL_DRIVER: "console",
  JOB_PROCESSING_MODE: "inline",
  NEXT_PUBLIC_APP_URL: "https://app.carbonsite.example",
  POSTCODES_BASE_URL: "https://api.postcodes.io",
  OSRM_BASE_URL: "https://router.project-osrm.org",
  STORAGE_DRIVER: "local",
  TRUSTED_ORIGINS: "https://app.carbonsite.example",
};

describe("verifyEnvironmentConfiguration", () => {
  test("accepts the local inline configuration", () => {
    const result = verifyEnvironmentConfiguration(baseEnv);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  test("requires R2 credentials when object storage uses R2", () => {
    const result = verifyEnvironmentConfiguration({
      ...baseEnv,
      STORAGE_DRIVER: "r2",
    });

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([
      "STORAGE_ENDPOINT",
      "STORAGE_ACCESS_KEY_ID",
      "STORAGE_SECRET_ACCESS_KEY",
      "STORAGE_BUCKET",
    ]);
  });

  test("requires Resend credentials when transactional email uses Resend", () => {
    const result = verifyEnvironmentConfiguration({
      ...baseEnv,
      EMAIL_DRIVER: "resend",
    });

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["RESEND_API_KEY", "EMAIL_FROM"]);
  });

  test("reports unsupported production modes", () => {
    const result = verifyEnvironmentConfiguration({
      ...baseEnv,
      EMAIL_DRIVER: "smtp",
      JOB_PROCESSING_MODE: "queue",
      STORAGE_DRIVER: "disk",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      'JOB_PROCESSING_MODE must be "inline" or "worker"; received "queue".',
      'STORAGE_DRIVER must be "local" or "r2"; received "disk".',
      'EMAIL_DRIVER must be "console" or "resend"; received "smtp".',
    ]);
  });

  test("rejects development-only services in production", () => {
    const result = verifyEnvironmentConfiguration({
      ...baseEnv,
      NODE_ENV: "production",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      'STORAGE_DRIVER must be "r2" when NODE_ENV=production.',
      'EMAIL_DRIVER must be "resend" when NODE_ENV=production.',
      "BETTER_AUTH_SECRET must be at least 32 characters when NODE_ENV=production.",
    ]);
  });

  test("rejects non-HTTPS production app origins", () => {
    const result = verifyEnvironmentConfiguration({
      ...baseEnv,
      BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
      BETTER_AUTH_URL: "http://app.carbonsite.example",
      EMAIL_DRIVER: "resend",
      EMAIL_FROM: "noreply@carbonsite.example",
      NEXT_PUBLIC_APP_URL: "http://app.carbonsite.example",
      NODE_ENV: "production",
      RESEND_API_KEY: "re_123",
      STORAGE_ACCESS_KEY_ID: "access",
      STORAGE_BUCKET: "carbonsite",
      STORAGE_DRIVER: "r2",
      STORAGE_ENDPOINT: "https://example.r2.cloudflarestorage.com",
      STORAGE_SECRET_ACCESS_KEY: "secret",
      TRUSTED_ORIGINS: "https://app.carbonsite.example,http://preview.carbonsite.example",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "BETTER_AUTH_URL must be an HTTPS URL when NODE_ENV=production.",
      "NEXT_PUBLIC_APP_URL must be an HTTPS URL when NODE_ENV=production.",
      "TRUSTED_ORIGINS must contain only HTTPS origins when NODE_ENV=production.",
    ]);
  });
});
