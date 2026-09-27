import { step } from "../../../kit/spring";
import { clamp01 } from "../../../kit/time";
import { Chip } from "../../../ui/App";
import { Mark } from "../../../ui/Logo";
import { arrive, ease } from "../../../ui/motion";
import { C, FONT } from "../../../ui/tokens";
import { CUE } from "../cues";

/**
 * Bars 17-20, the drop: the three documents most contractors need (Carbon
 * Reduction Plan, SECR, GHG Protocol report) land on the downbeats, then the
 * Carbon Reduction Plan comes forward with the published figures (demo tenant
 * FY2025, crp-emissions screenshot). Bar 20 stacks them for the pack.
 */
const D = CUE.docs;
const PAGE = { w: 420, h: 594 };

const DOCS = [
  { title: "Carbon Reduction Plan", sub: "PPN 006 · FY2025", x: 960, rot: 0, at: D.in },
  { title: "SECR report", sub: "Streamlined Energy and Carbon Reporting · FY2025", x: 520, rot: -7, at: D.in + 0.5 },
  { title: "GHG Protocol report", sub: "Scopes 1, 2 and 3 · FY2025", x: 1400, rot: 7, at: D.in + 1.0 },
];

const FIGURES: [string, string][] = [
  ["Scope 1", "910.6 tCO₂e"],
  ["Scope 2 (location-based)", "154.6 tCO₂e"],
  ["Scope 3", "3,644.9 tCO₂e"],
];

export function Docs({ t }: { t: number }) {
  if (t < D.in - 0.05 || t > CUE.pack.in + 0.6) return null;
  const forward = step(t - D.crp, { stiffness: 120, damping: 20 });
  const push = step(t - D.total, { stiffness: 90, damping: 18 });
  const stack = step(t - D.stack, { stiffness: 140, damping: 22 });
  const gone = clamp01((t - CUE.pack.in) / 0.35);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - gone, filter: gone > 0 ? `blur(${gone * 12}px)` : undefined }}>
      {[...DOCS].reverse().map((doc, idx) => {
        const i = DOCS.length - 1 - idx;
        const land = step(t - doc.at, { stiffness: 170, damping: 17 });
        const isCrp = i === 0;
        // CRP comes forward and grows; the others slide back and dim.
        const scale = isCrp ? 1 + 0.55 * forward + 0.08 * push - 0.62 * stack : 1 - 0.12 * forward - 0.3 * stack;
        const x = isCrp ? doc.x : doc.x + (doc.x < 960 ? -140 : 140) * forward + (960 - doc.x - (doc.x < 960 ? -140 : 140)) * stack;
        const rot = doc.rot * (1 - stack) + (i === 1 ? -3 : i === 2 ? 3 : 0) * stack;
        const dim = isCrp ? 0 : 0.55 * forward * (1 - stack);
        return (
          <div
            key={doc.title}
            style={{
              position: "absolute",
              left: x - PAGE.w / 2,
              top: 540 - PAGE.h / 2 + (1 - land) * 420 + (isCrp ? -10 * forward : 0),
              width: PAGE.w,
              height: PAGE.h,
              rotate: `${rot}deg`,
              scale: String(Math.max(0.01, scale * (0.7 + 0.3 * land))),
              opacity: clamp01(land * 3) * (1 - dim),
              filter: dim > 0.05 ? `blur(${dim * 6}px)` : undefined,
              zIndex: isCrp ? 3 : 1,
            }}
          >
            <Page t={t} title={doc.title} sub={doc.sub} detailed={isCrp} />
          </div>
        );
      })}
    </div>
  );
}

function Page({ t, title, sub, detailed }: { t: number; title: string; sub: string; detailed: boolean }) {
  const rows = detailed && t >= D.crp;
  return (
    <div style={{ width: "100%", height: "100%", background: "#FFFFFF", borderRadius: 6, boxShadow: "0 30px 80px rgba(0,0,0,0.5)", fontFamily: FONT, padding: "30px 30px", boxSizing: "border-box", position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Mark t={1} appear={0} draw={0} size={22} />
        <span style={{ fontSize: 11, color: C.muted }}>Northgate Civils Ltd</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: C.text, marginTop: 26, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{title}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>{sub}</div>
      <div style={{ height: 3, width: 48, background: C.accent, marginTop: 16, borderRadius: 2 }} />
      {rows ? (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 10, color: C.approvedFg, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 4, padding: "6px 8px", ...arrive(t, D.crp + 0.2, 6) }}>
            Published snapshot v2, 25 Sept 2026. The plan will print these figures.
          </div>
          {FIGURES.map(([label, value], i) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "9px 0", borderBottom: `1px solid ${C.border}`, color: C.text, ...arrive(t, D.crp + 0.5 + i * 0.25, 6) }}>
              <span style={{ color: C.text2 }}>{label}</span>
              <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, padding: "11px 0", color: C.text, ...arrive(t, D.total, 6) }}>
            <span style={{ fontWeight: 600 }}>Total</span>
            <span style={{ fontWeight: 700, color: C.accent, fontVariantNumeric: "tabular-nums" }}>4,710.1 tCO₂e</span>
          </div>
          <div style={{ marginTop: 14, scale: "0.7", transformOrigin: "0 0", ...arrive(t, D.generated, 6) }}>
            <Chip tone="approved">Generated</Chip>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 26, display: "grid", gap: 10 }}>
          {[0.92, 0.8, 0.86, 0.6, 0.9, 0.74, 0.84, 0.5].map((w, i) => (
            <div key={i} style={{ height: 7, width: `${w * 100}%`, background: "#EEF0F2", borderRadius: 4 }} />
          ))}
        </div>
      )}
      <div style={{ position: "absolute", left: 30, right: 30, bottom: 22, fontSize: 9, color: C.muted, opacity: ease(t, D.in + 0.3, 0.3) }}>Demo data</div>
    </div>
  );
}
