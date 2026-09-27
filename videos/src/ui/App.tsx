import type { CSSProperties, ReactNode } from "react";

import { Mark } from "./Logo";
import { C, FONT } from "./tokens";

/**
 * Twins of the web app's shell (browser window, sidebar) redrawn from the
 * demo tenant screenshots in public/marketing/screens, with the same tokens.
 * The app itself needs auth and a database, so films redraw it.
 */
export const WINDOW = { x: 160, y: 84, w: 1600, h: 912, bar: 56 };
export const SIDEBAR = 290;

export function BrowserWindow({ children, style, path }: { children: ReactNode; style?: CSSProperties; path: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: WINDOW.x,
        top: WINDOW.y,
        width: WINDOW.w,
        height: WINDOW.h,
        borderRadius: 16,
        overflow: "hidden",
        background: C.page,
        boxShadow: "0 40px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
        fontFamily: FONT,
        ...style,
      }}
    >
      <div style={{ height: WINDOW.bar, display: "flex", alignItems: "center", gap: 18, padding: "0 22px", background: "#F3F4F6", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", gap: 9 }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <span key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ width: 560, height: 34, borderRadius: 9, background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: C.muted }}>
            metricora.co.uk{path}
          </div>
        </div>
        <DemoTag />
      </div>
      <div style={{ position: "absolute", top: WINDOW.bar, left: 0, right: 0, bottom: 0 }}>{children}</div>
    </div>
  );
}

export function DemoTag() {
  return (
    <span style={{ fontSize: 16, fontWeight: 500, color: C.amberFg, background: C.amberBg, borderRadius: 999, padding: "5px 12px", whiteSpace: "nowrap" }}>
      Demo data
    </span>
  );
}

const NAV = ["Dashboard", "Imports", "Records", "Submissions", "Supplier reports", "Tasks", "Contracts"];
const GROUPS = ["CALCULATIONS", "INVENTORY GOVERNANCE", "IMPACT REPORTS", "CARBON FORECAST"];

export function Sidebar({ active }: { active: string }) {
  return (
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: SIDEBAR, background: C.card, borderRight: `1px solid ${C.border}`, fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "22px 22px", borderBottom: `1px solid ${C.border}` }}>
        <Mark t={1} appear={0} draw={0} size={44} />
        <div>
          <div style={{ fontSize: 21, fontWeight: 600, color: C.text }}>MetricOra</div>
          <div style={{ fontSize: 16, color: C.muted }}>Northgate Civils Ltd</div>
        </div>
      </div>
      <div style={{ padding: "16px 14px", display: "grid", gap: 4 }}>
        {NAV.map((item) => {
          const on = item === active;
          return (
            <div
              key={item}
              style={{
                fontSize: 20,
                padding: "11px 14px",
                borderRadius: 10,
                color: on ? C.accent : C.text2,
                background: on ? C.activeBg : "transparent",
                border: `1px solid ${on ? C.activeBorder : "transparent"}`,
              }}
            >
              {item}
            </div>
          );
        })}
        <div style={{ height: 12 }} />
        {GROUPS.map((g) => (
          <div key={g} style={{ fontSize: 14, letterSpacing: "0.08em", fontWeight: 600, color: C.muted, padding: "12px 14px" }}>
            {g}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Chip({ children, tone }: { children: ReactNode; tone: "approved" | "amber" | "outline" | "accent" }) {
  const tones = {
    approved: { background: C.approvedBg, color: C.approvedFg, border: "transparent" },
    amber: { background: C.amberBg, color: C.amberFg, border: "transparent" },
    outline: { background: C.card, color: C.text2, border: C.border },
    accent: { background: C.activeBg, color: C.accent, border: C.activeBorder },
  }[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontSize: 18, fontWeight: 500, borderRadius: 999, padding: "6px 16px", whiteSpace: "nowrap", background: tones.background, color: tones.color, border: `1px solid ${tones.border}` }}>
      {children}
    </span>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, ...style }}>{children}</div>;
}
