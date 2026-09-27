import { at, type Grid } from "../../kit/time";

/**
 * The launch film's beat sheet as data. The score (scripts/compose.py) is
 * written on this grid: 120 BPM, 4/4, bar 1 on the first frame, 28 bars.
 * Measured with scripts/beats.py: 119.985 BPM, grid spread 2 ms.
 * Scene code reads times from here only, never literal frame numbers.
 */
export const GRID: Grid = { bpm: 120, firstBeat: 0, pickupBeats: 0, beatsPerBar: 4 };
export const b = (bar: number, beat = 1, fraction = 0) => at(GRID, bar, beat, fraction);

export const BARS = 28;
export const DURATION = b(BARS + 1); // 56 s

export const CUE = {
  // Bars 1-2: the mark scales in on the downbeat, the M draws, the wordmark lands.
  open: { in: b(1), draw: b(1, 2), word: b(2), out: b(2, 4, 0.5) },
  // Bars 3-4: "Carbon figures that hold up / when someone checks them."
  // Bars 5-8: field app capture of a fuel receipt.
  phone: {
    in: b(5),
    tapTile: b(5, 3),
    camera: b(5, 4),
    shutter: b(6, 3),
    scan: b(6, 4),
    form: b(7, 1),
    submit: b(8, 1),
    syncing: b(8, 2),
    submitted: b(8, 3),
    travel: b(8, 4),
  },
  // Bars 9-10: the submission lands in the web review queue and is approved.
  review: { in: b(9), rows: b(9, 1, 0.5), approve: b(10, 1), out: b(10, 4, 0.5) },
  // Bar 11: "Open any figure."
  // Bars 12-15: trace a figure, from the headline to the receipt.
  trace: {
    in: b(12),
    count: b(12, 1, 0.5),
    tiles: b(12, 3),
    clickScope: b(13, 1),
    list: b(13, 2),
    clickRow: b(14, 1),
    calc: b(14, 2),
    factor: b(15, 1),
    tier: b(15, 2),
    out: b(15, 4, 0.5),
  },
  // Bar 16: "The three documents most contractors need." (the build; last beat silent)
  // Bars 17-20: the drop. Three documents land, the Carbon Reduction Plan comes forward.
  docs: { in: b(17), crp: b(18), total: b(19), generated: b(19, 3), stack: b(20, 3), out: b(20, 4, 0.5) },
  // Bars 21-22: the assurance pack.
  pack: { in: b(21), zip: b(22, 1), download: b(22, 3), out: b(22, 4, 0.5) },
  // Bars 23-24: "From site paperwork / to a published figure."
  // Bars 25-28: the lockup and the call to action.
  end: { in: b(25), draw: b(25, 2), word: b(25, 4), rise: b(26, 1), cta: b(26, 2), url: b(26, 4), docs: b(27, 1), app: b(27, 3), hover: b(28, 1), fade: b(28, 3) },
} as const;
