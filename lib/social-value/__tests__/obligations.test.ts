import { describe, expect, it } from "vitest";
import { obligationProgress, obligationState } from "@/lib/social-value/obligations";

const today = new Date(Date.UTC(2026, 9, 2));
const on = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("obligationState", () => {
  it("met and waived win over any date", () => {
    expect(obligationState({ status: "met", dueDate: on("2020-01-01") }, today)).toBe("met");
    expect(obligationState({ status: "waived", dueDate: on("2020-01-01") }, today)).toBe("waived");
  });
  it("open obligations go overdue the day after the due date", () => {
    expect(obligationState({ status: "open", dueDate: on("2026-10-01") }, today)).toBe("overdue");
    expect(obligationState({ status: "open", dueDate: on("2026-10-02") }, today)).toBe("due_soon");
  });
  it("due soon is within 60 days, open beyond, and open with no date", () => {
    expect(obligationState({ status: "open", dueDate: on("2026-12-01") }, today)).toBe("due_soon");
    expect(obligationState({ status: "open", dueDate: on("2026-12-02") }, today)).toBe("open");
    expect(obligationState({ status: "open", dueDate: null }, today)).toBe("open");
  });
});

describe("obligationProgress", () => {
  it("adds only quantities in the target's unit and flags the rest", () => {
    const p = obligationProgress({ value: 10, unit: "Apprentices" }, [
      { unit: "apprentices", quantity: 3 },
      { unit: "apprentices", quantity: 2 },
      { unit: "hours", quantity: 400 },
    ]);
    expect(p).toEqual({ delivered: 5, pct: 50, unitMismatch: true });
  });
  it("has no percentage without a positive target", () => {
    expect(obligationProgress({ value: null, unit: "£" }, [{ unit: "£", quantity: 5 }]).pct).toBeNull();
  });
});
