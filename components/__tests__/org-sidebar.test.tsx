import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OrgSidebar } from "../org-sidebar";

const nav = vi.hoisted(() => ({ pathname: "/", mounts: 0 }));

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

// Counts mounts: a remounting sidebar re-runs this effect, so the count rises.
vi.mock("@/components/notification-bell", async () => {
  const React = await import("react");
  return {
    NotificationBell: () => {
      React.useEffect(() => {
        nav.mounts += 1;
      }, []);
      return null;
    },
  };
});

vi.mock("@/components/org/project-switcher", () => ({ ProjectSwitcher: () => null }));
vi.mock("@/components/ui/logo", () => ({ LogoMark: () => null }));

const ORG = "org_1";
const ALL_PAGES_KEY = "metricora:sidebar:all-pages";

function renderSidebar(role: string, pathname = `/orgs/${ORG}/dashboard`) {
  nav.pathname = pathname;
  return render(
    <OrgSidebar orgId={ORG} orgName="Acme Ltd" user={{ name: "Pat Example", email: "pat@example.test" }} role={role} />,
  );
}

function dashboardLink() {
  return screen.getByRole("link", { name: "Dashboard" });
}

describe("OrgSidebar navigation identity", () => {
  beforeEach(() => {
    localStorage.clear();
    nav.mounts = 0;
  });

  it("keeps the Dashboard link and the header bell mounted when a section is folded", () => {
    localStorage.setItem(ALL_PAGES_KEY, "true");
    renderSidebar("admin");

    const linkBefore = dashboardLink();
    const mountsBefore = nav.mounts;

    fireEvent.click(screen.getByRole("button", { name: "Data" }));

    expect(dashboardLink()).toBe(linkBefore);
    expect(nav.mounts).toBe(mountsBefore);
  });

  it("keeps keyboard focus on a section toggle", () => {
    localStorage.setItem(ALL_PAGES_KEY, "true");
    renderSidebar("admin");

    const toggle = screen.getByRole("button", { name: "Data" });
    toggle.focus();
    fireEvent.click(toggle);

    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("OrgSidebar active state and roles", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("marks the current route's link as active and leaves other links inactive", () => {
    localStorage.setItem(ALL_PAGES_KEY, "true");
    renderSidebar("admin", `/orgs/${ORG}/records`);

    const records = screen.getByRole("link", { name: "Records" });
    const imports = screen.getByRole("link", { name: "Imports" });

    expect(records.className).toContain("font-medium");
    expect(imports.className).not.toContain("font-medium");
  });

  it("hides admin-only pages and the empty Admin group from a viewer on the full menu", () => {
    localStorage.setItem(ALL_PAGES_KEY, "true");
    renderSidebar("viewer");

    expect(screen.getByRole("link", { name: "Records" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Admin" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Suppliers" })).toBeNull();
  });

  it("shows admin-only pages to an admin on the full menu", () => {
    localStorage.setItem(ALL_PAGES_KEY, "true");
    renderSidebar("admin");

    fireEvent.click(screen.getByRole("button", { name: "Admin" }));
    expect(screen.getByRole("link", { name: "Suppliers" })).toBeTruthy();
  });

  it("starts a viewer on the short menu with job-based groups and a way out to all pages", () => {
    renderSidebar("viewer");

    expect(screen.getByRole("button", { name: "Add data" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Show all pages/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "MetricOra" })).toBeNull();
  });

  it("switches a viewer from the short menu to the full menu and back", () => {
    renderSidebar("viewer");

    fireEvent.click(screen.getByRole("button", { name: /Show all pages/ }));
    expect(screen.getByRole("button", { name: "MetricOra" })).toBeTruthy();
    expect(localStorage.getItem(ALL_PAGES_KEY)).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: /Show the short menu/ }));
    expect(screen.queryByRole("button", { name: "MetricOra" })).toBeNull();
    expect(localStorage.getItem(ALL_PAGES_KEY)).toBe("false");
  });
});
