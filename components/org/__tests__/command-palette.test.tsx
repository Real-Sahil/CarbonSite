import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push }) }));

import { CommandPalette } from "../command-palette";

const fetchMock = vi.fn();
beforeEach(() => {
  nav.push.mockClear();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () => ({ views: url.includes("surface=records") ? [{ id: "v1", name: "Approved only", surface: "records", shared: false, href: "/orgs/o/records?reviewStatus=approved" }] : [] }),
  }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(cleanup);

const open = () => fireEvent.keyDown(window, { key: "k", ctrlKey: true });

describe("CommandPalette", () => {
  it("opens with Ctrl+K, filters pages by role and goes to one with Enter", async () => {
    render(<CommandPalette orgId="o" role="viewer" canUseViews={false} />);
    open();
    const box = await screen.findByRole("combobox");
    expect(screen.queryByText("Settings")).toBeNull();
    fireEvent.change(box, { target: { value: "rec" } });
    expect(screen.getByRole("option", { name: /Records/ })).toBeTruthy();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(nav.push).toHaveBeenCalledWith("/orgs/o/records");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("finds a saved view and opens its address", async () => {
    render(<CommandPalette orgId="o" role="admin" canUseViews />);
    open();
    const box = await screen.findByRole("combobox");
    fireEvent.change(box, { target: { value: "approved" } });
    await waitFor(() => expect(screen.getByRole("option", { name: /Approved only/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: /Approved only/ }));
    expect(nav.push).toHaveBeenCalledWith("/orgs/o/records?reviewStatus=approved");
  });

  it("says when nothing matches and moves the choice with the arrow keys", async () => {
    render(<CommandPalette orgId="o" role="admin" canUseViews={false} />);
    open();
    const box = await screen.findByRole("combobox");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.change(box, { target: { value: "zzzz" } });
    expect(screen.getByText("Nothing matches.")).toBeTruthy();
  });
});
