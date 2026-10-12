import { loadFont } from "@remotion/fonts";
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from "remotion";

import { TargetLog } from "../../kit/debug";
import { useTime } from "../../kit/time";
import { C } from "../../ui/tokens";
import peaks from "../../../public/audio/platform/sfx-peaks.json";
import { CUE } from "../launch/cues";
import { Docs } from "../launch/acts/Docs";
import { End, Open, Words } from "../launch/acts/Brand";
import { FieldApp } from "../launch/acts/FieldApp";
import { Pack } from "../launch/acts/Pack";
import { Review } from "../launch/acts/Review";
import { Trace } from "../launch/acts/Trace";
import { DURATION, END } from "./cues";
import { Screens } from "./screens";

loadFont({ family: "Geist", url: staticFile("fonts/Geist-Variable.woff2"), weight: "100 900" });
loadFont({ family: "Geist Mono", url: staticFile("fonts/GeistMono-Variable.woff2"), weight: "100 900" });

export type PlatformProps = { fps: number; debug?: boolean };

/**
 * One sound per meaningful event, its peak on the cue (sfx-peaks.json from compose.py).
 * Bars 1-24 reuse the launch acts, so their cues come from the launch grid (same bars).
 * The ending uses the platform's own END cue (the launch end sits on other bars).
 */
const SFX: { at: number; name: keyof typeof peaks; volume: number }[] = [
  { at: CUE.phone.tapTile, name: "pop", volume: 0.35 },
  { at: CUE.phone.shutter, name: "shutter", volume: 0.45 },
  { at: CUE.phone.submit, name: "pop", volume: 0.35 },
  { at: CUE.review.in, name: "whoosh", volume: 0.3 },
  { at: CUE.review.approve, name: "click", volume: 0.4 },
  { at: CUE.review.approve + 0.1, name: "chime", volume: 0.3 },
  { at: CUE.trace.clickScope, name: "click", volume: 0.4 },
  { at: CUE.trace.clickRow, name: "click", volume: 0.4 },
  { at: CUE.docs.crp, name: "whoosh", volume: 0.3 },
  { at: CUE.docs.generated, name: "pop", volume: 0.3 },
  { at: CUE.pack.download, name: "click", volume: 0.4 },
  { at: END.hover, name: "pop", volume: 0.25 },
];

/**
 * The 90 s platform film (45 bars). The score and effects mount on the same grid as
 * the cues (cues.ts), from the output of scripts/compose.py --plan platform. Bars 1-24
 * are the launch acts on the launch timing; bars 25-40 the product screens; 41-45 the ending.
 */
export function Platform({ debug }: PlatformProps) {
  const t = useTime();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.stage, overflow: "hidden" }}>
      <Audio src={staticFile("audio/platform/score.wav")} />
      {SFX.map((s, i) => (
        <Sequence key={i} from={Math.max(0, Math.round((s.at - peaks[s.name]) * fps))} layout="none">
          <Audio src={staticFile(`audio/platform/sfx/${s.name}.wav`)} volume={s.volume} />
        </Sequence>
      ))}
      <Open t={t} />
      <FieldApp t={t} />
      <Review t={t} />
      <Trace t={t} />
      <Docs t={t} />
      <Pack t={t} />
      <Words t={t} />
      <Screens t={t} />
      <End t={t} cue={END} duration={DURATION} appLabel="Android field app on Google Play" />
      {debug ? <TargetLog /> : null}
    </AbsoluteFill>
  );
}
