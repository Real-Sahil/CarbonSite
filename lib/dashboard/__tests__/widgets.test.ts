import { describe, expect, it } from "vitest";
import { WIDGETS, layoutError, presetLayout, resolveLayout, toLayout, widgetsForRole } from "../widgets";

const all = (role: string) => widgetsForRole(role);

describe("widgetsForRole", () => {
  it("withholds the calculation widget from roles that cannot run one", () => {
    expect(widgetsForRole("viewer").map((w) => w.id)).not.toContain("run-calculation");
    expect(widgetsForRole("auditor").map((w) => w.id)).not.toContain("run-calculation");
    expect(widgetsForRole("admin").map((w) => w.id)).toContain("run-calculation");
  });
});

describe("presetLayout", () => {
  it("gives managers and admins everything in the long-standing order", () => {
    const l = presetLayout("sustainability_manager");
    expect(l.order).toEqual(WIDGETS.map((w) => w.id));
    expect(l.hidden).toEqual([]);
  });

  it("gives an executive the short list first and keeps the rest addable", () => {
    const l = presetLayout("viewer");
    expect(l.order.slice(0, 3)).toEqual(["headline", "scope-breakdown", "flow"]);
    expect(l.hidden).toContain("review-queue");
    expect(l.hidden).not.toContain("headline");
    expect(new Set(l.order).size).toBe(widgetsForRole("viewer").length);
  });
});

describe("resolveLayout", () => {
  it("falls back to the role's preset", () => {
    const placed = resolveLayout(all("viewer"), null, "viewer");
    expect(placed.find((p) => p.id === "headline")!.hidden).toBe(false);
    expect(placed.find((p) => p.id === "review-queue")!.hidden).toBe(true);
  });

  it("drops widgets that are not available, keeps the saved order and widths", () => {
    const available = all("admin").filter((w) => w.id !== "live");
    const placed = resolveLayout(available, { order: ["facilities", "live", "headline"], hidden: ["headline"], widths: { facilities: "half" } }, "admin");
    expect(placed.slice(0, 2).map((p) => p.id)).toEqual(["facilities", "headline"]);
    expect(placed.map((p) => p.id)).not.toContain("live");
    expect(placed[0].width).toBe("half");
    expect(placed[1].hidden).toBe(true);
  });

  it("places a widget added since the layout was saved last and shows it", () => {
    const placed = resolveLayout(all("admin"), { order: ["headline"], hidden: [], widths: {} }, "admin");
    expect(placed[0].id).toBe("headline");
    expect(placed.at(-1)!.hidden).toBe(false);
    expect(placed).toHaveLength(all("admin").length);
  });

  it("never hands a role a widget it may not have, even if a layout names it", () => {
    const placed = resolveLayout(all("viewer"), { order: ["run-calculation", "headline"], hidden: [], widths: { "run-calculation": "full" } }, "viewer");
    expect(placed.map((p) => p.id)).not.toContain("run-calculation");
  });
});

describe("layout round trip and validation", () => {
  it("stores what is on screen and reads it back the same", () => {
    const placed = resolveLayout(all("admin"), null, "admin");
    placed[0].hidden = true;
    placed[1].width = "half";
    const stored = toLayout(placed);
    expect(layoutError(stored)).toBeNull();
    const back = resolveLayout(all("admin"), stored, "admin");
    expect(back.map((b) => [b.id, b.width, b.hidden])).toEqual(placed.map((b) => [b.id, b.width, b.hidden]));
  });

  it("refuses an id the registry does not know", () => {
    expect(layoutError({ order: ["headline", "evil"], hidden: [], widths: {} })).toContain("evil");
    expect(layoutError({ order: [], hidden: [], widths: { nope: "half" } })).toContain("nope");
  });
});
