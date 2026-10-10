import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/orgs/o/records",
}));

import { RecordsFilters } from "../records-filters";

const props = {
  periods: [{ id: "p1", label: "FY2026" }],
  categories: [{ id: "c1", label: "Scope 1: Fuel" }],
  facilities: [{ id: "f1", label: "Depot" }],
  contracts: [{ id: "k1", label: "Bridge" }],
  sites: [{ id: "s1", label: "Bridge works" }],
};

beforeEach(() => nav.replace.mockClear());
afterEach(cleanup);

describe("RecordsFilters", () => {
  it("writes a chosen filter to the URL, keeping the others", () => {
    render(<RecordsFilters {...props} filters={{ facilityId: "f1" }} />);
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "p1" } });
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/records?facilityId=f1&periodId=p1");
  });

  it("removes a filter when All is chosen, and the bare path when none is left", () => {
    render(<RecordsFilters {...props} filters={{ periodId: "p1" }} />);
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "" } });
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/records");
  });

  it("shows the current values and a status list with plain labels", () => {
    render(<RecordsFilters {...props} filters={{ reviewStatus: "pending_info", contractId: "k1" }} />);
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("pending_info");
    expect(screen.getByRole("option", { name: "Needs information" })).toBeTruthy();
    expect((screen.getByLabelText("Contract") as HTMLSelectElement).value).toBe("k1");
  });

  it("applies the supplier text on Enter and clears everything with Clear filters", () => {
    render(<RecordsFilters {...props} filters={{ periodId: "p1" }} />);
    const input = screen.getByLabelText("Supplier");
    fireEvent.change(input, { target: { value: "  Acme " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/records?periodId=p1&supplier=Acme");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/orgs/o/records");
  });

  it("offers no Clear button when nothing is filtered", () => {
    render(<RecordsFilters {...props} filters={{}} />);
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });
});
