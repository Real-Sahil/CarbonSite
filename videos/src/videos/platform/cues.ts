import { at, type Grid } from "../../kit/time";
import type { EndCue } from "../launch/acts/Brand";

/**
 * The platform film's beat sheet as data. 120 BPM, 4/4, bar 1 on the first frame,
 * 45 bars = 90 s. Bars 1-24 reuse the launch acts, which read the launch cues; those
 * bars sit on this same grid, so the timings match. Bars 25-38 are the product
 * screens, bars 39-40 the feature montage, bars 41-45 the ending. Scene code reads
 * times from here.
 */
export const GRID: Grid = { bpm: 120, firstBeat: 0, pickupBeats: 0, beatsPerBar: 4 };
export const b = (bar: number, beat = 1, fraction = 0) => at(GRID, bar, beat, fraction);

export const BARS = 45;
export const DURATION = b(BARS + 1); // 90 s

/**
 * Bars 25-38 (48-76 s): eight product screens, 3.5 s each (seven beats, so each cut
 * lands on a beat). Bars 39-40 (76-80 s): one 4 s montage of six feature tiles.
 */
export const SCREEN_SECONDS = 3.5;
export const SCREEN_COUNT = 8;
export const SCREENS_IN = b(25);
export const MONTAGE_IN = b(39);
export const SCREENS_OUT = b(41);

export type ScreenSlot = { from: number; to: number };
export const slot = (index: number): ScreenSlot => ({
  from: SCREENS_IN + index * SCREEN_SECONDS,
  to: SCREENS_IN + (index + 1) * SCREEN_SECONDS,
});

/** Bars 41-45: the lockup, the call to action, the address, the Android app. */
export const END: EndCue = {
  in: b(41),
  draw: b(41, 2),
  word: b(41, 4),
  rise: b(42, 1),
  cta: b(42, 2),
  url: b(42, 4),
  docs: b(43, 1),
  app: b(43, 3),
  hover: b(44, 1),
  fade: b(45, 1),
};
