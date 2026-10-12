import { describe, expect, it } from "vitest";
import { LAYOUT_VERSION, MASTER_ORDER, layoutError, presetLayout, resolveLayout, toLayout, widgetsForRole } from "../widgets";

const all = (role: string) => widgetsForRole(role);

describe("widgetsForRole", () => {
  it("withholds the calculation widget from roles that cannot run one", () => {
    expect(widgetsForRole("viewer").map((w) => w.id)).not.toContain("run-calculation");
    expect(widgetsForRole("auditor").map((w) => w.id)).not.toContain("run-calculation");
    expect(widgetsForRole("admin").map((w) => w.id)).toContain("run-calculation");
  });
});

describe("presetLayout", () => {
  it("opens every role on the master order, summary first", () => {
    for (const role of ["admin", "sustainability_manager", "viewer", "reviewer"]) {
      const l = presetLayout(role);
      expect(l.order[0]).toBe("summary");
      expect(l.order.slice(0, MASTER_ORDER.length).filter((id) => MASTER_ORDER.includes(id))).toEqual(
        MASTER_ORDER.filter((id) => widgetsForRole(role).some((w) => w.id === id)),
      );
    }
  });

  it("opens every role on the analytical panels, not a bare summary", () => {
    for (const role of ["admin", "sustainability_manager", "viewer", "auditor", "reviewer"]) {
      const l = presetLayout(role);
      for (const id of ["scope-breakdown", "flow", "waterfall", "facilities", "scope-detail", "data-quality"]) {
        expect(l.hidden, `${role} hides ${id}`).not.toContain(id);
      }
    }
  });

  it("hides what is outside the master but keeps it addable for roles that may read it", () => {
    const l = presetLayout("viewer");
    expect(l.hidden).toContain("live");
    expect(l.hidden).not.toContain("summary");
    expect(l.hidden).not.toContain("readiness");
    expect(new Set(l.order).size).toBe(widgetsForRole("viewer").length);
  });

  it("never offers a role a widget it may not see", () => {
    const l = presetLayout("viewer");
    expect(l.order).not.toContain("run-calculation");
    expect(l.hidden).not.toContain("run-calculation");
  });

  it("stamps the layout version so older saved layouts are recognised", () => {
    expect(presetLayout("admin").version).toBe(LAYOUT_VERSION);
  });
});

describe("resolveLayout", () => {
  it("falls back to the role's preset", () => {
    const placed = resolveLayout(all("viewer"), null, "viewer");
    expect(placed.find((p) => p.id === "summary")!.hidden).toBe(false);
    expect(placed.find((p) => p.id === "readiness")!.hidden).toBe(false);
    expect(placed.find((p) => p.id === "live")!.hidden).toBe(true);
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
