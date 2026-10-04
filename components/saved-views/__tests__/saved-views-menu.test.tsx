import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { SavedViewsMenu } from "../saved-views-menu";

const views = [
  { id: "v1", name: "GB sites", shared: false, filters: { country: "GB" }, ownedByMe: true, ownerName: null, href: "/orgs/o/dashboard?country=GB" },
  { id: "v2", name: "Board pack", shared: true, filters: { contractId: "c1" }, ownedByMe: false, ownerName: "Ana", href: "/orgs/o/dashboard?contractId=c1" },
];

function renderMenu(props: Partial<React.ComponentProps<typeof SavedViewsMenu>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SavedViewsMenu orgId="o" surface="dashboard" filters={{ country: "AE" }} canShare={false} isAdmin={false} {...props} />
    </QueryClientProvider>,
  );
}

/** Radix opens a dropdown from the keyboard, which jsdom supports. */
async function openMenu() {
  const trigger = await screen.findByRole("button", { name: /views/i });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
}

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") return new Response(JSON.stringify({ view: { id: "v3" } }), { status: 201 });
    return new Response(JSON.stringify({ views }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SavedViewsMenu", () => {
  it("lists my views and shared ones, and opens a view by its link", async () => {
    renderMenu();
    await openMenu();
    expect(await screen.findByText("GB sites")).toBeTruthy();
    expect(screen.getByText("Board pack")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
    fireEvent.click(screen.getByText("GB sites"));
    expect(push).toHaveBeenCalledWith("/orgs/o/dashboard?country=GB");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/orgs/o/saved-views?surface=dashboard");
  });

  it("offers delete only on views the caller may delete", async () => {
    renderMenu();
    await openMenu();
    await screen.findByText("GB sites");
    expect(screen.getByRole("menuitem", { name: "Delete view GB sites" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Delete view Board pack" })).toBeNull();
    cleanup();
    renderMenu({ isAdmin: true });
    await openMenu();
    expect(await screen.findByRole("menuitem", { name: "Delete view Board pack" })).toBeTruthy();
  });

  it("saves the current filters, and only offers sharing to those who may share", async () => {
    renderMenu();
    await openMenu();
    fireEvent.click(await screen.findByText(/Save current filters/));
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "UAE sites" } });
    expect(screen.queryByLabelText("Share with the organisation")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(true));
    const post = fetchMock.mock.calls.find((c) => c[1]?.method === "POST")!;
    expect(JSON.parse(post[1].body)).toEqual({ surface: "dashboard", name: "UAE sites", filters: { country: "AE" }, shared: false });
  });

  it("will not save with no filters set", async () => {
    renderMenu({ filters: {} });
    await openMenu();
    const item = await screen.findByText(/Save current filters/);
    expect(item.closest("[role=menuitem]")?.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(/Choose a filter first/)).toBeTruthy();
  });
});
