import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { OrgSidebar } from "../org-sidebar";
import { SiteNav } from "../marketing/site-nav";

const nav = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode; prefetch?: boolean }) => {
    const { prefetch: _prefetch, ...anchor } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean };
    return <a href={href} {...anchor}>{children}</a>;
  },
}));

vi.mock("@/lib/auth/client", () => ({ authClient: { signOut: vi.fn() } }));
vi.mock("@/components/notification-bell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/org/project-switcher", () => ({ ProjectSwitcher: () => null }));
vi.mock("@/components/ui/logo", () => ({ LogoMark: () => null }));

afterEach(cleanup);

describe("mobile menus close once a link is chosen", () => {
  it("org app drawer closes when a page is chosen", () => {
    nav.pathname = "/orgs/org_1/dashboard";
    render(<OrgSidebar orgId="org_1" orgName="Acme Ltd" user={{ name: "Pat Example", email: "pat@example.test" }} role="admin" />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    // The desktop sidebar renders the same nav; the drawer is the one in the fixed overlay.
    const drawer = screen.getAllByRole("navigation", { name: "Organisation navigation" }).find((nav) => nav.closest(".fixed"));
    if (!drawer) throw new Error("drawer did not open");
    fireEvent.click(within(drawer).getByRole("link", { name: "Records" }));

    expect(screen.queryByRole("button", { name: "Close menu" })).toBeNull();
  });

  it("marketing menu closes when a same-page link is chosen", () => {
    nav.pathname = "/product";
    render(<SiteNav />);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("link", { name: "Evidence capture" }));

    expect(screen.queryByRole("button", { name: "Close menu" })).toBeNull();
  });
});
