import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/orgs/o/dashboard",
}));

import { DashboardFilterBar } from "../dashboard-filter-bar";

beforeEach(() => nav.replace.mockClear());
afterEach(cleanup);

describe("DashboardFilterBar", () => {
  it("writes a chosen scope to the URL and keeps the other filters", () => {
    render(<DashboardFilterBar filters={{ contractId: "k1" }} />);
    fireEvent.change(screen.getByLabelText("Scope"), { target: { value: "2" } });
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/dashboard?contractId=k1&scope=2");
  });

  it("applies a supplier on Enter and a month when the field loses focus", () => {
    render(<DashboardFilterBar filters={{}} />);
    const supplier = screen.getByLabelText("Supplier") as HTMLInputElement;
    fireEvent.change(supplier, { target: { value: "Certas" } });
    fireEvent.keyDown(supplier, { key: "Enter" });
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/dashboard?supplier=Certas");
    const from = screen.getByLabelText("From month") as HTMLInputElement;
    fireEvent.change(from, { target: { value: "2026-03" } });
    fireEvent.blur(from);
    expect(nav.replace).toHaveBeenLastCalledWith("/orgs/o/dashboard?from=2026-03");
  });

  it("says what the filters cover and clears only its own", () => {
    render(<DashboardFilterBar filters={{ facilityId: "f1", scope: "1", supplier: "cert" }} />);
    expect(screen.getByText(/stay organisation-wide/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear these" }));
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/dashboard?facilityId=f1");
  });

  it("shows no note when no slice filter is set", () => {
    render(<DashboardFilterBar filters={{ facilityId: "f1" }} />);
    expect(screen.queryByText(/organisation-wide/)).toBeNull();
  });

  it("leaves the project choice to the site hero and writes the social value switch to the URL", () => {
    render(<DashboardFilterBar filters={{}} />);
    expect(screen.queryByLabelText("Project")).toBeNull();
    const sv = screen.getByLabelText("Contracts with social value commitments") as HTMLInputElement;
    fireEvent.click(sv);
    expect(sv.checked).toBe(true);
    expect(nav.replace).toHaveBeenLastCalledWith("/orgs/o/dashboard?sv=1");
  });

  it("hides the project list when there are no projects and says social value is shown beside", () => {
    render(<DashboardFilterBar filters={{ sv: "1" }} socialValue={{ contracts: 2, commitments: 3, gbpValue: "£12,000", otherCurrency: 0 }} />);
    expect(screen.queryByLabelText("Project")).toBeNull();
    expect(screen.getByText(/Social value on 2 contracts: 3 commitments, £12,000 committed \(GBP\)/)).toBeTruthy();
    expect(screen.getByText(/never added to them/)).toBeTruthy();
  });
});
