import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SectionNav } from "../ms-fields";

afterEach(cleanup);

const sections = [
  { key: "a", label: "Boundary", state: "done" as const },
  { key: "b", label: "Baseline", state: "todo" as const },
  { key: "c", label: "Targets", state: "optional" as const },
];

function setup(active = "b") {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  render(<SectionNav sections={sections} active={active} onSelect={onSelect} open onClose={onClose} />);
  return { onSelect, onClose };
}

describe("SectionNav", () => {
  it("marks the open section and says what each one needs", () => {
    setup("b");
    expect(screen.getByRole("tab", { name: /Baseline/ }).getAttribute("aria-current")).toBe("step");
    expect(screen.getByRole("tab", { name: /Boundary/ }).textContent).toContain("complete");
    expect(screen.getByRole("tab", { name: /Baseline/ }).textContent).toContain("needs attention");
    expect(screen.getByRole("tab", { name: /Targets/ }).textContent).toContain("optional");
  });

  it("selecting a section hands its key to the parent and closes the drawer", () => {
    const { onSelect, onClose } = setup("a");
    fireEvent.click(screen.getByRole("tab", { name: /Targets/ }));
    expect(onSelect).toHaveBeenCalledWith("c");
    expect(onClose).toHaveBeenCalled();
  });

  it("a done section stays done when another is open (not just the ones before it)", () => {
    setup("c");
    expect(screen.getByRole("tab", { name: /Boundary/ }).textContent).toContain("complete");
    expect(screen.getByRole("tab", { name: /Baseline/ }).textContent).toContain("needs attention");
  });
});
