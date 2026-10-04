import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

import { SiteMap } from "../site-map";

const snapshots = [
  { id: "s1", label: "FY2024 v1", version: 1, publishedAt: "2025-02-01T00:00:00Z", periodStart: "2024-01-01T00:00:00Z" },
  { id: "s2", label: "FY2025 v1", version: 1, publishedAt: "2026-02-01T00:00:00Z", periodStart: "2025-01-01T00:00:00Z" },
];
const latest = [
  { id: "f1", name: "Leeds depot", latitude: 53.8, longitude: -1.55, kg: 60000, recordCount: 4 },
  { id: "f2", name: "Bristol yard", latitude: null, longitude: null, kg: 40000, recordCount: 2 },
];
const earlier = [{ id: "f1", name: "Leeds depot", latitude: 53.8, longitude: -1.55, kg: 90000, recordCount: 5 }];
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sites: earlier }) });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

const view = () => render(<SiteMap orgId="o" snapshots={snapshots} initialSnapshotId="s2" initialSites={latest} styleUrl={null} locale="en-GB" />);

describe("SiteMap", () => {
  it("without a tile source draws a schematic, sends no request, and lists the same figures in a table", () => {
    view();
    expect(screen.getByRole("img", { name: /Sites placed by latitude and longitude/ })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[1].textContent).toContain("Leeds depot");
    expect(rows[1].textContent).toContain("60");
    expect(rows[1].textContent).toContain("60%");
    expect(rows[2].textContent).toContain("Not placed");
    expect(screen.getByText(/1 site is not placed/)).toBeTruthy();
  });

  it("scrubbing to an earlier snapshot fetches it once, shows its figures and caches it", async () => {
    view();
    const slider = screen.getByRole("slider");
    expect((slider as HTMLInputElement).value).toBe("1");
    fireEvent.change(slider, { target: { value: "0" } });
    await waitFor(() => expect(screen.getByText(/Published snapshot: FY2024 v1/)).toBeTruthy());
    await waitFor(() => expect(within(screen.getByRole("table")).getAllByRole("row")[1].textContent).toContain("90"));
    expect(fetchMock).toHaveBeenCalledWith("/api/orgs/o/map-data?snapshotId=s1");
    fireEvent.click(screen.getByRole("button", { name: "Later snapshot" }));
    fireEvent.click(screen.getByRole("button", { name: "Earlier snapshot" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("says so when a snapshot cannot be loaded", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    view();
    fireEvent.click(screen.getByRole("button", { name: "Earlier snapshot" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Could not load this snapshot."));
  });

  it("explains how to place sites when none has a position", () => {
    render(<SiteMap orgId="o" snapshots={snapshots} initialSnapshotId="s2" initialSites={[{ ...latest[1] }]} styleUrl={null} locale="en-GB" />);
    expect(screen.getByText(/No site has a position yet/)).toBeTruthy();
  });
});
