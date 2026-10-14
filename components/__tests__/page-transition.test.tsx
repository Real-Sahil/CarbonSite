import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PageTransition } from "../page-transition";

const nav = vi.hoisted(() => ({ pathname: "/orgs/org_1/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

const page = () => (
  <PageTransition>
    <p>page</p>
  </PageTransition>
);

let scrollTo: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.history.replaceState(null, "", "/orgs/org_1/dashboard");
  nav.pathname = "/orgs/org_1/dashboard";
  scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PageTransition scroll reset", () => {
  it("does not scroll on first mount", () => {
    render(page());
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("does not scroll on first mount under StrictMode's double effects", () => {
    render(<StrictMode>{page()}</StrictMode>);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("starts a new page at the top", () => {
    const { rerender } = render(page());
    nav.pathname = "/orgs/org_1/records";
    rerender(page());
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("keeps the position for a hash link", () => {
    const { rerender } = render(page());
    window.history.pushState(null, "", "/orgs/org_1/records#filters");
    nav.pathname = "/orgs/org_1/records";
    rerender(page());
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("keeps the browser's position on Back/Forward, then resumes on the next push", () => {
    const { rerender } = render(page());
    window.history.replaceState(null, "", "/orgs/org_1/records");
    window.dispatchEvent(new PopStateEvent("popstate"));
    nav.pathname = "/orgs/org_1/records";
    rerender(page());
    expect(scrollTo).not.toHaveBeenCalled();

    window.history.pushState(null, "", "/orgs/org_1/imports");
    nav.pathname = "/orgs/org_1/imports";
    rerender(page());
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
