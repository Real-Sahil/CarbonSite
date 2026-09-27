import { step } from "../../../kit/spring";
import { clamp01 } from "../../../kit/time";
import { arrive, ease, tap } from "../../../ui/motion";
import { ReceiptPhoto } from "../../../ui/Receipt";
import { C, FONT } from "../../../ui/tokens";
import { CUE } from "../cues";
import { PHONE, SCREEN, THUMB } from "../layout";

/**
 * Bars 5-8: the field app (twin of mobile/lib/features/capture, Material 3
 * seeded #1B5E20) in a neutral Android frame. Fuel Receipt tile, camera,
 * on-device OCR, the pre-filled form, submit and sync. The photo then leaves
 * the phone for the review page (Review.tsx carries it).
 */
const P = CUE.phone;

const TILES = ["Waste Ticket", "Delivery Note", "Fuel Receipt", "Social Value", "Hazard / Near Miss", "Site Inspection"];
const FIELDS = [
  { label: "Fuel type", value: "HVO" },
  { label: "Volume (litres)", value: "520" },
  { label: "Supplier", value: "Certas Energy" },
  { label: "Date", value: "2025-11-24" },
  { label: "Site", value: "A61 corridor works" },
];

export function FieldApp({ t }: { t: number }) {
  if (t < P.in || t > P.travel + 0.9) return null;
  const rise = step(t - P.in, { stiffness: 120, damping: 20 });
  const leave = ease(t, P.travel, 0.7);
  const x = PHONE.x - leave * 760;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: PHONE.y + (1 - rise) * 700,
        width: PHONE.w,
        height: PHONE.h,
        borderRadius: 64,
        background: "#0E1311",
        boxShadow: "0 40px 120px rgba(0,0,0,0.6), inset 0 0 0 2px #2A332F",
        opacity: 1 - leave,
        filter: leave > 0 ? `blur(${leave * 10}px)` : undefined,
      }}
    >
      <div style={{ position: "absolute", left: SCREEN.inset, top: SCREEN.inset, width: SCREEN.w, height: SCREEN.h, borderRadius: 50, overflow: "hidden", background: C.appSurface, fontFamily: FONT }}>
        <Screens t={t} />
        <StatusBar dark={t >= P.camera + 0.2 && t < P.form + 0.15} />
      </div>
    </div>
  );
}

function StatusBar({ dark }: { dark: boolean }) {
  const color = dark ? "#FFFFFF" : C.appOn;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 44, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 30px", fontSize: 17, fontWeight: 600, color }}>
      <span>07:42</span>
      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ width: 18, height: 12, borderRadius: 2, border: `2px solid ${color}` }} />
      </span>
    </div>
  );
}

/** Each screen fades in over the one before it, which stays drawn until the fade ends. */
function Screens({ t }: { t: number }) {
  return (
    <>
      {t < P.camera + 0.4 ? <Home t={t} /> : null}
      {t >= P.camera && t < P.form + 0.4 ? <Camera t={t} /> : null}
      {t >= P.form ? <Form t={t} /> : null}
    </>
  );
}

function AppBar({ title, sub, trailing }: { title: string; sub?: string; trailing?: React.ReactNode }) {
  return (
    <div style={{ padding: "58px 26px 14px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: 30, fontWeight: 600, color: C.appOn }}>{title}</div>
        {sub ? <div style={{ fontSize: 18, color: C.appOn2, marginTop: 2 }}>{sub}</div> : null}
      </div>
      {trailing}
    </div>
  );
}

function Home({ t }: { t: number }) {
  const hit = tap(t, P.tapTile);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <AppBar title="Capture" sub="A61 corridor works" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: "10px 22px" }}>
        {TILES.map((label, i) => {
          const pressed = label === "Fuel Receipt" && t >= P.tapTile && t < P.camera;
          return (
            <div
              key={label}
              style={{
                ...arrive(t, P.in + 0.25 + i * 0.0625, 14),
                height: 150,
                borderRadius: 20,
                background: pressed ? "#C8DFC0" : C.appContainer,
                padding: 18,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
              }}
            >
              <TileIcon kind={i} />
              <span style={{ fontSize: 20, fontWeight: 600, color: C.appOn, lineHeight: 1.15 }}>{label}</span>
              {label === "Fuel Receipt" && hit.visible ? (
                <span style={{ position: "absolute", left: "50%", top: "50%", width: 120, height: 120, marginLeft: -60, marginTop: -60, borderRadius: 60, background: "#000", opacity: hit.opacity, scale: String(hit.scale) }} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Camera({ t }: { t: number }) {
  const flash = t >= P.shutter ? 1 - clamp01((t - P.shutter) / 0.3) : 0;
  const scan = clamp01((t - P.scan) / 0.9);
  const found = (["supplier", "date", "product", "qty"] as const).filter((_, i) => t >= P.scan + 0.25 + i * 0.25);
  const press = tap(t, P.shutter);
  const enter = ease(t, P.camera, 0.35);
  return (
    <div style={{ position: "absolute", inset: 0, background: "#000", opacity: enter }}>
      <div style={{ position: "absolute", left: 0, top: 70, scale: String(t < P.shutter ? 1.04 - 0.04 * ease(t, P.camera, 1.2) : 1) }}>
        <ReceiptPhoto width={SCREEN.w} height={640} highlight={found} />
      </div>
      {t >= P.scan && scan < 1 ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 70 + 640 * scan, height: 3, background: "#4ADE80" }} />
      ) : null}
      <div style={{ position: "absolute", left: 0, right: 0, top: 734, textAlign: "center", color: "#FFFFFF", fontSize: 20, opacity: t >= P.scan ? 1 : 0.8 }}>
        {t < P.shutter ? "Fit the ticket in the frame" : t < P.scan + 1.2 ? "Reading on this phone" : "Read 4 fields"}
      </div>
      <div style={{ position: "absolute", left: "50%", top: 792, width: 92, height: 92, marginLeft: -46, borderRadius: 46, border: "5px solid #FFFFFF", display: "grid", placeItems: "center" }}>
        <span style={{ width: 72, height: 72, borderRadius: 36, background: "#FFFFFF", scale: String(press.visible ? 0.86 : 1) }} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", opacity: flash }} />
    </div>
  );
}

function Form({ t }: { t: number }) {
  const submitHit = tap(t, P.submit);
  const status =
    t < P.submit ? null : t < P.syncing ? { label: "Pending", bg: "#FEF3C7", fg: "#92400E" } : t < P.submitted ? { label: "Syncing", bg: "#DBEAFE", fg: "#1E40AF" } : { label: "Submitted", bg: "#E2E8F0", fg: "#334155" };
  const enter = ease(t, P.form, 0.3);
  const thumbHidden = t >= P.travel;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: enter, background: C.appSurface }}>
      <AppBar
        title="Fuel receipt"
        trailing={status ? <span style={{ fontSize: 17, fontWeight: 600, borderRadius: 999, padding: "6px 14px", background: status.bg, color: status.fg }}>{status.label}</span> : null}
      />
      <div style={{ position: "absolute", left: THUMB.sx, top: THUMB.sy, width: THUMB.w, height: THUMB.h, borderRadius: 16, overflow: "hidden", opacity: thumbHidden ? 0 : 1 }}>
        <ReceiptPhoto width={THUMB.w} height={THUMB.h} />
      </div>
      <div style={{ position: "absolute", left: 24, right: 24, top: 430, display: "grid", gap: 10 }}>
        {FIELDS.map((f, i) => {
          const at = P.form + 0.25 + i * 0.3;
          return (
            <div key={f.label} style={{ height: 60, border: `1.5px solid ${t >= at ? C.appSeed : "#C3C8BC"}`, borderRadius: 10, padding: "6px 16px", position: "relative" }}>
              <div style={{ fontSize: 14, color: t >= at ? C.appSeed : C.appOn2 }}>{f.label}</div>
              <div style={{ fontSize: 21, color: C.appOn, ...arrive(t, at, 8, 0.25) }}>{f.value}</div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          top: 804,
          height: 60,
          borderRadius: 30,
          background: t >= P.submitted ? C.appContainer : C.appSeed,
          color: t >= P.submitted ? C.appSeed : "#FFFFFF",
          display: "grid",
          placeItems: "center",
          fontSize: 21,
          fontWeight: 600,
          overflow: "hidden",
        }}
      >
        {t >= P.submit && t < P.submitted ? <Spinner t={t} /> : t >= P.submitted ? "Submitted for review" : "Submit"}
        {submitHit.visible ? <span style={{ position: "absolute", left: "50%", top: "50%", width: 140, height: 140, marginLeft: -70, marginTop: -70, borderRadius: 70, background: "#000", opacity: submitHit.opacity, scale: String(submitHit.scale) }} /> : null}
      </div>
    </div>
  );
}

/** Frame-driven twin of Material's circular progress: one turn every 0.8 s. */
function Spinner({ t }: { t: number }) {
  return (
    <svg width={30} height={30} viewBox="0 0 30 30" style={{ rotate: `${(t / 0.8) * 360}deg` }}>
      <circle cx={15} cy={15} r={12} stroke="#FFFFFF" strokeWidth={3.5} fill="none" strokeDasharray="50 100" strokeLinecap="round" />
    </svg>
  );
}

/** Simple line glyphs for the capture tiles (the app uses Material icons). */
function TileIcon({ kind }: { kind: number }) {
  const paths = [
    "M6 5h12v14l-3-2-3 2-3-2-3 2z M9 9h6 M9 12h6", // ticket
    "M3 8h11v8H3z M14 11h4l3 3v2h-7 M7 18a1.5 1.5 0 1 0 0.01 0 M17 18a1.5 1.5 0 1 0 0.01 0", // truck
    "M5 20V5h8v15 M5 11h8 M13 8l4 3v7a1.5 1.5 0 0 0 3 0v-8l-3-3", // fuel pump
    "M12 19s-7-4.5-7-9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 2.5C19 14.5 12 19 12 19z", // heart
    "M12 4l9 16H3z M12 10v4 M12 17v0.5", // warning
    "M8 4h8v3H8z M6 6h12v14H6z M9 12l2 2 4-4", // clipboard
  ];
  return (
    <span style={{ width: 46, height: 46, borderRadius: 23, background: C.appSeed, display: "grid", placeItems: "center" }}>
      <svg width={26} height={26} viewBox="0 0 24 24">
        <path d={paths[kind]} fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
