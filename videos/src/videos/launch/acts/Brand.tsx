import { cursorAt, UserCursor } from "../../../kit/cursor";
import { step } from "../../../kit/spring";
import { clamp01 } from "../../../kit/time";
import { Punchlines, type Card } from "../../../kit/punchlines";
import { Mark, Wordmark } from "../../../ui/Logo";
import { arrive } from "../../../ui/motion";
import { C, FONT } from "../../../ui/tokens";
import { b, CUE, DURATION } from "../cues";

/** Lockup geometry at 1080p: mark 150 px, gap 40 px, wordmark 136 px (measured width 640). */
const LOCK = { mark: 150, gap: 40, word: 136, wordW: 640 };

function Lockup({ t, appear, draw, word, y, out }: { t: number; appear: number; draw: number; word: number; y: number; out: number }) {
  const slide = step(t - word, { stiffness: 150, damping: 21 });
  const total = LOCK.mark + LOCK.gap + LOCK.wordW;
  const markX = 960 - LOCK.mark / 2 + (-(total / 2) + LOCK.mark / 2) * slide;
  const leave = clamp01((t - out) / 0.25);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - leave, filter: leave > 0 ? `blur(${leave * 12}px)` : undefined }}>
      <div style={{ position: "absolute", left: markX, top: y - LOCK.mark / 2 }}>
        <Mark t={t} appear={appear} draw={draw} size={LOCK.mark} />
      </div>
      <div data-target="wordmark" style={{ position: "absolute", left: 960 - total / 2 + LOCK.mark + LOCK.gap, top: y - LOCK.word * 0.52 }}>
        <Wordmark t={t} at={word} size={LOCK.word} />
      </div>
    </div>
  );
}

/** Bars 1-2: the mark scales in on the first downbeat, the M draws, the wordmark lands. */
export function Open({ t }: { t: number }) {
  const O = CUE.open;
  if (t > O.out + 0.3) return null;
  return <Lockup t={t} appear={O.in} draw={O.draw} word={O.word} y={540} out={O.out} />;
}

/** Bars 25-28: the lockup again, then the call to action and the address. */
export function End({ t }: { t: number }) {
  const E = CUE.end;
  if (t < E.in - 0.05) return null;
  const rise = step(t - E.rise, { stiffness: 120, damping: 20 });
  const hovering = t >= E.hover;
  const cta = { x: 960, y: 690 - 0 * rise, w: 560, h: 84 };
  const cursor = cursorAt(
    t,
    [
      { t: E.hover - 0.6, x: 1500, y: 1120 },
      { t: E.hover, x: cta.x + cta.w / 2 - 22, y: cta.y + 24 },
    ],
    (x, y) => ({ x, y }),
  );
  return (
    <>
      <div style={{ position: "absolute", inset: 0, translate: `0 ${-90 * rise}px` }}>
        <Lockup t={t} appear={E.in} draw={E.draw} word={E.word} y={560} out={DURATION + 1} />
      </div>
      <div
        style={{
          position: "absolute",
          left: cta.x - cta.w / 2,
          top: cta.y - cta.h / 2,
          width: cta.w,
          height: cta.h,
          borderRadius: 12,
          background: hovering ? C.accentHover : C.accent,
          color: "#FFFFFF",
          fontFamily: FONT,
          fontSize: 32,
          fontWeight: 600,
          display: "grid",
          placeItems: "center",
          ...arrive(t, E.cta, 20, 0.35),
        }}
      >
        Start your Carbon Reduction Plan
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 790, textAlign: "center", fontFamily: FONT, fontSize: 34, color: C.onDark2, letterSpacing: "0.01em", ...arrive(t, E.url, 14) }}>metricora.co.uk</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 900, display: "flex", justifyContent: "center", gap: 28, fontFamily: FONT, fontSize: 24, color: C.onDark3 }}>
        {["Carbon Reduction Plan", "SECR", "GHG Protocol report"].map((d, i) => (
          <span key={d} style={arrive(t, E.docs + i * 0.25, 10)}>{d}</span>
        ))}
        <span style={arrive(t, E.app, 10)}>Field app on Google Play</span>
      </div>
      {t >= E.hover - 0.7 ? <UserCursor x={cursor.x} y={cursor.y} squash={cursor.squash} /> : null}
      <div style={{ position: "absolute", inset: 0, background: C.stage, opacity: clamp01((t - E.fade) / (DURATION - E.fade)) }} />
    </>
  );
}

const W = (text: string, at: number, accent = false) => ({ text, at, accent });

/** The words, from the homepage's approved lines (BRAND.md, Claims). */
export const CARDS: Card[] = [
  { lines: [[W("Carbon", b(3, 1)), W("figures", b(3, 2))], [W("that", b(3, 3)), W("hold", b(3, 3, 0.5), true), W("up", b(3, 4), true)]], out: b(4, 1) - 0.12, y: 540, size: 150 },
  { lines: [[W("when", b(4, 1)), W("someone", b(4, 1, 0.5))], [W("checks", b(4, 2, 0.5), true), W("them.", b(4, 3))]], out: b(5, 1) - 0.12, y: 540, size: 150 },
  { lines: [[W("Open", b(11, 1)), W("any", b(11, 2)), W("figure.", b(11, 3), true)]], out: b(12, 1) - 0.12, y: 540, size: 160 },
  { lines: [[W("The", b(16, 1)), W("three", b(16, 1, 0.5)), W("documents", b(16, 2))], [W("most", b(16, 3)), W("contractors", b(16, 3, 0.5)), W("need.", b(16, 4), true)]], out: b(17, 1) - 0.08, y: 540, size: 140 },
  { lines: [[W("From", b(23, 1)), W("site", b(23, 2)), W("paperwork", b(23, 3))], [W("to", b(24, 1)), W("a", b(24, 1, 0.5)), W("published", b(24, 2), true), W("figure.", b(24, 3), true)]], out: b(25, 1) - 0.12, y: 540, size: 140 },
];

export function Words({ t }: { t: number }) {
  return <Punchlines t={t} cards={CARDS} theme={{ font: FONT, color: C.onDark, accent: C.accentLit, weight: 600 }} />;
}
