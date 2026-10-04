import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FormActions, FormDisclosure, FormField, FormSection } from "../form-kit";

afterEach(cleanup);

describe("form kit", () => {
  it("names a section by its heading and puts the label above the control", () => {
    render(
      <FormSection title="Location" description="Where it is">
        <FormField label="Postcode" htmlFor="pc" optional hint="No spaces needed">
          <input id="pc" />
        </FormField>
      </FormSection>,
    );
    expect(screen.getByRole("region", { name: "Location" })).toBeTruthy();
    expect(screen.getByLabelText(/Postcode/)).toBeTruthy();
    expect(screen.getByText("Optional")).toBeTruthy();
    expect(screen.getByText("No spaces needed")).toBeTruthy();
  });

  it("shows an error as an alert and replaces the hint with it", () => {
    render(
      <FormField label="Name" htmlFor="n" hint="Shown on reports" error="Name is required">
        <input id="n" />
      </FormField>,
    );
    expect(screen.getByRole("alert").textContent).toBe("Name is required");
    expect(screen.queryByText("Shown on reports")).toBeNull();
  });

  it("folds rarely used fields under a disclosure and keeps actions in one bar", () => {
    render(
      <>
        <FormDisclosure title="More options"><input aria-label="extra" /></FormDisclosure>
        <FormActions start={<button>Delete</button>}><button>Save</button></FormActions>
      </>,
    );
    expect(screen.getByText("More options")).toBeTruthy();
    const names = screen.getAllByRole("button").map((b) => b.textContent);
    expect(names).toEqual(["Delete", "Save"]);
  });
});
