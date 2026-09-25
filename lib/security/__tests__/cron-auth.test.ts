import { afterEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "../cron-auth";

const SECRET = "s".repeat(40);
const url = "https://app.example/api/admin/schedule/monitors/permit-expiry";

afterEach(() => vi.unstubAllEnvs());

describe("isAuthorizedCronRequest", () => {
  test("accepts the scheduler secret as x-cron-secret", () => {
    vi.stubEnv("SCHEDULER_SECRET", SECRET);
    vi.stubEnv("CRON_SECRET", "");
    expect(isAuthorizedCronRequest(new NextRequest(url, { headers: { "x-cron-secret": SECRET } }))).toBe(true);
  });

  test("accepts CRON_SECRET as a Vercel-style bearer token", () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("SCHEDULER_SECRET", "");
    expect(isAuthorizedCronRequest(new NextRequest(url, { headers: { authorization: `Bearer ${SECRET}` } }))).toBe(true);
  });

  test("rejects a wrong or missing secret", () => {
    vi.stubEnv("SCHEDULER_SECRET", SECRET);
    expect(isAuthorizedCronRequest(new NextRequest(url, { headers: { "x-cron-secret": "nope" } }))).toBe(false);
    expect(isAuthorizedCronRequest(new NextRequest(url))).toBe(false);
  });

  test("rejects everything when no secret is configured, even an empty header", () => {
    vi.stubEnv("SCHEDULER_SECRET", "");
    vi.stubEnv("CRON_SECRET", "");
    expect(isAuthorizedCronRequest(new NextRequest(url, { headers: { "x-cron-secret": "" } }))).toBe(false);
  });
});
