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
});
