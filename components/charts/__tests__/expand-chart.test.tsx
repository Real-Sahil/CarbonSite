import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CategoryBar } from "../category-bar";
import { ExpandChart } from "../expand-chart";
import { ScopeDonut } from "../scope-donut";
import { BklitScopeRing } from "../bklit-scope-ring";
import { BklitDataGauge } from "../bklit-data-gauge";
import { BarChart } from "../bar-chart";

// jsdom has no ResizeObserver; visx ParentSize needs one to measure.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("ring and gauge expand", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("gives the scope donut, scope ring and data gauge an expand button", () => {
    cleanup();
    const { unmount } = render(<ScopeDonut data={[{ scope: 1, label: "Scope 1", value: 500 }]} />);
    expect(screen.getByRole("button", { name: "Expand Emissions by scope" })).toBeTruthy();
    unmount();
    const ring = render(<BklitScopeRing data={[{ scope: 1, label: "Scope 1", value: 500 }]} />);
    expect(screen.getByRole("button", { name: "Expand Emissions by scope" })).toBeTruthy();
    ring.unmount();
    render(<BklitDataGauge value={72} label="Data confidence" />);
    expect(screen.getByRole("button", { name: "Expand Data confidence" })).toBeTruthy();
  });
});

describe("bar chart expand", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("adds an expand button only when expandTitle is set", () => {
    cleanup();
    const { unmount } = render(<BarChart data={[{ name: "A", v: 1 }]} expandTitle="Emissions trend" />);
    expect(screen.getByRole("button", { name: "Expand Emissions trend" })).toBeTruthy();
    unmount();
    render(<BarChart data={[{ name: "A", v: 1 }]} />);
    expect(screen.queryByRole("button", { name: /^Expand/ })).toBeNull();
  });
});

describe("ExpandChart", () => {
  it("opens the chart full screen with expanded set", () => {
    cleanup();
    render(<ExpandChart title="Demo">{(expanded) => <div>{expanded ? "large" : "small"}</div>}</ExpandChart>);
    expect(screen.getByText("small")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Expand Demo" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("large")).toBeTruthy();
  });

  it("gives a category bar an expand button, and none when there is nothing to chart", () => {
    cleanup();
    const { unmount } = render(<CategoryBar data={[{ name: "Fuel", value: 1200 }]} ariaLabel="Top categories" />);
    expect(screen.getByRole("button", { name: "Expand Top categories" })).toBeTruthy();
    unmount();
    render(<CategoryBar data={[]} ariaLabel="Top categories" />);
    expect(screen.queryByRole("button", { name: "Expand Top categories" })).toBeNull();
    expect(screen.getByText("No calculated emissions to chart.")).toBeTruthy();
  });
});
