import type { Rect } from "../../kit/move";
import { SIDEBAR, WINDOW } from "../../ui/App";

/** Screen-space layout for the launch film, 1920x1080. Measured values are marked. */
export const PHONE = { x: 725, y: 70, w: 470, h: 940 };
export const SCREEN = { inset: 14, w: 442, h: 912 };
/** The receipt photo on the phone form (screen-relative sx/sy). */
export const THUMB = { sx: 24, sy: 124, w: 394, h: 290 };
export const THUMB_RECT: Rect = { x: PHONE.x + SCREEN.inset + THUMB.sx, y: PHONE.y + SCREEN.inset + THUMB.sy, w: THUMB.w, h: THUMB.h };

/** The app's main area inside the browser window (right of the sidebar, under the toolbar). */
export const MAIN = { x: WINDOW.x + SIDEBAR, y: WINDOW.y + WINDOW.bar, w: WINDOW.w - SIDEBAR, h: WINDOW.h - WINDOW.bar };

/** Review page: details card on the left, the receipt photo card on the right. */
export const REVIEW = {
  details: { x: 48, y: 196, w: 690, h: 600 },
  photoCard: { x: 770, y: 196, w: 490, h: 420 },
  approve: { x: 770, y: 640, w: 240, h: 60 },
  reject: { x: 1030, y: 640, w: 170, h: 60 },
};
export const REVIEW_PHOTO: Rect = { x: MAIN.x + REVIEW.photoCard.x + 28, y: MAIN.y + REVIEW.photoCard.y + 74, w: 434, h: 320 };

/** Dashboard: hero card and the three scope tiles, then the panel they open into. */
export const DASH = {
  hero: { x: 48, y: 150, w: 520, h: 250 },
  tiles: [0, 1, 2].map((i) => ({ x: 48 + i * 412, y: 430, w: 392, h: 170 })),
  panel: { x: 48, y: 150, w: 1214, h: 640 },
  rows: [0, 1].map((i) => ({ x: 32, y: 150 + i * 132, w: 1150, h: 112 })),
};
export const abs = (r: { x: number; y: number; w: number; h: number }): Rect => ({ x: MAIN.x + r.x, y: MAIN.y + r.y, w: r.w, h: r.h });
