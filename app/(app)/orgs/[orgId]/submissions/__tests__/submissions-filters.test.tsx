import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/orgs/o/submissions",
}));

import { SubmissionsFilters } from "../submissions-filters";

const lists = {
  periods: [{ id: "p1", label: "FY2026" }],
  facilities: [{ id: "f1", label: "Depot" }],
  contracts: [{ id: "k1", label: "Bridge" }],
};

beforeEach(() => nav.replace.mockClear());
afterEach(cleanup);

describe("SubmissionsFilters", () => {
  it("writes a choice to the URL and keeps the status tab's filter", () => {
    render(<SubmissionsFilters filters={{ status: "approved" }} {...lists} />);
    fireEvent.change(screen.getByLabelText("Document type"), { target: { value: "fuel_receipt" } });
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/submissions?status=approved&documentType=fuel_receipt");
  });

  it("lists every document type with a plain label", () => {
    render(<SubmissionsFilters filters={{}} {...lists} />);
    for (const name of ["Waste ticket", "Delivery note", "Fuel receipt", "Water meter reading", "Social value", "Hazard report", "Site inspection", "Other"]) {
      expect(screen.getByRole("option", { name })).toBeTruthy();
    }
  });

  it("offers Clear filters only for filters other than status, and keeps status when clearing", () => {
    const { rerender } = render(<SubmissionsFilters filters={{ status: "approved" }} {...lists} />);
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
    rerender(<SubmissionsFilters filters={{ status: "approved", facilityId: "f1" }} {...lists} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/submissions?status=approved");
  });

  it("clears to the bare path when status is not set", () => {
    render(<SubmissionsFilters filters={{ contractId: "k1" }} {...lists} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/submissions");
  });
});
