import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "scope=1&categoryId=c1" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/orgs/o/dashboard",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { ActiveCrossFilters } from "../cross-filter";

beforeEach(() => nav.replace.mockClear());
afterEach(cleanup);

describe("ActiveCrossFilters", () => {
  it("shows nothing without chart filters", () => {
    const { container } = render(<ActiveCrossFilters chips={[]} recordsHref={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("clears one filter and keeps the rest, and links to the records behind them", () => {
    render(<ActiveCrossFilters chips={[{ key: "scope", label: "Scope 1" }, { key: "categoryId", label: "Mobile combustion" }]} recordsHref="/orgs/o/records?categoryId=c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Clear filter: Scope 1" }));
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/dashboard?categoryId=c1", { scroll: false });
    expect(screen.getByRole("link", { name: "Open the records behind this" }).getAttribute("href")).toBe("/orgs/o/records?categoryId=c1");
  });
});
