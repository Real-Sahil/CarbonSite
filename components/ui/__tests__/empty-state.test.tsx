import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Building2 } from "lucide-react";
import { EmptyState } from "../empty-state";
import { Kbd, KbdGroup } from "../kbd";

afterEach(cleanup);

describe("EmptyState", () => {
  it("says what is missing, why, and offers the action", () => {
    render(
      <EmptyState icon={Building2} title="No facilities yet" description="Add the first site.">
        <button>Add facility</button>
      </EmptyState>,
    );
    expect(screen.getByRole("heading", { name: "No facilities yet" })).toBeTruthy();
    expect(screen.getByText("Add the first site.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add facility" })).toBeTruthy();
  });

  it("works with only a title", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByRole("heading", { name: "Nothing here" })).toBeTruthy();
  });
});

describe("Kbd", () => {
  it("renders key caps in a group", () => {
    const { container } = render(<KbdGroup><Kbd>⌘</Kbd><Kbd>K</Kbd></KbdGroup>);
    expect(container.querySelectorAll("kbd")).toHaveLength(2);
  });
});
