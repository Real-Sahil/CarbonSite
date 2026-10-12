import type { CSSProperties, ReactNode } from "react";
import { staticFile } from "remotion";

import { swapIn } from "../../kit/move";
import { clamp01 } from "../../kit/time";
import { BrowserWindow, Card, Chip } from "../../ui/App";
import { C, FONT, MONO } from "../../ui/tokens";
import { MONTAGE_IN, SCREEN_SECONDS, SCREENS_IN, SCREENS_OUT, slot } from "./cues";

/**
 * Bars 25-38: product screens in one browser window. The window stays on the
 * stage and each screen swaps in with a short blur, the address bar shows its
 * route. Bars 39-40: a montage of six feature tiles in the same window, each
 * tile with its own route. Screens that have a demo-tenant capture use the
 * capture (copied to public/screens/platform); the rest are twins redrawn from
 * the app's tokens and components, with no figure that is not already in the film.
 */

const NAV = ["Dashboard", "Records", "Submissions", "Calculations", "Compliance", "Reports", "Transition plan", "Settings"];

function NavRail({ active }: { active: string }) {
  return (
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 290, background: C.card, borderRight: `1px solid ${C.border}`, fontFamily: FONT }}>
      <div style={{ padding: "26px 22px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 21, fontWeight: 600, color: C.text }}>MetricOra</div>
        <div style={{ fontSize: 16, color: C.muted }}>Northgate Civils Ltd</div>
      </div>
      <div style={{ padding: "16px 14px", display: "grid", gap: 4 }}>
        {NAV.map((item) => {
          const on = item === active;
          return (
            <div key={item} style={{ fontSize: 20, padding: "11px 14px", borderRadius: 10, color: on ? C.accent : C.text2, background: on ? C.activeBg : "transparent", border: `1px solid ${on ? C.activeBorder : "transparent"}` }}>
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Page({ active, title, sub, action, children }: { active: string; title: string; sub: string; action?: string; children: ReactNode }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.page, fontFamily: FONT }}>
      <NavRail active={active} />
      <div style={{ position: "absolute", left: 290, top: 0, right: 0, bottom: 0, padding: "44px 56px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
          <div>
            <div style={{ fontSize: 44, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>{title}</div>
            <div style={{ fontSize: 21, color: C.text2, marginTop: 8, maxWidth: 900 }}>{sub}</div>
          </div>
          {action ? <Button tone="solid">{action}</Button> : null}
        </div>
        <div style={{ marginTop: 34 }}>{children}</div>
      </div>
    </div>
  );
}

function Button({ children, tone }: { children: ReactNode; tone: "solid" | "outline" }) {
  const solid = tone === "solid";
  return (
    <span style={{ display: "inline-block", fontSize: 19, fontWeight: 600, borderRadius: 10, padding: "12px 20px", whiteSpace: "nowrap", background: solid ? C.accent : C.card, color: solid ? "#FFFFFF" : C.text2, border: solid ? "none" : `1px solid ${C.border}` }}>
      {children}
    </span>
  );
}

function Row({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "20px 26px", borderTop: `1px solid ${C.border}`, fontSize: 22, color: C.text, ...style }}>{children}</div>;
}

function Calculation() {
  return (
    <Page active="Calculations" title="Calculation run" sub="FY2025 · DEFRA 2025.2 library · Northgate Civils Ltd">
      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ flex: 1, background: C.accent, color: "#FFFFFF", borderRadius: 12, padding: "28px 32px" }}>
          <div style={{ fontSize: 18, letterSpacing: "0.06em", fontWeight: 500 }}>TOTAL FOOTPRINT</div>
          <div style={{ fontSize: 76, fontWeight: 700, marginTop: 8, fontVariantNumeric: "tabular-nums" }}>
            4,710.05 <span style={{ fontSize: 40 }}>tCO₂e</span>
          </div>
          <div style={{ fontSize: 20, marginTop: 10 }}>Scopes 1-3 · FY2025</div>
        </div>
        <div style={{ width: 430, display: "grid", gap: 14, alignContent: "start" }}>
          <div><Chip tone="approved">Published</Chip></div>
          <div><Chip tone="outline">DEFRA 2025.2</Chip></div>
          <div><Chip tone="outline">AR6</Chip></div>
          <div><Chip tone="outline">ghg-protocol-v2026-02</Chip></div>
        </div>
      </div>
      <Card style={{ marginTop: 26 }}>
        <Row style={{ borderTop: "none", fontWeight: 600, fontSize: 26 }}>Fuel receipt, Certas Energy <span style={{ marginLeft: "auto" }}><Chip tone="approved">Verified</Chip></span></Row>
        <Row style={{ fontFamily: MONO, fontSize: 24 }}>520 litres × 0.03558 kg CO₂e/litre <span style={{ color: C.accent, fontWeight: 600 }}>= 18.50 kg CO₂e</span></Row>
        <Row style={{ color: C.muted, fontSize: 20 }}>Selection reason: same category, unit and period as the receipt</Row>
      </Card>
      <div style={{ marginTop: 18, fontSize: 19, color: C.muted }}>Biogenic CO₂ is reported beside the inventory, never inside it.</div>
    </Page>
  );
}

function Instruments() {
  const rows = ["Renewable certificates and PPAs", "Green tariffs", "Supplier rate", "Residual mix"];
  return (
    <Page active="Settings" title="Electricity contracts" sub="Market-based Scope 2 draws on these in GHG Protocol order. A certificate is claimed once." action="Add contract">
      <Card>
        {rows.map((label, i) => (
          <Row key={label} style={i === 0 ? { borderTop: "none" } : undefined}>
            <span style={{ fontFamily: MONO, fontSize: 20, color: C.muted, width: 80 }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ fontWeight: 600 }}>{label}</span>
            <span style={{ marginLeft: "auto" }}>
              <Chip tone={i === 0 ? "approved" : "outline"}>{i === 0 ? "Claimed first" : "In order"}</Chip>
            </span>
          </Row>
        ))}
      </Card>
      <div style={{ marginTop: 18, fontSize: 19, color: C.muted }}>Any kWh not covered falls back to the library factor, with a warning.</div>
    </Page>
  );
}

function Deadlines() {
  const regions = ["UK", "EU-27", "Germany", "UAE", "US", "Australia", "Canada"];
  return (
    <Page active="Compliance" title="Regulatory calendar" sub="Each entry shows its official source. Regions follow your head office and facility countries.">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {regions.map((r, i) => (
          <Chip key={r} tone={i === 0 ? "accent" : "outline"}>{r}</Chip>
        ))}
        <Chip tone="outline">Show all</Chip>
      </div>
      <Card style={{ marginTop: 24 }}>
        {[
          ["Streamlined Energy and Carbon Reporting (SECR)", "UK"],
          ["Carbon Reduction Plan, PPN 006", "UK"],
          ["Corporate Sustainability Reporting Directive", "EU-27"],
        ].map(([label, region], i) => (
          <Row key={label} style={i === 0 ? { borderTop: "none" } : undefined}>
            <span style={{ fontWeight: 600 }}>{label}</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center" }}>
              <Chip tone="outline">{region}</Chip>
              <span style={{ fontSize: 18, color: C.muted }}>Official source</span>
            </span>
          </Row>
        ))}
      </Card>
      <div style={{ marginTop: 18, fontSize: 19, color: C.muted }}>Last checked date shown on the page. A country with no rules loaded is named, never hidden.</div>
    </Page>
  );
}

function AuditTrail() {
  const events = [
    ["Calculation run published", "Sam Hartley"],
    ["Field submission approved", "Sam Hartley"],
    ["Import committed", "Dan Mitchell"],
    ["Role changed", "Sam Hartley"],
  ];
  return (
    <Page active="Compliance" title="Audit trail" sub="Append-only. Each entry is hashed into one chain per organisation." action="Check the audit trail">
      <div style={{ marginBottom: 18 }}><Chip tone="approved">Chain intact</Chip></div>
      <Card>
        {events.map(([action, actor], i) => (
          <Row key={action} style={i === 0 ? { borderTop: "none" } : undefined}>
            <span style={{ fontWeight: 600 }}>{action}</span>
            <span style={{ color: C.text2 }}>{actor}</span>
            <span style={{ marginLeft: "auto" }}><Chip tone="outline">Recorded</Chip></span>
          </Row>
        ))}
      </Card>
    </Page>
  );
}

function Reports() {
  const types = [
    ["GHG Protocol report", "Scopes 1, 2 and 3"],
    ["PPN 006 Carbon Reduction Plan", "Carbon section of a bid"],
    ["SECR report", "Streamlined Energy and Carbon Reporting"],
    ["Bid carbon pack", "Carbon section of a tender in one PDF"],
  ];
  return (
    <Page active="Reports" title="Reports" sub="Pick a report type. Every figure comes from the published snapshot for FY2025." action="Show all report types">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {types.map(([title, sub], i) => (
          <Card key={title} style={{ padding: "26px 30px", borderColor: i === 0 ? C.activeBorder : C.border, background: i === 0 ? C.activeBg : C.card }}>
            <div style={{ fontSize: 26, fontWeight: 600, color: C.text }}>{title}</div>
            <div style={{ fontSize: 20, color: C.muted, marginTop: 8 }}>{sub}</div>
          </Card>
        ))}
      </div>
    </Page>
  );
}

function CarbonPrice() {
  const rows: [string, boolean][] = [
    ["Shadow price", true],
    ["Internal fee", false],
    ["Implicit price", false],
  ];
  return (
    <Page active="Settings" title="Internal carbon price" sub="Versioned prices. The one in force values the dashboard totals and each initiative." action="New version">
      <Card>
        {rows.map(([label, inForce], i) => (
          <Row key={label} style={i === 0 ? { borderTop: "none" } : undefined}>
            <span style={{ fontWeight: 600 }}>{label}</span>
            <span style={{ marginLeft: "auto" }}>
              <Chip tone={inForce ? "approved" : "outline"}>{inForce ? "In force" : "Not in force"}</Chip>
            </span>
          </Row>
        ))}
      </Card>
    </Page>
  );
}

function ScreenImage({ file }: { file: string }) {
  return <img src={staticFile(file)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />;
}

export const SCREENS: { path: string; render: () => ReactNode }[] = [
  { path: "/orgs/northgate/submissions", render: () => <ScreenImage file="screens/platform/submissions.jpg" /> },
  { path: "/orgs/northgate/calculations/run-fy2025", render: () => <Calculation /> },
  { path: "/orgs/northgate/settings/energy-instruments", render: () => <Instruments /> },
  { path: "/orgs/northgate/compliance/deadlines", render: () => <Deadlines /> },
  { path: "/orgs/northgate/compliance/audit-trail", render: () => <AuditTrail /> },
  { path: "/orgs/northgate/reports", render: () => <Reports /> },
  { path: "/orgs/northgate/transition-plan", render: () => <ScreenImage file="screens/platform/transition-plan.jpg" /> },
  { path: "/orgs/northgate/settings/carbon-price", render: () => <CarbonPrice /> },
];

type Tile = { path: string; title: string; note: string; body: ReactNode };

const MUTED_LABEL: CSSProperties = { fontSize: 15, color: C.muted, letterSpacing: "0.04em", textTransform: "uppercase" };
const DASH = <span style={{ color: C.muted }}>-</span>;

function Columns({ heads, rows, cols }: { heads: string[]; rows: ReactNode[][]; cols: string }) {
  const grid = { display: "grid", gridTemplateColumns: cols, gap: 12, alignItems: "center" } as const;
  return (
    <div style={{ fontSize: 16, color: C.text }}>
      <div style={{ ...grid, ...MUTED_LABEL, fontSize: 13, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
        {heads.map((h) => <span key={h}>{h}</span>)}
      </div>
      {rows.map((cells, i) => (
        <div key={i} style={{ ...grid, padding: "11px 0", borderBottom: `1px solid ${C.border}` }}>
          {cells.map((cell, j) => <span key={j}>{cell}</span>)}
        </div>
      ))}
    </div>
  );
}

function CarbonBudgetSketch() {
  // Shape only: a straight plan line and an actual line, no axis values.
  return (
    <svg viewBox="0 0 460 170" width="100%" height="170" style={{ display: "block" }}>
      <line x1="10" y1="160" x2="450" y2="160" stroke={C.border} strokeWidth="2" />
      <line x1="10" y1="10" x2="10" y2="160" stroke={C.border} strokeWidth="2" />
      <line x1="10" y1="160" x2="450" y2="20" stroke={C.muted} strokeWidth="2" strokeDasharray="8 7" />
      <polyline points="10,160 110,132 200,104 290,80 370,62 420,40" fill="none" stroke={C.accent} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="420" cy="40" r="5" fill={C.accent} />
    </svg>
  );
}

const MONTAGE_PATH = "/orgs/northgate";

/** Bars 39-40: six feature tiles, each with its own route. Every tile is labelled Demo data. */
export const MONTAGE: Tile[] = [
  {
    path: "/orgs/northgate/waste/register",
    title: "Duty of care register",
    note: "Transfers by site, waste and carrier, with the keep-until date.",
    body: (
      <>
        <Columns
          cols="1fr 1.3fr 1.2fr 0.8fr"
          heads={["Date", "Site", "Waste", "Tonnes"]}
          rows={[[DASH, "Site A", "Inert waste", DASH], [DASH, "Site B", "Mixed waste", DASH]]}
        />
        <div style={{ marginTop: 14 }}><Chip tone="amber">Transfers with gaps</Chip></div>
      </>
    ),
  },
  {
    path: "/orgs/northgate/waste/plan",
    title: "Site Waste Management Plan",
    note: "Forecast against what was recorded, by waste type and planned route.",
    body: (
      <>
        <Columns
          cols="1.2fr 1fr 1fr 1.2fr"
          heads={["Waste type", "Forecast (t)", "Recorded (t)", "Planned route"]}
          rows={[["Inert", DASH, DASH, DASH], ["Non-hazardous", DASH, DASH, DASH]]}
        />
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <Chip tone="outline">Diverted so far</Chip>
          <Chip tone="outline">Target</Chip>
        </div>
      </>
    ),
  },
  {
    path: "/orgs/northgate/plant",
    title: "Plant telematics",
    note: "Idling, fuel burnt and HVO share per machine. Monitoring only, never inventory.",
    body: (
      <>
        <Columns
          cols="1.2fr 1fr 1fr 1fr"
          heads={["Machine", "Idle", "Fuel (L)", "tCO₂e"]}
          rows={[["Serial on register", DASH, DASH, DASH], ["Serial on register", DASH, DASH, DASH]]}
        />
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <Chip tone="outline">Idling</Chip>
          <Chip tone="outline">HVO share</Chip>
        </div>
      </>
    ),
  },
  {
    path: "/orgs/northgate/contracts/road-scheme/projects/junction-4/carbon-budget",
    title: "Carbon budget burn-down",
    note: "Measured carbon by month against a straight spend line, with a forecast at completion.",
    body: (
      <>
        <CarbonBudgetSketch />
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <Chip tone="approved">On track</Chip>
          <Chip tone="amber">At risk</Chip>
          <Chip tone="accent">Over</Chip>
        </div>
      </>
    ),
  },
  {
    path: "/orgs/northgate/contracts/road-scheme/projects/junction-4/pas2080",
    title: "PAS 2080 carbon management",
    note: "Baseline, target, forecast and measured carbon, with the reduction hierarchy.",
    body: (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 16, color: C.text2 }}>
          {["Baseline", "Target", "Forecast", "Measured to date"].map((label) => (
            <div key={label} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between" }}>
              <span>{label}</span>
              {DASH}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 16, color: C.text }}>
          {["Build nothing", "Build less", "Build clever", "Build efficiently"].map((label, i) => (
            <div key={label} style={{ borderRadius: 999, background: C.activeBg, color: C.accent, padding: "5px 12px", whiteSpace: "nowrap" }}>{`${i + 1}. ${label}`}</div>
          ))}
        </div>
      </>
    ),
  },
  {
    path: "/orgs/northgate/reports",
    title: "Bid carbon pack",
    note: "The carbon section of a tender in one PDF, from published snapshots.",
    body: (
      <ul style={{ margin: 0, paddingLeft: 22, fontSize: 17, color: C.text, lineHeight: 1.7 }}>
        <li>PPN 006 Carbon Reduction Plan</li>
        <li>Emissions trend across published snapshots</li>
        <li>Up to five featured contracts</li>
        <li>Assurance status and model answers</li>
        <li>A section with no data is left out</li>
      </ul>
    ),
  },
];

function MontageTile({ tile, index, t }: { tile: Tile; index: number; t: number }) {
  const k = clamp01((t - MONTAGE_IN - 0.08 * index) / 0.35);
  return (
    <div style={{ opacity: k, transform: `translateY(${(1 - k) * 12}px)`, minHeight: 0, display: "flex", flexDirection: "column", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: "#F3F4F6", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <span key={c} style={{ width: 9, height: 9, borderRadius: 5, background: c }} />
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 14, color: C.muted, lineHeight: 1.3 }}>{tile.path.replace(/\//g, "/​")}</div>
        <div style={{ fontSize: 13, color: C.muted, flexShrink: 0 }}>Demo data</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{tile.title}</div>
        <div style={{ fontSize: 17, color: C.muted, lineHeight: 1.35 }}>{tile.note}</div>
        <div style={{ marginTop: 8 }}>{tile.body}</div>
      </div>
    </div>
  );
}

function Montage({ t }: { t: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.page, fontFamily: FONT, padding: "26px 28px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 20 }}>
      {MONTAGE.map((tile, i) => (
        <MontageTile key={tile.path} tile={tile} index={i} t={t} />
      ))}
    </div>
  );
}

/** Bars 25-40. The window enters on bar 25 and leaves as bar 41 (the ending) begins. */
export function Screens({ t }: { t: number }) {
  const enterAt = SCREENS_IN - 0.4;
  if (t < enterAt || t > SCREENS_OUT + 0.3) return null;
  const enter = clamp01((t - enterAt) / 0.5);
  const leave = clamp01((t - (SCREENS_OUT - 0.25)) / 0.4);
  const montage = t >= MONTAGE_IN;
  const index = Math.min(SCREENS.length - 1, Math.max(0, Math.floor((t - SCREENS_IN) / SCREEN_SECONDS)));
  const current = montage ? { from: MONTAGE_IN, to: SCREENS_OUT } : slot(index);
  const swap = swapIn(t, current.from, current.to, 0.14, 0.12);
  const scale = 0.965 + 0.035 * enter;
  const path = montage ? MONTAGE_PATH : SCREENS[index].path;
  const content = montage ? <Montage t={t} /> : SCREENS[index].render();
  return (
    <BrowserWindow
      path={path}
      style={{ opacity: enter * (1 - leave), transform: `scale(${scale - 0.02 * leave})`, transformOrigin: "50% 50%" }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: swap.opacity, filter: swap.filter }}>{content}</div>
    </BrowserWindow>
  );
}
