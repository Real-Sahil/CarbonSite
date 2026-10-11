import type { ReactNode } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BklitTrendArea } from "../bklit-trend-area";
import { stepCrosshairIndex } from "../bar-chart";

// Give visx ParentSize a real size so the chart renders its SVG under jsdom.
vi.mock("@visx/responsive", () => ({
  ParentSize: ({ children }: { children: (size: { width: number; height: number }) => ReactNode }) =>
    children({ width: 400, height: 260 }),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const TREND = [
  { label: "2024", scope1: 1000, scope2: 2000, scope3: 3000 },
  { label: "2025", scope1: 500, scope2: 500, scope3: 500 },
];

describe("stepCrosshairIndex", () => {
  it("starts at the first period on ArrowRight and the last on ArrowLeft when nothing is pinned", () => {
    expect(stepCrosshairIndex(null, "ArrowRight", 3)).toBe(0);
    expect(stepCrosshairIndex(null, "ArrowDown", 3)).toBe(0);
    expect(stepCrosshairIndex(null, "ArrowLeft", 3)).toBe(2);
    expect(stepCrosshairIndex(null, "ArrowUp", 3)).toBe(2);
  });

  it("moves one period at a time and stops at both ends", () => {
    expect(stepCrosshairIndex(1, "ArrowRight", 3)).toBe(2);
    expect(stepCrosshairIndex(2, "ArrowRight", 3)).toBe(2);
    expect(stepCrosshairIndex(1, "ArrowLeft", 3)).toBe(0);
    expect(stepCrosshairIndex(0, "ArrowLeft", 3)).toBe(0);
  });

  it("jumps to the ends on Home and End and clears on Escape", () => {
    expect(stepCrosshairIndex(1, "Home", 3)).toBe(0);
    expect(stepCrosshairIndex(1, "End", 3)).toBe(2);
    expect(stepCrosshairIndex(1, "Escape", 3)).toBeNull();
  });

  it("ignores other keys and empty data", () => {
    expect(stepCrosshairIndex(1, "Enter", 3)).toBeUndefined();
    expect(stepCrosshairIndex(null, "ArrowRight", 0)).toBeUndefined();
  });
});

describe("BklitTrendArea crosshair", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("is a named keyboard group, not a read-only image, so the readout can be reached", () => {
    cleanup();
    render(<BklitTrendArea data={TREND} />);
    expect(screen.getByRole("group", { name: /Emissions trend across reporting periods/ })).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Emissions trend across reporting periods" })).toBeNull();
  });

  it("shows the period, each scope in tonnes and the total as arrow keys move, then clears on Escape", () => {
    cleanup();
    render(<BklitTrendArea data={TREND} />);
    const group = screen.getByRole("group", { name: /Emissions trend across reporting periods/ });
    expect(screen.queryByText("Total")).toBeNull();

    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(screen.getByText("2024")).toBeTruthy();
    expect(screen.getByText("1.00 tCO2e")).toBeTruthy();
    expect(screen.getByText("2.00 tCO2e")).toBeTruthy();
    expect(screen.getByText("3.00 tCO2e")).toBeTruthy();
    expect(screen.getByText("6.00 tCO2e")).toBeTruthy();

    fireEvent.keyDown(group, { key: "End" });
    expect(screen.getByText("2025")).toBeTruthy();
    expect(screen.getByText("1.50 tCO2e")).toBeTruthy();

    fireEvent.keyDown(group, { key: "Escape" });
    expect(screen.queryByText("Total")).toBeNull();
  });
});
