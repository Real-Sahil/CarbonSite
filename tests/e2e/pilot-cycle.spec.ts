import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// The pilot user cycle, end to end against a local app and database: sign-up,
// data entry, calculation, publication, a PDF report, a field submission from
// capture to approval, role boundaries and a cross-tenant attempt. It creates
// accounts, so it only runs with E2E_LOCAL=1 (CI's e2e-local job, which
// migrates and seeds a throwaway Postgres); the smoke job that points at
// production skips it.
//
// Totals are the hand-worked DESNZ 2025 values also checked per record in
// tests/golden/pilot-inventory.test.ts.

test.skip(!process.env.E2E_LOCAL, "needs a local app and a seeded throwaway database (E2E_LOCAL=1)");
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

// Only constructed when the spec runs: the production smoke job has no
// generated client or database.
const db = process.env.E2E_LOCAL ? new PrismaClient() : (null as unknown as PrismaClient);
const run = Date.now();
const PASSWORD = "PilotPass!2345";

type Actor = { ctx: BrowserContext; api: APIRequestContext; userId: string };
const actors: Record<string, Actor> = {};
let orgId = "";
let periodId = "";
let facilityId = "";
let snapshotId = "";
const cat: Record<string, string> = {};

// Better Auth allows a few sign-ups per address every ten seconds.
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function signUp(browserCtx: BrowserContext, name: string): Promise<Actor> {
  const email = `pilot.${name}.${run}@example.test`;
  const res = await browserCtx.request.post("/api/auth/sign-up/email", {
    data: { name, email, password: PASSWORD },
  });
  expect(res.status(), `sign-up ${name}`).toBeLessThan(300);
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  return { ctx: browserCtx, api: browserCtx.request, userId: user.id };
}

const org = (path: string) => `/api/orgs/${orgId}${path}`;

test.afterAll(async () => {
  await db?.$disconnect();
});

test("admin signs up and creates a UK organisation", async ({ browser }) => {
  actors.admin = await signUp(await browser.newContext(), "admin");
  const res = await actors.admin.api.post("/api/orgs", { data: { name: `Pilot Builders ${run}`, hqCountry: "GB" } });
  expect(res.status()).toBeLessThan(300);
  orgId = (await res.json()).id;
  for (const c of await db.emissionCategory.findMany({ select: { id: true, code: true } })) cat[c.code] = c.id;
});

test("period, facility and approved records", async () => {
  const { api } = actors.admin;
  const period = await api.post(org("/reporting-periods"), {
    data: { type: "year", startDate: "2025-01-01", endDate: "2025-12-31", label: "FY2025" },
  });
  expect(period.status()).toBe(201);
  periodId = (await period.json()).id;

  const duplicate = await api.post(org("/reporting-periods"), {
    data: { type: "year", startDate: "2025-01-01", endDate: "2025-12-31", label: "FY2025 again" },
  });
  expect(duplicate.status()).toBe(409);

  const periods = await (await api.get(org("/reporting-periods"))).json();
  expect(periods.periods.map((p: { label: string }) => p.label)).toContain("FY2025");

  const facility = await api.post(org("/facilities"), { data: { name: "Leeds depot", country: "GB" } });
  expect(facility.status()).toBe(201);
  facilityId = (await facility.json()).id;

  const records = [
    { code: "s2-electricity-lb", amount: 120000, unit: "kWh" },
    { code: "s1-stationary", amount: 85000, unit: "kWh", fuelType: "natural gas" },
    { code: "s1-mobile", amount: 14000, unit: "litres", fuelType: "diesel" },
    { code: "s1-mobile", amount: 3000, unit: "litres", fuelType: "HVO" },
    { code: "s3-purchased-goods", amount: 250000, unit: "GBP", industryCode: "41.20" },
    { code: "s2-heat", amount: 40000, unit: "kWh" },
    { code: "s3-waste", amount: 12, unit: "tonnes" },
    { code: "s3-business-travel", amount: 8000, unit: "km", transportMode: "rail" },
  ];
  for (const { code, ...r } of records) {
    const res = await api.post(org("/activity-records"), {
      data: { reportingPeriodId: periodId, facilityId, emissionCategoryId: cat[code], activityDate: "2025-06-30", dataOrigin: "invoiced", ...r },
    });
    expect(res.status(), code).toBe(201);
    const id = (await res.json()).id;
    const review = await api.patch(org(`/activity-records/${id}/review`), { data: { reviewStatus: "approved" } });
    expect(review.status(), `approve ${code}`).toBe(200);
  }
});

test("calculation on DEFRA 2025.2 matches the hand-worked total", async () => {
  const { api } = actors.admin;
  const methodology = await db.methodologyVersion.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  const defra = await db.factorLibrary.findFirstOrThrow({ where: { name: "DEFRA", version: "2025.2" } });
  const epa = await db.factorLibrary.findFirstOrThrow({ where: { name: "EPA", version: "2025.1" } });

  const wrongCountry = await api.post(org("/calculation-runs"), {
    data: { reportingPeriodId: periodId, methodologyVersionId: methodology.id, factorLibraryId: epa.id },
  });
  expect(wrongCountry.status()).toBe(409);
  expect((await wrongCountry.json()).code).toBe("LIBRARY_COUNTRY_MISMATCH");

  const started = await api.post(org("/calculation-runs"), {
    data: { reportingPeriodId: periodId, methodologyVersionId: methodology.id, factorLibraryId: defra.id },
  });
  expect(started.status()).toBeLessThan(300);
  const runId = (await started.json()).id;
  await expect
    .poll(async () => (await (await api.get(org(`/calculation-runs/${runId}`))).json()).status, { timeout: 60_000 })
    .toBe("succeeded");

  const dash = await (await api.get(org(`/dashboard?periodId=${periodId}`))).json();
  // 21240 + 15551.6 + 35991.48 + 106.74 + 54657.48 + 7011.6 + 56.23 + 283.68
  expect(dash.grandTotalKg).toBeCloseTo(134898.8, 0);

  const published = await api.post(org(`/calculation-runs/${runId}/publish-snapshot`), { data: {} });
  expect(published.status()).toBe(201);
  snapshotId = (await published.json()).id;
});

test("inventory report renders to PDF", async () => {
  const { api } = actors.admin;
  const res = await api.post(org("/reports"), { data: { reportingPeriodId: periodId, snapshotId, type: "inventory" } });
  expect(res.status()).toBeLessThan(300);
  const reportId = (await res.json()).id;
  await expect
    .poll(async () => (await db.report.findUniqueOrThrow({ where: { id: reportId } })).status, { timeout: 90_000 })
    .toBe("ready");
});

test("viewer reads but cannot write", async ({ browser }) => {
  await pause(11_000);
  actors.viewer = await signUp(await browser.newContext(), "viewer");
  await db.organizationMembership.create({ data: { organizationId: orgId, userId: actors.viewer.userId, role: "viewer" } });
  const { api } = actors.viewer;
  expect((await api.get(org("/dashboard"))).status()).toBe(200);
  expect((await api.get(org("/activity-records"))).status()).toBe(200);
  const write = await api.post(org("/activity-records"), {
    data: { reportingPeriodId: periodId, emissionCategoryId: cat["s1-mobile"], amount: 1, unit: "litres" },
  });
  expect(write.status()).toBe(403);
});

test("field worker submits; an admin approves and the run stays on DEFRA", async ({ browser }) => {
  await pause(11_000);
  actors.field = await signUp(await browser.newContext(), "field");
  await db.organizationMembership.create({ data: { organizationId: orgId, userId: actors.field.userId, role: "field_worker" } });
  const fw = actors.field.api;

  for (const path of ["/dashboard", "/activity-records", "/reports", "/analytics/reports", "/forecasts", "/anomalies"]) {
    const res = path === "/analytics/reports"
      ? await fw.post(org(path), { data: { title: "x", periodIds: [periodId], format: "json" } })
      : await fw.get(org(path));
    expect(res.status(), `field worker ${path}`).toBe(403);
  }

  const submission = {
    reportingPeriodId: periodId,
    facilityId,
    documentType: "fuel_receipt",
    formData: { volume: 250, volumeUnit: "litres", fuelType: "diesel", date: "2025-11-14", supplierName: "Certas Energy" },
    idempotencyKey: `pilot-fuel-${run}`,
  };
  const first = await fw.post(org("/field-submissions"), { data: submission });
  expect(first.status()).toBe(201);
  const submissionId = (await first.json()).id;
  const retry = await fw.post(org("/field-submissions"), { data: submission });
  expect((await retry.json()).id).toBe(submissionId);

  const selfApprove = await fw.patch(org(`/field-submissions/${submissionId}/review`), { data: { action: "approved" } });
  expect(selfApprove.status()).toBe(403);

  const approve = await actors.admin.api.patch(org(`/field-submissions/${submissionId}/review`), {
    data: { action: "approved", emissionCategoryId: cat["s1-mobile"] },
  });
  expect(approve.status()).toBe(200);

  const approved = await db.fieldSubmission.findUniqueOrThrow({ where: { id: submissionId } });
  expect(approved.activityRecordId).toBeTruthy();
  const latest = await db.calculationRun.findFirstOrThrow({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    include: { factorLibrary: true },
  });
  expect(`${latest.factorLibrary.name} ${latest.factorLibrary.version}`).toBe("DEFRA 2025.2");
  expect(await db.supplierPerformance.count({ where: { organizationId: orgId, supplierId: orgId } })).toBe(0);

  const page = await actors.field.ctx.newPage();
  await page.goto(`/orgs/${orgId}/dashboard`);
  await expect(page).toHaveURL(/\/app$/);
});

test("another organisation cannot reach this one", async ({ browser }) => {
  await pause(11_000);
  actors.outsider = await signUp(await browser.newContext(), "outsider");
  const { api } = actors.outsider;
  const own = await api.post("/api/orgs", { data: { name: `Rival ${run}`, hqCountry: "GB" } });
  const ownOrgId = (await own.json()).id;
  const record = await db.activityRecord.findFirstOrThrow({ where: { organizationId: orgId } });

  for (const path of ["/dashboard", "/activity-records", `/activity-records/${record.id}`, "/reports", "/members"]) {
    expect((await api.get(org(path))).status(), `outsider ${path}`).toBe(403);
  }
  expect((await api.patch(org(`/activity-records/${record.id}/review`), { data: { reviewStatus: "rejected" } })).status()).toBe(403);
  expect((await api.get(`/api/orgs/${ownOrgId}/activity-records/${record.id}`)).status()).toBe(404);
  expect((await api.get(`/api/orgs/${ownOrgId}/snapshots/${snapshotId}`)).status()).toBe(404);
});

test("admin pages render without errors", async () => {
  const page = await actors.admin.ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
  });
  for (const path of ["dashboard", "records", "calculations", "reports", "submissions", "analytics", "anomalies", "forecasting", "compliance/esrs-e1"]) {
    await page.goto(`/orgs/${orgId}/${path}`);
    await expect(page.locator("body")).not.toContainText(/Something went wrong|Application error/);
  }
  await expect(page).toHaveURL(new RegExp(`/orgs/${orgId}/`));
  expect(errors).toEqual([]);
});
