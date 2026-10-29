import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// The street map is a dynamic import; stand in a stub that can report failure the way a failed style load does.
vi.mock("next/dynamic", () => ({
  default: () =>
    function TilesStub({ onFail }: { onFail: () => void }) {
      return (
        <button type="button" data-testid="tiles-stub" onClick={onFail}>
          street map
        </button>
      );
    },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/orgs/o1/dashboard" }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

import { SiteHero } from "@/components/dashboard/site-hero";

const sites = [
  { id: "a", name: "Alpha", latitude: 51.5, longitude: -0.1, kg: 4000, recordCount: 3, kind: "site" as const },
  { id: "b", name: "Bravo", latitude: 53.4, longitude: -2.2, kg: 1000, recordCount: 1, kind: "facility" as const },
];

function renderHero() {
  return render(<SiteHero orgId="o1" sites={sites} failed={false} projects={[]} filters={{}} periodLabel="2026" locale="en-GB" />);
}

describe("SiteHero street map fallback", () => {
  it("starts on the street map with its attribution caption", () => {
    renderHero();
    expect(screen.getByTestId("tiles-stub")).toBeTruthy();
    expect(screen.getByText(/Map data from OpenStreetMap contributors/)).toBeTruthy();
  });

  it("falls back to the schematic, and says so, when the street map reports failure", () => {
    renderHero();
    fireEvent.click(screen.getByTestId("tiles-stub"));
    expect(screen.queryByTestId("tiles-stub")).toBeNull();
    expect(screen.getByText(/The street map could not be loaded, so this is a schematic/)).toBeTruthy();
    expect(screen.queryByText(/Map data from OpenStreetMap contributors/)).toBeNull();
  });
});
