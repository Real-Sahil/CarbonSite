import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/orgs/o/calculations",
}));

import { CalculationsFilters } from "../calculations-filters";

const lists = {
  periods: [{ id: "p1", label: "FY2026" }],
  libraries: [{ id: "lib1", label: "DEFRA 2026.1" }],
};

beforeEach(() => nav.replace.mockClear());
afterEach(cleanup);

describe("CalculationsFilters", () => {
  it("writes status, period and library to the URL, keeping the rest", () => {
    render(<CalculationsFilters filters={{ periodId: "p1" }} {...lists} />);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "failed" } });
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/calculations?periodId=p1&status=failed");
    fireEvent.change(screen.getByLabelText("Factor library"), { target: { value: "lib1" } });
    expect(nav.replace).toHaveBeenLastCalledWith("/orgs/o/calculations?periodId=p1&factorLibraryId=lib1");
  });

  it("lists the four run statuses with their labels and shows the current values", () => {
    render(<CalculationsFilters filters={{ status: "running", factorLibraryId: "lib1" }} {...lists} />);
    for (const name of ["Queued", "Running", "Succeeded", "Failed"]) expect(screen.getByRole("option", { name })).toBeTruthy();
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("running");
    expect((screen.getByLabelText("Factor library") as HTMLSelectElement).value).toBe("lib1");
  });

  it("clears every filter, and offers Clear only when one is set", () => {
    const { rerender } = render(<CalculationsFilters filters={{}} {...lists} />);
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
    rerender(<CalculationsFilters filters={{ status: "failed" }} {...lists} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(nav.replace).toHaveBeenCalledWith("/orgs/o/calculations");
  });
});
