import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: nav.refresh }) }));

import { DashboardGrid, type GridWidget } from "../dashboard-grid";

const widgets: GridWidget[] = [
  { id: "headline", title: "Footprint and key figures", width: "full", hidden: false, node: <p>HEADLINE</p> },
  { id: "facilities", title: "By facility", width: "half", hidden: false, node: <p>FACILITIES</p> },
  { id: "ops-health", title: "Operations health", width: "half", hidden: true, node: <p>OPSHEALTH</p> },
];
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  nav.refresh.mockClear();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

describe("DashboardGrid", () => {
  it("shows only visible widgets and says where the layout comes from", () => {
    render(<DashboardGrid orgId="o" widgets={widgets} isAdmin={false} source="preset" />);
    expect(screen.getByText("HEADLINE")).toBeTruthy();
    expect(screen.queryByText("OPSHEALTH")).toBeNull();
    expect(screen.getByText("Default layout for your role")).toBeTruthy();
  });

  it("hides a widget, offers it under Add widget, and saves the arrangement to the caller's own layout", async () => {
    render(<DashboardGrid orgId="o" widgets={widgets} isAdmin={false} source="personal" />);
    fireEvent.click(screen.getByRole("button", { name: "Customise dashboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide By facility" }));
    expect(screen.queryByText("FACILITIES")).toBeNull();
    fireEvent.change(screen.getByLabelText("Add widget"), { target: { value: "ops-health" } });
    expect(screen.getByText("OPSHEALTH")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Operations health: make it full width" }));
    fireEvent.click(screen.getByRole("button", { name: "Save my layout" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/orgs/o/dashboard-layout");
    const body = JSON.parse(init.body);
    expect(body.scope).toBe("personal");
    expect(body.layout.hidden).toEqual(["facilities"]);
    expect(body.layout.order).toEqual(["headline", "facilities", "ops-health"]);
    expect(body.layout.widths["ops-health"]).toBe("full");
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
  });

  it("offers the organisation default only to admins", () => {
    const { unmount } = render(<DashboardGrid orgId="o" widgets={widgets} isAdmin={false} source="preset" />);
    fireEvent.click(screen.getByRole("button", { name: "Customise dashboard" }));
    expect(screen.queryByRole("button", { name: "Save as organisation default" })).toBeNull();
    unmount();
    render(<DashboardGrid orgId="o" widgets={widgets} isAdmin source="preset" />);
    fireEvent.click(screen.getByRole("button", { name: "Customise dashboard" }));
    expect(screen.getByRole("button", { name: "Save as organisation default" })).toBeTruthy();
  });

  it("cancel throws the edits away and a failed save keeps the editor open with the reason", async () => {
    render(<DashboardGrid orgId="o" widgets={widgets} isAdmin={false} source="preset" />);
    fireEvent.click(screen.getByRole("button", { name: "Customise dashboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide By facility" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("FACILITIES")).toBeTruthy();
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ message: "Nope." }) });
    fireEvent.click(screen.getByRole("button", { name: "Customise dashboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Save my layout" }));
    await waitFor(() => expect(screen.getByText("Nope.")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Save my layout" })).toBeTruthy();
  });
});
