import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { heroFacts } from "@/lib/dashboard/hero-facts";
import { SummaryHero } from "../summary-hero";

const facts = heroFacts(
  {
    periodLabel: "FY 2025",
    totalKg: 12000,
    priorLabel: "FY 2024",
    deltaPct: -4.2,
    steps: [],
    scopes: [{ scope: 1, kg: 5000 }, { scope: 2, kg: 0 }, { scope: 3, kg: 7000 }],
    openReviewTasks: 1,
  },
  (kg) => `${kg} kg`,
);

describe("SummaryHero", () => {
  it("states the total and the change in its heading, with the eyebrow above", () => {
    render(<SummaryHero facts={facts} />);

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("FY 2025: 12000 kg, down 4.2% on FY 2024.");
    expect(screen.getByText("FY 2025 · vs FY 2024")).toBeTruthy();
  });

  it("gives the scope split and the open review tasks, and leaves out scopes with nothing calculated", () => {
    render(<SummaryHero facts={facts} />);

    const text = document.body.textContent ?? "";
    expect(text).toContain("Scope 1 5000 kg, Scope 3 7000 kg.");
    expect(text).not.toContain("Scope 2");
    expect(text).toContain("1 review task is open.");
  });
});
