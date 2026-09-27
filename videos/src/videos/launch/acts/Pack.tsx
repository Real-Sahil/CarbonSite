import { cursorAt, UserCursor } from "../../../kit/cursor";
import { step } from "../../../kit/spring";
import { Card } from "../../../ui/App";
import { arrive, scene } from "../../../ui/motion";
import { C, FONT, MONO } from "../../../ui/tokens";
import { b, CUE } from "../cues";

/**
 * Bars 21-22: the assurance pack (lib/assurance/pack.ts). The stacked
 * documents become the ZIP's file list, landing on eighths: README, every
 * calculation, the factors, the evidence index and files, the audit log with
 * its hash chain, and the SHA-256 manifest. Nothing is recalculated.
 */
const K = CUE.pack;
const FILES = ["README.txt", "calculations.csv", "factors.csv", "evidence-index.csv", "evidence/", "audit-log.csv", "manifest.sha256"];
const BOX = { x: 560, y: 150, w: 800, h: 780 };
const BUTTON = { x: BOX.x + 48, y: BOX.y + BOX.h - 110, w: 360, h: 64 };

export function Pack({ t }: { t: number }) {
  const s = scene(t, K.in - 0.05, K.out, 0.3, 0.3);
  if (!s.visible) return null;
  const grow = step(t - K.in, { stiffness: 150, damping: 20 });
  const cursor = cursorAt(
    t,
    [
      { t: K.zip, x: 1500, y: 1120 },
      { t: K.download, x: BUTTON.x + BUTTON.w * 0.72, y: BUTTON.y + BUTTON.h * 0.62, click: true },
      { t: K.download + 0.5, x: BUTTON.x + BUTTON.w + 40, y: BUTTON.y + BUTTON.h + 40 },
    ],
    (x, y) => ({ x, y }),
  );
  return (
    <>
      <div style={{ position: "absolute", inset: 0, ...s.style }}>
        <Card style={{ position: "absolute", left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h, boxSizing: "border-box", padding: "40px 48px", fontFamily: FONT, scale: String(0.85 + 0.15 * grow), boxShadow: "0 40px 120px rgba(0,0,0,0.55)" }}>
          <div style={{ fontSize: 20, color: C.muted, letterSpacing: "0.06em", fontWeight: 600 }}>ASSURANCE PACK</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: C.text, marginTop: 8, fontFamily: MONO, letterSpacing: "-0.02em" }}>assurance-pack-FY2025.zip</div>
          <div style={{ marginTop: 28, display: "grid", gap: 6 }}>
            {FILES.map((f, i) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: MONO, fontSize: 25, color: C.text, height: 50, borderBottom: `1px solid ${C.border}`, ...arrive(t, K.in + 0.1 + i * 0.25, 14, 0.25) }}>
                <FileIcon folder={f.endsWith("/")} />
                {f}
              </div>
            ))}
          </div>
          <div
            style={{
              position: "absolute",
              left: BUTTON.x - BOX.x,
              top: BUTTON.y - BOX.y,
              width: BUTTON.w,
              height: BUTTON.h,
              borderRadius: 10,
              background: t >= K.download ? C.accentHover : C.accent,
              color: "#FFFFFF",
              display: "grid",
              placeItems: "center",
              fontSize: 22,
              fontWeight: 600,
              ...arrive(t, K.zip, 10),
            }}
          >
            Download assurance pack
          </div>
          <div style={{ position: "absolute", right: 48, top: 44, fontSize: 16, fontWeight: 500, color: C.amberFg, background: C.amberBg, borderRadius: 999, padding: "5px 12px" }}>Demo data</div>
        </Card>
      </div>
      {t >= b(22, 1) - 0.3 && t < K.out ? <UserCursor x={cursor.x} y={cursor.y} squash={cursor.squash} /> : null}
    </>
  );
}

function FileIcon({ folder }: { folder: boolean }) {
  return folder ? (
    <svg width={28} height={24} viewBox="0 0 28 24">
      <path d="M2 4 h9 l3 3 h12 v15 h-24 z" fill={C.activeBg} stroke={C.accent} strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width={24} height={28} viewBox="0 0 24 28">
      <path d="M3 2 h12 l6 6 v18 h-18 z" fill="#FFFFFF" stroke={C.muted} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M15 2 v6 h6" fill="none" stroke={C.muted} strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  );
}
