import { describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChartFrame } from "../chart-frame";

describe("ChartFrame expand", () => {
  it("opens the drawing full screen and hands the child the expanded flag", () => {
    cleanup();
    render(
      <ChartFrame title="Demo" table={{ columns: ["Year"], rows: [[2026]] }}>
        {(expanded) => <div>{expanded ? "large drawing" : "small drawing"}</div>}
      </ChartFrame>,
    );
    expect(screen.getByText("small drawing")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Expand Demo" }));
    expect(screen.getByText("large drawing")).toBeTruthy();
  });

  it("offers no expand button in the table view", () => {
    cleanup();
    render(
      <ChartFrame title="Demo" table={{ columns: ["Year"], rows: [[2026]] }}>
        <div>drawing</div>
      </ChartFrame>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.queryByRole("button", { name: "Expand Demo" })).toBeNull();
  });
});
