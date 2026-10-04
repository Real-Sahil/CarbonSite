import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { OrgLocaleProvider, useOrgMoney } from "../org-locale";

function Probe({ n = 1234.5, decimals }: { n?: number; decimals?: number }) {
  const m = useOrgMoney();
  return (
    <p>
      <span data-testid="code">{m.currency}</span>
      <span data-testid="symbol">{m.symbol}</span>
      <span data-testid="amount">{m.format(n, { decimals })}</span>
    </p>
  );
}
afterEach(cleanup);

describe("organisation money", () => {
  it("is pounds outside the org layout", () => {
    render(<Probe />);
    expect(screen.getByTestId("code").textContent).toBe("GBP");
    expect(screen.getByTestId("symbol").textContent).toBe("£");
    expect(screen.getByTestId("amount").textContent).toBe("£1,235");
  });

  it("follows the organisation's currency and locale", () => {
    render(<OrgLocaleProvider locale="de-DE" currency="EUR"><Probe /></OrgLocaleProvider>);
    expect(screen.getByTestId("symbol").textContent).toBe("€");
    expect(screen.getByTestId("amount").textContent.replace(/\s/g, " ")).toBe("1.235 €");
    cleanup();
    render(<OrgLocaleProvider locale="en-US" currency="USD"><Probe decimals={2} /></OrgLocaleProvider>);
    expect(screen.getByTestId("symbol").textContent).toBe("$");
    expect(screen.getByTestId("amount").textContent).toBe("$1,234.50");
  });

  it("falls back to the code for a currency the runtime does not know", () => {
    render(<OrgLocaleProvider locale="en-GB" currency="XXZ"><Probe n={5} /></OrgLocaleProvider>);
    expect(screen.getByTestId("amount").textContent).toContain("XXZ");
  });
});
