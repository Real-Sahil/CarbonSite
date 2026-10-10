import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/orgs/o/dashboard",
}));

import { SiteHero } from "../site-hero";

const office = { id: "f1", name: "Leeds depot", kind: "facility" as const, latitude: 53.8, longitude: -1.55, kg: 120000, recordCount: 4, projectId: null, detail: null };
const site = { id: "s1", name: "Bridge works", kind: "site" as const, latitude: 53.7, longitude: -1.5, kg: 40000, recordCount: 2, projectId: "p1", detail: "Bridge (Network Rail)" };
const noProject = { id: "s9", name: "Unassigned yard", kind: "site" as const, latitude: null, longitude: null, kg: 0, recordCount: 0, projectId: null, detail: null };
const projects = [{ id: "p1", label: "Bridge (Network Rail)" }];

const base = { orgId: "o", projects, filters: {}, periodLabel: "FY2026", locale: "en-GB", failed: false };

beforeEach(() => {
  nav.replace.mockClear();
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({})));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SiteHero", () => {
  it("lists sites biggest first with live figures, and says they are live", () => {
    render(<SiteHero {...base} sites={[site, office]} />);
    const rows = within(screen.getByRole("list", { name: "Sites by emissions" })).getAllByRole("button");
    expect(rows[0].textContent).toContain("Leeds depot");
    expect(rows[0].textContent).toContain("120 tCO₂e");
    expect(screen.getByText(/Live figures for FY2026/)).toBeTruthy();
  });

  it("choosing a project site filters by that one site and keeps other filters", () => {
    render(<SiteHero {...base} sites={[site]} filters={{ scope: "1" }} />);
    fireEvent.click(within(screen.getByRole("list", { name: "Sites by emissions" })).getByRole("button", { name: /Bridge works/ }));
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/dashboard?scope=1&siteId=s1");
  });

  it("choosing the active site clears it, and the Clear control does the same", () => {
    render(<SiteHero {...base} sites={[office]} filters={{ facilityId: "f1" }} />);
    expect(screen.getByText(/Showing/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/dashboard");
  });

  it("lets a site with no project be chosen too", () => {
    render(<SiteHero {...base} sites={[noProject]} />);
    const row = within(screen.getByRole("list", { name: "Sites by emissions" })).getByRole("button", { name: /Unassigned yard/ });
    expect((row as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(row);
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/dashboard?siteId=s9");
  });

  it("keeps the project fallback working without any placed site", () => {
    render(<SiteHero {...base} sites={[noProject]} />);
    fireEvent.change(screen.getByLabelText("Choose a project"), { target: { value: "p1" } });
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/dashboard?projectId=p1");
  });

  it("says when the figures could not load, instead of showing zeros", () => {
    render(<SiteHero {...base} sites={[]} failed />);
    expect(screen.getByRole("status").textContent).toContain("could not be loaded");
    expect(screen.queryByText("0 tCO₂e")).toBeNull();
  });

  it("points to Settings when the organisation has no sites yet", () => {
    render(<SiteHero {...base} sites={[]} />);
    expect(screen.getByRole("link", { name: /Add one in Settings/ }).getAttribute("href")).toBe("/orgs/o/settings/operations");
  });
});
