import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  evidenceFile: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  putObject: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { evidenceFile: h.evidenceFile } }));
vi.mock("@/lib/storage", () => ({
  keys: { evidence: (orgId: string, id: string, name: string) => `org/${orgId}/evidence/${id}/${name}` },
  putObject: h.putObject,
}));

import { storeEvidenceFile } from "../store";

const file = { name: "ticket.pdf", type: "application/pdf", buffer: Buffer.from("weighbridge ticket") };
const KEY = "org/org-a/evidence/ev1/ticket.pdf";

beforeEach(() => {
  vi.clearAllMocks();
  h.evidenceFile.findFirst.mockResolvedValue(null);
  h.evidenceFile.create.mockResolvedValue({ id: "ev1" });
  h.evidenceFile.update.mockResolvedValue({ id: "ev1" });
  h.evidenceFile.delete.mockResolvedValue({ id: "ev1" });
  h.putObject.mockResolvedValue(undefined);
});

describe("storeEvidenceFile", () => {
  it("writes the bytes, then points the row at them", async () => {
    expect(await storeEvidenceFile("org-a", "u1", file)).toEqual({ id: "ev1", duplicate: false });
    expect(h.putObject).toHaveBeenCalledWith(KEY, file.buffer, "application/pdf");
    expect(h.evidenceFile.update).toHaveBeenCalledWith({ where: { id: "ev1" }, data: { storageKey: KEY } });
    expect(h.evidenceFile.delete).not.toHaveBeenCalled();
  });

  it("removes the pending row when the write fails, and rethrows the original error", async () => {
    const err = new Error("bucket unavailable");
    h.putObject.mockRejectedValueOnce(err);
    await expect(storeEvidenceFile("org-a", "u1", file)).rejects.toBe(err);
    expect(h.evidenceFile.delete).toHaveBeenCalledWith({ where: { id: "ev1" } });
    expect(h.evidenceFile.update).not.toHaveBeenCalled();
  });

  it("reuses an identical file already stored", async () => {
    h.evidenceFile.findFirst.mockResolvedValue({
      id: "old",
      storageKey: "org/org-a/evidence/old/ticket.pdf",
      mimeType: "application/pdf",
    });
    expect(await storeEvidenceFile("org-a", "u1", file)).toEqual({ id: "old", duplicate: true });
    expect(h.evidenceFile.create).not.toHaveBeenCalled();
  });
});
