import { describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CategoryBar } from "../category-bar";
import { ExpandChart } from "../expand-chart";

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
