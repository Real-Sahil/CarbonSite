import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/orgs/o/suppliers",
}));

import { SuppliersFilters } from "../suppliers-filters";

beforeEach(() => nav.replace.mockClear());
afterEach(cleanup);

describe("SuppliersFilters", () => {
  it("writes health and trend to the URL, keeping the rest", () => {
    render(<SuppliersFilters filters={{ q: "acme" }} />);
    fireEvent.change(screen.getByLabelText("Health"), { target: { value: "critical" } });
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/suppliers?q=acme&health=critical");
    fireEvent.change(screen.getByLabelText("Trend"), { target: { value: "declining" } });
    expect(nav.replace).toHaveBeenLastCalledWith("/orgs/o/suppliers?q=acme&trend=declining");
  });

  it("lists the health bands with the labels the table uses", () => {
    render(<SuppliersFilters filters={{ health: "at_risk" }} />);
    expect((screen.getByLabelText("Health") as HTMLSelectElement).value).toBe("at_risk");
    for (const name of ["Healthy", "At risk", "Critical"]) expect(screen.getByRole("option", { name })).toBeTruthy();
  });

  it("applies the name search on Enter and clears all filters", () => {
    render(<SuppliersFilters filters={{ trend: "stable" }} />);
    const input = screen.getByLabelText("Supplier");
    fireEvent.change(input, { target: { value: " Brick " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/suppliers?trend=stable&q=Brick");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/orgs/o/suppliers");
  });
});
