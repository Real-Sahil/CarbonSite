import { cursorAt, UserCursor } from "../../../kit/cursor";
import { move, type Rect } from "../../../kit/move";
import { BrowserWindow, Card, Chip, Sidebar } from "../../../ui/App";
import { arrive, countUp, ease, scene } from "../../../ui/motion";
import { ReceiptPhoto } from "../../../ui/Receipt";
import { C, MONO } from "../../../ui/tokens";
import { b, CUE } from "../cues";
import { abs, DASH, MAIN } from "../layout";

/**
 * Bars 12-15: trace a figure. The dashboard's headline (demo tenant FY2025,
 * dashboard screenshot) opens into the Scope 1 records behind it, then the
 * fuel receipt's calculation: the DEFRA 2025.2 HVO factor (0.03558 kg CO2e
 * per litre, prisma/data/defra-2025-factors.json), the formula, the library,
 * the evidence tier and the photo from the field app.
 */
const T = CUE.trace;

const TILES = [
  { label: "SCOPE 1", value: 910.56, color: C.scope1 },
  { label: "SCOPE 2", value: 154.64, color: C.scope2 },
  { label: "SCOPE 3", value: 3644.85, color: C.scope3 },
];

const RECORDS = [
  { source: "Plant HVO trial, A61 corridor works", qty: "6,500 litres", co2e: "231.27 kg CO₂e", tier: null },
  { source: "Fuel receipt, Certas Energy", qty: "520 litres", co2e: "18.50 kg CO₂e", tier: "Verified" },
];

const local = (r: Rect): Rect => ({ x: r.x - MAIN.x, y: r.y - MAIN.y, w: r.w, h: r.h });

export function Trace({ t }: { t: number }) {
  const s = scene(t, T.in - 0.1, T.out, 0.35, 0.3);
  if (!s.visible) return null;

  const tile1 = abs(DASH.tiles[0]);
  const panel = abs(DASH.panel);
  const row2 = { x: panel.x + DASH.rows[1].x, y: panel.y + DASH.rows[1].y, w: DASH.rows[1].w, h: DASH.rows[1].h };
  const shape = t < T.clickRow ? move(t, T.clickScope, tile1, panel) : move(t, T.clickRow, row2, panel);
  const inDash = t < T.clickScope + 0.05;
  const inList = t >= T.clickScope && t < T.clickRow + 0.2;
  const inCalc = t >= T.clickRow;
  const dashOut = ease(t, T.clickScope, 0.25);
  const listOut = ease(t, T.clickRow, 0.2);

  const cursor = cursorAt(
    t,
    [
      { t: b(12, 3), x: 1300, y: 1120 },
      { t: T.clickScope, x: tile1.x + 300, y: tile1.y + 120, click: true },
      { t: T.clickScope + 0.5, x: tile1.x + 330, y: tile1.y + 190 },
      { t: T.clickRow, x: row2.x + 960, y: row2.y + 70, click: true },
      { t: T.clickRow + 0.5, x: row2.x + 1000, y: row2.y + 170 },
      { t: T.tier + 0.6, x: 1840, y: 1100 },
    ],
    (x, y) => ({ x, y }),
  );

  return (
    <>
      <BrowserWindow path="/orgs/northgate/dashboard" style={s.style}>
        <Sidebar active="Dashboard" />
        <div style={{ position: "absolute", left: MAIN.x - 160, top: 0, right: 0, bottom: 0 }}>
          <div style={{ position: "absolute", left: 48, top: 36, opacity: 1 - dashOut }}>
            <div style={{ fontSize: 44, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>Dashboard</div>
            <div style={{ fontSize: 21, color: C.text2, marginTop: 6 }}>Live emissions operations for Northgate Civils Ltd.</div>
          </div>

          {inDash || dashOut < 1 ? (
            <div style={{ opacity: 1 - dashOut, filter: dashOut > 0 ? `blur(${dashOut * 10}px)` : undefined }}>
              <div style={{ position: "absolute", left: DASH.hero.x, top: DASH.hero.y, width: DASH.hero.w, height: DASH.hero.h, borderRadius: 14, background: C.accent, color: "#FFFFFF", padding: "28px 32px", boxSizing: "border-box", ...arrive(t, T.in, 16) }}>
                <div style={{ fontSize: 18, letterSpacing: "0.06em", fontWeight: 500 }}>TOTAL FOOTPRINT</div>
                <div style={{ fontSize: 70, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 14, fontVariantNumeric: "tabular-nums" }}>
                  {countUp(t, T.count, 1.4, 4710.05)} <span style={{ fontSize: 44 }}>tCO₂e</span>
                </div>
                <div style={{ fontSize: 20, marginTop: 10 }}>Scopes 1-3 · FY2025</div>
              </div>
              {TILES.map((tile, i) => (
                <Card key={tile.label} style={{ position: "absolute", left: DASH.tiles[i].x, top: DASH.tiles[i].y, width: DASH.tiles[i].w, height: DASH.tiles[i].h, padding: "24px 28px", boxSizing: "border-box", opacity: i === 0 ? 0 : 1, ...(i === 0 ? {} : arrive(t, T.tiles + i * 0.25, 14)) }}>
                  <div style={{ fontSize: 18, color: C.text2 }}>{tile.label}</div>
                  <div style={{ fontSize: 46, fontWeight: 700, color: tile.color, marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{countUp(t, T.tiles + i * 0.25, 0.6, tile.value)}</div>
                  <div style={{ fontSize: 18, color: C.text2 }}>tonnes</div>
                </Card>
              ))}
            </div>
          ) : null}

          {/* The shape that travels: Scope 1 tile -> records panel -> calculation panel. */}
          {t >= T.tiles - 0.05 ? (
            <Card style={{ position: "absolute", left: local(shape).x, top: local(shape).y, width: shape.w, height: shape.h, boxSizing: "border-box", ...(t < T.clickScope ? arrive(t, T.tiles, 14) : {}) }}>
              {inDash ? (
                <div style={{ padding: "24px 28px", opacity: 1 - ease(t, T.clickScope, 0.15) }}>
                  <div style={{ fontSize: 18, color: C.text2 }}>{TILES[0].label}</div>
                  <div style={{ fontSize: 46, fontWeight: 700, color: TILES[0].color, marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{countUp(t, T.tiles, 0.6, TILES[0].value)}</div>
                  <div style={{ fontSize: 18, color: C.text2 }}>tonnes</div>
                </div>
              ) : null}
              {inList && !inCalc ? <RecordList t={t} /> : null}
              {inCalc ? <Calculation t={t} /> : null}
            </Card>
          ) : null}
          {inList && t >= T.clickRow ? (
            <div style={{ position: "absolute", left: DASH.panel.x, top: DASH.panel.y, width: DASH.panel.w, opacity: 1 - listOut, filter: `blur(${listOut * 10}px)` }}>
              <RecordList t={t} />
            </div>
          ) : null}
        </div>
      </BrowserWindow>
      {t >= b(12, 3) - 0.5 && t < T.out ? <UserCursor x={cursor.x} y={cursor.y} squash={cursor.squash} /> : null}
    </>
  );
}

function RecordList({ t }: { t: number }) {
  return (
    <div style={{ padding: "30px 32px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, ...arrive(t, T.clickScope + 0.25, 10) }}>
        <span style={{ fontSize: 32, fontWeight: 700, color: C.text }}>Scope 1</span>
        <span style={{ fontSize: 26, fontWeight: 600, color: C.scope1, fontVariantNumeric: "tabular-nums" }}>910.56 tonnes</span>
      </div>
      <div style={{ fontSize: 20, color: C.muted, marginTop: 8, ...arrive(t, T.clickScope + 0.35, 10) }}>Records behind this figure</div>
      {RECORDS.map((r, i) => (
        <div
          key={r.source}
          style={{
            position: "absolute",
            left: DASH.rows[i].x,
            top: DASH.rows[i].y,
            width: DASH.rows[i].w,
            height: DASH.rows[i].h,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            background: i === 1 && t >= T.clickRow - 0.3 ? C.activeBg : C.card,
            display: "flex",
            alignItems: "center",
            padding: "0 28px",
            boxSizing: "border-box",
            gap: 24,
            fontSize: 22,
            ...arrive(t, T.list + i * 0.25, 14),
          }}
        >
          <span style={{ flex: 1, color: C.text, fontWeight: 500 }}>{r.source}</span>
          <span style={{ width: 170, color: C.text2 }}>{r.qty}</span>
          <span style={{ width: 200, color: C.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{r.co2e}</span>
          <span style={{ width: 150 }}>{r.tier ? <Chip tone="approved">{r.tier}</Chip> : <Chip tone="outline">Approved</Chip>}</span>
        </div>
      ))}
    </div>
  );
}

function Calculation({ t }: { t: number }) {
  const C0 = T.calc;
  return (
    <div style={{ padding: "32px 36px", position: "relative", height: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, ...arrive(t, C0 - 0.2, 10) }}>
        <span style={{ fontSize: 32, fontWeight: 700, color: C.text }}>Fuel receipt, Certas Energy</span>
        <span style={arrive(t, T.tier, 6)}>
          <Chip tone="approved">Verified</Chip>
        </span>
      </div>
      <div style={{ fontSize: 20, color: C.muted, marginTop: 8, ...arrive(t, C0 - 0.1, 10) }}>Scope 1: Mobile Combustion · A61 corridor works · FY2025</div>

      <div style={{ marginTop: 44, fontFamily: MONO, fontSize: 36, color: C.text, display: "flex", gap: 16, flexWrap: "wrap", letterSpacing: "-0.01em" }}>
        <span style={arrive(t, C0, 14)}>520 litre</span>
        <span style={arrive(t, C0 + 0.5, 14)}>× 0.03558 kg CO₂e/litre</span>
        <span style={{ color: C.accent, fontWeight: 600, ...arrive(t, C0 + 1.0, 14) }}>= 18.50 kg CO₂e</span>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 36, ...arrive(t, T.factor, 10) }}>
        <Chip tone="outline">DEFRA 2025.2</Chip>
        <Chip tone="outline">ghg-protocol-v2026-02</Chip>
        <Chip tone="outline">AR6</Chip>
      </div>
      <div style={{ fontSize: 21, color: C.text2, marginTop: 22, ...arrive(t, T.factor + 0.25, 10) }}>Biogenic CO₂ reported separately, outside the scopes</div>

      <div style={{ position: "absolute", right: 36, bottom: 32, display: "flex", alignItems: "center", gap: 20, ...arrive(t, T.tier + 0.25, 14) }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, color: C.muted }}>Evidence</div>
          <div style={{ fontSize: 20, color: C.text, fontFamily: MONO }}>receipt.jpg</div>
        </div>
        <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
          <ReceiptPhoto width={220} height={162} />
        </div>
      </div>
    </div>
  );
}
