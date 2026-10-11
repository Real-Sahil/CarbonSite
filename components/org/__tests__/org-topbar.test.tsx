import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { THEME_ATTRIBUTE } from "@/lib/theme/preference";
import { OrgTopBar } from "../org-topbar";

const signOut = vi.hoisted(() => vi.fn(async () => undefined));
const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

vi.mock("@/lib/auth/client", () => ({ authClient: { signOut } }));

vi.mock("@/components/notification-bell", () => ({
  NotificationBell: ({ orgId }: { orgId: string }) => <button type="button" data-testid="bell">Notifications {orgId}</button>,
}));

const ORG = "org_1";

describe("OrgTopBar", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
  });

  it("puts a light/dark toggle beside the bell, and saves the flip to the person's account", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetchMock);
    render(<OrgTopBar orgId={ORG} user={{ name: "Pat Example", email: "pat@example.test" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/me/theme", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ theme: "dark" }) })));
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe("dark");
    expect(await screen.findByRole("button", { name: "Switch to light theme" })).toBeTruthy();
  });

  it("puts the theme back when the save does not go through", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as Response));
    render(<OrgTopBar orgId={ORG} user={{ name: "Pat Example", email: "pat@example.test" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));

    await waitFor(() => expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBeNull());
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeTruthy();
  });

  it("is a desktop-only bar that carries the account trigger and the bell", () => {
    render(<OrgTopBar orgId={ORG} user={{ name: "Pat Example", email: "pat@example.test" }} />);

    const header = screen.getByRole("banner");
    expect(header.className).toContain("hidden");
    expect(header.className).toContain("md:flex");
    expect(screen.getByRole("button", { name: /Pat Example/ })).toBeTruthy();
    expect(screen.getByTestId("bell").textContent).toContain(ORG);
  });

  it("offers members and settings, then sign out, from the account menu", () => {
    render(<OrgTopBar orgId={ORG} user={{ name: "Pat Example", email: "pat@example.test" }} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: /Pat Example/ }), { button: 0, ctrlKey: false });

    const members = screen.getByRole("menuitem", { name: /Members and settings/ });
    expect(members.getAttribute("href")).toBe(`/orgs/${ORG}/settings/members`);
    expect(screen.getByRole("menuitem", { name: /Sign out/ })).toBeTruthy();
  });

  it("falls back to the email when the account has no name", () => {
    render(<OrgTopBar orgId={ORG} user={{ name: null, email: "pat@example.test" }} />);

    expect(screen.getByRole("button", { name: /pat@example.test/ })).toBeTruthy();
  });
});
