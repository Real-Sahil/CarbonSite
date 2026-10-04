import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

import { RecordPanel } from "../record-panel";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

const detail = {
  sourceDescription: "Depot diesel", supplierName: "Certas", amount: "14000", unit: "litres", reviewStatus: "in_review", evidenceStatus: "complete",
  emissionCategory: { scope: 1, name: "Mobile combustion" }, reportingPeriod: { label: "FY2025" }, facility: { name: "Bristol yard" },
  evidence: [{ evidenceFile: { id: "e1", filename: "bill.pdf" } }],
  calculations: [{ id: "c1", totalCo2e: "35991.48", formula: "14000 x 2.57 kg", selectionReason: "DEFRA 2025 diesel", factorLibraryVersion: "2025.2", warnings: ["Unverified factor"] }],
};

describe("RecordPanel", () => {
  it("loads the record when opened and shows the calculation, evidence and a link to the full record", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => detail });
    render(<RecordPanel orgId="o" recordId="r1" label="Depot diesel" />);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Details: Depot diesel" }));
    await waitFor(() => expect(screen.getByText("35.991 tCO₂e")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/orgs/o/activity-records/r1");
    expect(screen.getByText("14000 x 2.57 kg")).toBeTruthy();
    expect(screen.getByText("Unverified factor")).toBeTruthy();
    expect(screen.getByText("bill.pdf")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open full record" }).getAttribute("href")).toBe("/orgs/o/records/r1");
  });

  it("says so when the record cannot be loaded", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<RecordPanel orgId="o" recordId="r1" label="Depot diesel" />);
    fireEvent.click(screen.getByRole("button", { name: "Details: Depot diesel" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Could not load the record."));
  });
});
