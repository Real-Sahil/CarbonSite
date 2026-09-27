import { cursorAt, UserCursor } from "../../../kit/cursor";
import { move } from "../../../kit/move";
import { BrowserWindow, Card, Chip, Sidebar } from "../../../ui/App";
import { arrive, ease, scene } from "../../../ui/motion";
import { ReceiptPhoto } from "../../../ui/Receipt";
import { C } from "../../../ui/tokens";
import { b, CUE } from "../cues";
import { MAIN, REVIEW, REVIEW_PHOTO, THUMB_RECT } from "../layout";

/**
 * Bars 9-10: the submission in the web review page (twin of
 * app/(app)/orgs/[orgId]/submissions/[id], demo tenant values from the
 * submission-review screenshot). The receipt photo arrives from the phone
 * (magic move), the reviewer approves it.
 */
const R = CUE.review;

const ROWS: [string, string][] = [
  ["Document type", "Fuel receipt"],
  ["Reporting period", "FY2025"],
  ["Category", "Scope 1: Mobile Combustion"],
  ["Facility", "A61 corridor works"],
  ["Date", "2025-11-24"],
  ["Volume", "520"],
  ["Fuel type", "HVO"],
  ["Volume unit", "litres"],
  ["Supplier name", "Certas Energy"],
];

// Click on the button's right edge, never over its label.
const approveAt = { x: MAIN.x + REVIEW.approve.x + REVIEW.approve.w * 0.86, y: MAIN.y + REVIEW.approve.y + REVIEW.approve.h * 0.66 };

export function Review({ t }: { t: number }) {
  const s = scene(t, R.in - 0.15, R.out, 0.35, 0.3);
  const travelling = t >= CUE.phone.travel && t < R.out + 0.05;
  const approved = t >= R.approve;
  const photo = move(t, CUE.phone.travel, THUMB_RECT, REVIEW_PHOTO, { stiffness: 110, damping: 19 });
  const cursor = cursorAt(
    t,
    [
      { t: b(9, 3), x: 1500, y: 1100 },
      { t: R.approve, x: approveAt.x, y: approveAt.y, click: true },
      { t: R.approve + 0.6, x: approveAt.x + 60, y: approveAt.y + 70 },
    ],
    (x, y) => ({ x, y }),
  );

  return (
    <>
      {s.visible ? (
        <BrowserWindow path="/orgs/northgate/submissions" style={s.style}>
          <Sidebar active="Submissions" />
          <div style={{ position: "absolute", left: MAIN.x - 160, top: 0, right: 0, bottom: 0 }}>
            <div style={{ position: "absolute", left: 48, top: 30, fontSize: 19, color: C.muted }}>Back to submissions</div>
            <div style={{ position: "absolute", left: 48, top: 66, display: "flex", alignItems: "center", gap: 20 }}>
              <span style={{ fontSize: 44, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>Fuel receipt</span>
              <span style={{ display: "grid" }}>
                <span style={{ gridArea: "1/1", opacity: 1 - ease(t, R.approve, 0.25) }}>
                  <Chip tone="outline">In review</Chip>
                </span>
                <span style={{ gridArea: "1/1", ...arrive(t, R.approve, 6, 0.25) }}>
                  <Chip tone="approved">Approved</Chip>
                </span>
              </span>
            </div>
            <div style={{ position: "absolute", left: 48, top: 140, fontSize: 20, color: C.text2, display: "flex", gap: 24 }}>
              <span>Submitted by Dan Mitchell on 24 November 2025</span>
              <span style={arrive(t, R.approve + 0.25, 6)}>Reviewed by Sam Hartley at 25 Nov 2025, 09:15</span>
            </div>

            <Card style={{ position: "absolute", left: REVIEW.details.x, top: REVIEW.details.y, width: REVIEW.details.w, height: REVIEW.details.h, padding: "26px 30px" }}>
              <div style={{ fontSize: 26, fontWeight: 600, color: C.text, marginBottom: 14 }}>Submission details</div>
              {ROWS.map(([label, value], i) => (
                <div key={label} style={{ display: "flex", height: 57, alignItems: "center", fontSize: 21, ...arrive(t, R.rows + i * 0.125, 10, 0.25) }}>
                  <span style={{ width: 240, color: C.text2 }}>{label}</span>
                  <span style={{ color: C.text }}>{value}</span>
                </div>
              ))}
            </Card>

            <Card style={{ position: "absolute", left: REVIEW.photoCard.x, top: REVIEW.photoCard.y, width: REVIEW.photoCard.w, height: REVIEW.photoCard.h, padding: "26px 28px" }}>
              <div style={{ fontSize: 26, fontWeight: 600, color: C.text }}>Receipt photo</div>
            </Card>

            <div style={{ position: "absolute", left: REVIEW.approve.x, top: REVIEW.approve.y, display: "flex", gap: 20, ...arrive(t, R.rows + 0.6, 10) }}>
              <div style={{ width: REVIEW.approve.w, height: REVIEW.approve.h, borderRadius: 10, background: approved ? C.accentHover : C.accent, color: "#FFFFFF", display: "grid", placeItems: "center", fontSize: 22, fontWeight: 600, scale: String(t >= R.approve && t < R.approve + 0.15 ? 0.97 : 1) }}>
                Approve
              </div>
              <div style={{ width: REVIEW.reject.w, height: REVIEW.reject.h, borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.text2, display: "grid", placeItems: "center", fontSize: 22 }}>Reject</div>
            </div>
          </div>
        </BrowserWindow>
      ) : null}

      {travelling ? (
        <div
          style={{
            position: "absolute",
            left: photo.x,
            top: photo.y,
            width: photo.w,
            height: photo.h,
            borderRadius: 16 - 4 * ease(t, CUE.phone.travel, 0.6),
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            opacity: t > R.out - 0.3 ? s.style.opacity : 1,
            filter: t > R.out - 0.3 ? s.style.filter : undefined,
          }}
        >
          <div style={{ width: THUMB_RECT.w, height: THUMB_RECT.h, scale: String(photo.w / THUMB_RECT.w), transformOrigin: "0 0" }}>
            <ReceiptPhoto width={THUMB_RECT.w} height={THUMB_RECT.h} />
          </div>
        </div>
      ) : null}

      {t >= b(9, 3) - 0.5 && t < R.out ? <UserCursor x={cursor.x} y={cursor.y} squash={cursor.squash} /> : null}
    </>
  );
}
