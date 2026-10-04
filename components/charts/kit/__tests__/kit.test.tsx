import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ChartFrame } from "../chart-frame";
import { PathwayChartKit } from "../pathway-chart";
import { SankeyChart } from "../sankey-chart";
import { WaterfallChart } from "../waterfall-chart";
import { buildFlows } from "@/lib/charts/sankey";
import { buildWaterfall } from "@/lib/charts/waterfall";

// jsdom has no ResizeObserver; the drawing waits for a width, so only the frame and table render.
class StubResizeObserver { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;

afterEach(cleanup);

describe("ChartFrame", () => {
  it("switches between the chart and a table with the same numbers", () => {
    render(
      <ChartFrame title="Demo" table={{ columns: ["Year", "tCO₂e"], rows: [[2025, "10"], [2026, "8"]] }}>
        <div>drawing</div>
      </ChartFrame>,
    );
    expect(screen.getByText("drawing")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chart" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.queryByText("drawing")).toBeNull();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("2026")).toBeTruthy();
  });
});

describe("chart table views", () => {
  it("pathway lists every year with each series, dashes for missing values", () => {
    render(
      <PathwayChartKit
        points={[
          { year: 2025, reference: 1000, target: 900, planned: 950, actual: 980 },
          { year: 2026, reference: 958, target: null, planned: 900, actual: null },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(rows[1].textContent).toContain("980 tCO₂e");
    expect(rows[2].textContent).toContain("-");
  });

  it("sankey table sums to the total and the chart is absent without emissions", () => {
    const flows = buildFlows(
      [{ scope: 1, emissionCategoryId: "c1", facilityId: "f1", totalCo2e: 12000 }, { scope: 2, emissionCategoryId: "c2", facilityId: "f1", totalCo2e: 8000 }],
      { category: (id) => `Cat ${id}`, facility: () => "Leeds" },
    );
    render(<SankeyChart flows={flows} />);
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    const body = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(body.some((r) => r.textContent?.includes("Scope 1") && r.textContent.includes("12"))).toBe(true);
    expect(screen.getByText(/Total 20 tCO₂e/)).toBeTruthy();
    cleanup();
    const { container } = render(<SankeyChart flows={{ nodes: [], links: [], totalKg: 0 }} />);
    expect(container.innerHTML).toBe("");
  });

  it("waterfall table runs from the previous total to the current one with signed changes", () => {
    const steps = buildWaterfall(
      [{ id: "a", label: "Fuel", kg: 5000 }],
      [{ id: "a", label: "Fuel", kg: 3000 }, { id: "b", label: "Travel", kg: 1000 }],
      { previous: "FY2025", current: "FY2026" },
    );
    render(<WaterfallChart steps={steps} />);
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(rows[0]).toContain("FY2025");
    expect(rows.some((r) => r?.includes("Fuel") && r.includes("-2"))).toBe(true);
    expect(rows.some((r) => r?.includes("Travel") && r.includes("+1"))).toBe(true);
    expect(rows.at(-1)).toContain("FY2026");
  });
});
