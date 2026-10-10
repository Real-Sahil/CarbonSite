import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { KpiStatRow, type KpiStat } from "../kpi-stat-row";
import { formatKpi } from "../kpi-format";

const co2e = { kind: "co2e", locale: "en-GB" } as const;
const scopes = { kind: "scopes", of: 3 } as const;
const percent = { kind: "percent" } as const;

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => stubReducedMotion(true));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("KpiStatRow", () => {
  it("shows the formatted value straight away when reduced motion is on", () => {
    const stats: KpiStat[] = [{ label: "Total emissions", value: 1234.4, format: co2e }];
    render(<KpiStatRow stats={stats} />);
    expect(screen.getByText("Total emissions")).toBeTruthy();
    expect(screen.getByText("1.23 tCO₂e")).toBeTruthy();
  });

  it("says No data when a value is missing, and never invents one", () => {
    render(<KpiStatRow stats={[{ label: "Diversion", value: null, format: percent }]} />);
    expect(screen.getByText("No data")).toBeTruthy();
  });

  it("colours a rise green when up is good and red when up is bad", () => {
    render(
      <KpiStatRow
        stats={[
          { label: "Diversion", value: 80, format: percent, delta: { value: 5, label: "+5 pts" }, goodUp: true },
          { label: "Emissions", value: 100, format: percent, delta: { value: 5, label: "+5%" }, goodUp: false },
        ]}
      />,
    );
    const good = screen.getByText("+5 pts").closest("span") as HTMLElement;
    const bad = screen.getByText("+5%").closest("span") as HTMLElement;
    expect(good.className).toContain("text-[#047857]");
    expect(bad.className).toContain("text-[#B91C1C]");
  });

  it("shows no chip when there is no comparison", () => {
    const { container } = render(<KpiStatRow stats={[{ label: "Records", value: 3, format: scopes }]} />);
    expect(container.querySelectorAll("span.rounded-full").length).toBe(0);
  });
});

describe("formatKpi", () => {
  it("shows kg below a tonne and t from a tonne up", () => {
    expect(formatKpi(co2e, 0)).toBe("0 kgCO₂e");
    expect(formatKpi(co2e, 999.4)).toBe("999.4 kgCO₂e");
    expect(formatKpi(co2e, 1234.4)).toBe("1.23 tCO₂e");
  });

  it("signs a percent change and counts scopes against the total", () => {
    expect(formatKpi(percent, 4.25)).toBe("+4.3%");
    expect(formatKpi(percent, -2)).toBe("-2.0%");
    expect(formatKpi(scopes, 2)).toBe("2/3");
  });
});
