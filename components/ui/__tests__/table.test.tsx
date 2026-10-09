import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Table } from "../table";

// Pages pass plain thead, tbody, tr and td. The table must label each cell from its column header so the
// phone layout (globals.css, table[data-stack]) can show one labelled card per row.
describe("Table stacking", () => {
  it("labels each cell from the header row and marks a wide table for stacking", () => {
    const { container } = render(
      <Table>
        <thead>
          <tr>
            <th>Store</th>
            <th>Litres in</th>
            <th>Litres out</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Bowser 1</td>
            <td>500</td>
            <td>120</td>
          </tr>
        </tbody>
      </Table>,
    );
    const table = container.querySelector("table")!;
    expect(table.hasAttribute("data-stack")).toBe(true);
    expect([...table.querySelectorAll("td")].map((c) => c.getAttribute("data-label"))).toEqual(["Store", "Litres in", "Litres out"]);
  });

  it("leaves a table with fewer than three columns as a grid", () => {
    const { container } = render(
      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>a</td>
            <td>1</td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(container.querySelector("table")!.hasAttribute("data-stack")).toBe(false);
  });
});
