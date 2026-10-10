import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { KpiStatRow, type KpiStat } from "../kpi-stat-row";

const format = (n: number) => `${Math.round(n).toLocaleString("en-GB")} tCO₂e`;

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
    const stats: KpiStat[] = [{ label: "Total emissions", value: 1234.4, format }];
    render(<KpiStatRow stats={stats} />);
    expect(screen.getByText("Total emissions")).toBeTruthy();
    expect(screen.getByText("1,234 tCO₂e")).toBeTruthy();
  });

  it("says No data when a value is missing, and never invents one", () => {
    render(<KpiStatRow stats={[{ label: "Diversion", value: null, format }]} />);
    expect(screen.getByText("No data")).toBeTruthy();
  });

  it("colours a rise green when up is good and red when up is bad", () => {
    render(
      <KpiStatRow
        stats={[
          { label: "Diversion", value: 80, format, delta: { value: 5, label: "+5 pts" }, goodUp: true },
          { label: "Emissions", value: 100, format, delta: { value: 5, label: "+5%" }, goodUp: false },
        ]}
      />,
    );
    const good = screen.getByText("+5 pts").closest("span") as HTMLElement;
    const bad = screen.getByText("+5%").closest("span") as HTMLElement;
    expect(good.className).toContain("text-[#047857]");
    expect(bad.className).toContain("text-[#B91C1C]");
  });

  it("shows no chip when there is no comparison", () => {
    const { container } = render(<KpiStatRow stats={[{ label: "Records", value: 3, format }]} />);
    expect(container.querySelectorAll("span.rounded-full").length).toBe(0);
  });
});
