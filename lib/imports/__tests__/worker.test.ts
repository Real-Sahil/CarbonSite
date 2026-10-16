import { beforeEach, describe, expect, it, vi } from "vitest";
import { getObject } from "@/lib/storage";
import { parseSpreadsheet } from "../parser";
import { mapColumns, validateRow } from "../validator";
import { findExistingDuplicates } from "@/lib/data-quality/duplicates";
import { referenceFingerprint } from "../reference-fingerprint";
import { processImportBatch } from "../worker";

const db = vi.hoisted(() => ({
  importBatch: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  emissionCategory: { findMany: vi.fn() },
  facility: { findMany: vi.fn() },
  businessUnit: { findMany: vi.fn() },
  stagedActivityRecord: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/storage", () => ({ getObject: vi.fn(), putObject: vi.fn(), keys: { importErrors: vi.fn() } }));
vi.mock("../parser", () => ({ parseSpreadsheet: vi.fn() }));
vi.mock("../validator", () => ({ mapColumns: vi.fn(), validateRow: vi.fn(), buildErrorCsv: vi.fn() }));
vi.mock("../profiles", () => ({ applyProfile: vi.fn(), profileSpecSchema: { parse: vi.fn() }, PROFILED_COLUMN_MAP: new Map() }));
vi.mock("@/lib/data-quality/duplicates", () => ({ duplicateKey: vi.fn(), findExistingDuplicates: vi.fn() }));
vi.mock("@/lib/jobs/dispatch", () => ({ dispatchNotification: vi.fn() }));

const CATEGORIES = [{ id: "c1", code: "s1-stationary" }];
const ROW_COUNT = 1200; // three staging chunks of 500

function batch(over: { lastProcessedRowIndex?: number | null; referenceFingerprint?: string | null } = {}) {
  return {
    sourceStorageKey: "org/org1/imports/b1/source.csv",
    sourceFilename: "data.csv",
    reportingPeriodId: "p1",
    organizationId: "org1",
    mapping: null,
    profileSnapshot: null,
    lastProcessedRowIndex: null,
    referenceFingerprint: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.importBatch.updateMany.mockResolvedValue({ count: 1 });
  db.importBatch.update.mockResolvedValue({ createdByUserId: null });
  db.importBatch.findUniqueOrThrow.mockResolvedValue(batch());
  db.emissionCategory.findMany.mockResolvedValue(CATEGORIES);
  db.facility.findMany.mockResolvedValue([]);
  db.businessUnit.findMany.mockResolvedValue([]);
  db.stagedActivityRecord.deleteMany.mockResolvedValue({ count: 0 });
  db.stagedActivityRecord.createMany.mockResolvedValue({ count: 0 });
  db.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
  vi.mocked(getObject).mockResolvedValue(Buffer.from("") as never);
  vi.mocked(parseSpreadsheet).mockResolvedValue({ headers: [], rows: Array.from({ length: ROW_COUNT }, () => ({})) } as never);
  vi.mocked(mapColumns).mockReturnValue(new Map());
  vi.mocked(validateRow).mockImplementation(() => ({ data: {}, errors: [], warnings: [] }) as never);
  vi.mocked(findExistingDuplicates).mockResolvedValue(new Map() as never);
});

describe("processImportBatch staging", () => {
  it("refunds the claim when a yield keeps the rows it staged", async () => {
    await expect(processImportBatch("b1", "org1", { budgetMs: 0 })).resolves.toBe("partial");
    expect(db.stagedActivityRecord.createMany).toHaveBeenCalledTimes(1);
    expect(db.importBatch.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { processingAttempts: { decrement: 1 } } }),
    );
  });

  it("resumes from the cursor while the reference data is unchanged", async () => {
    const fingerprint = referenceFingerprint({ categories: CATEGORIES, facilities: [], businessUnits: [] });
    db.importBatch.findUniqueOrThrow.mockResolvedValue(batch({ lastProcessedRowIndex: 500, referenceFingerprint: fingerprint }));
    await processImportBatch("b1", "org1", { budgetMs: 0 });
    expect(db.stagedActivityRecord.deleteMany).not.toHaveBeenCalled();
    expect(db.stagedActivityRecord.createMany.mock.calls[0][0].data[0].rowNumber).toBe(502);
  });

  it("restarts from row 0 and does not refund when the reference data changed", async () => {
    db.importBatch.findUniqueOrThrow.mockResolvedValue(batch({ lastProcessedRowIndex: 500, referenceFingerprint: "stale" }));
    await processImportBatch("b1", "org1", { budgetMs: 0 });
    expect(db.stagedActivityRecord.deleteMany).toHaveBeenCalledTimes(1);
    expect(db.stagedActivityRecord.createMany.mock.calls[0][0].data[0].rowNumber).toBe(2);
    expect(db.importBatch.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { processingAttempts: { decrement: 1 } } }),
    );
  });
});
