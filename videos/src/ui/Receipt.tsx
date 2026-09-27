import { C, MONO } from "./tokens";

/**
 * The fuel receipt the field worker photographs: drawn, not a photo, with the
 * demo tenant's approved submission (Certas Energy, 520 litres HVO, A61
 * corridor works, 24 November 2025). `highlight` outlines the fields OCR read.
 */
export const READ_FIELDS = ["supplier", "date", "product", "qty"] as const;

export function Receipt({ width, highlight = [] }: { width: number; highlight?: readonly (typeof READ_FIELDS)[number][] }) {
  const s = width / 400;
  const line = (key: string, label: string, value: string, id?: (typeof READ_FIELDS)[number]) => (
    <div
      key={key}
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: `${4 * s}px ${6 * s}px`,
        margin: `0 ${-6 * s}px`,
        borderRadius: 4 * s,
        outline: id && highlight.includes(id) ? `${2.5 * s}px solid #22C55E` : "none",
        background: id && highlight.includes(id) ? "rgba(34,197,94,0.12)" : "transparent",
      }}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
  return (
    <div
      style={{
        width,
        padding: `${26 * s}px ${30 * s}px`,
        background: "#FBFAF6",
        color: "#26231E",
        fontFamily: MONO,
        fontSize: 17 * s,
        lineHeight: 1.45,
        boxShadow: `0 ${10 * s}px ${30 * s}px rgba(0,0,0,0.35)`,
        borderRadius: 3 * s,
      }}
    >
      <div
        style={{
          textAlign: "center",
          fontWeight: 700,
          fontSize: 24 * s,
          letterSpacing: "0.06em",
          borderRadius: 4 * s,
          outline: highlight.includes("supplier") ? `${2.5 * s}px solid #22C55E` : "none",
          background: highlight.includes("supplier") ? "rgba(34,197,94,0.12)" : "transparent",
        }}
      >
        CERTAS ENERGY
      </div>
      <div style={{ textAlign: "center", fontSize: 14 * s, color: "#6B665C", marginBottom: 12 * s }}>Fuel delivery note</div>
      <div style={{ borderTop: `${1.5 * s}px dashed #B8B2A6`, margin: `${6 * s}px 0` }} />
      {line("d", "Date", "24/11/2025", "date")}
      {line("s", "Site", "A61 corridor works")}
      {line("p", "Product", "HVO", "product")}
      {line("q", "Quantity", "520.00 L", "qty")}
      <div style={{ borderTop: `${1.5 * s}px dashed #B8B2A6`, margin: `${8 * s}px 0` }} />
      <div style={{ fontSize: 13 * s, color: "#6B665C" }}>Received by</div>
      <svg width={180 * s} height={34 * s} viewBox="0 0 180 34">
        <path d="M4 24 C 20 4, 30 30, 44 16 S 70 8, 84 22 S 120 30, 132 12 S 160 20, 176 18" stroke={C.text2} strokeWidth={2} fill="none" />
      </svg>
    </div>
  );
}

/** The receipt as photographed: on the cab dashboard, slightly turned. Same framing at every size. */
export function ReceiptPhoto({ width, height, highlight }: { width: number; height: number; highlight?: readonly (typeof READ_FIELDS)[number][] }) {
  return (
    <div style={{ width, height, overflow: "hidden", position: "relative", background: "radial-gradient(120% 90% at 40% 30%, #4A504B, #262B28)" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%", rotate: "-3deg" }}>
        <Receipt width={Math.min(width * 0.8, height * 1.02)} highlight={highlight} />
      </div>
    </div>
  );
}
