import { loadFont } from "@remotion/fonts";
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from "remotion";

import { TargetLog } from "../../kit/debug";
import { useTime } from "../../kit/time";
import { C } from "../../ui/tokens";
import peaks from "../../../public/audio/launch/sfx-peaks.json";
import { Docs } from "./acts/Docs";
import { End, Open, Words } from "./acts/Brand";
import { FieldApp } from "./acts/FieldApp";
import { Pack } from "./acts/Pack";
import { Review } from "./acts/Review";
import { Trace } from "./acts/Trace";
import { CUE } from "./cues";

loadFont({ family: "Geist", url: staticFile("fonts/Geist-Variable.woff2"), weight: "100 900" });
loadFont({ family: "Geist Mono", url: staticFile("fonts/GeistMono-Variable.woff2"), weight: "100 900" });

export type LaunchProps = { fps: number; debug?: boolean };

/** One sound per meaningful event, its peak on the cue (sfx-peaks.json from compose.py). */
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
  { at: CUE.end.hover, name: "pop", volume: 0.25 },
];

export function Launch({ debug }: LaunchProps) {
  const t = useTime();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.stage, overflow: "hidden" }}>
      <Audio src={staticFile("audio/launch/score.wav")} />
      {SFX.map((s, i) => (
        <Sequence key={i} from={Math.max(0, Math.round((s.at - peaks[s.name]) * fps))} layout="none">
          <Audio src={staticFile(`audio/launch/sfx/${s.name}.wav`)} volume={s.volume} />
        </Sequence>
      ))}
      <Open t={t} />
      <FieldApp t={t} />
      <Review t={t} />
      <Trace t={t} />
      <Docs t={t} />
      <Pack t={t} />
      <Words t={t} />
      <End t={t} />
      {debug ? <TargetLog /> : null}
    </AbsoluteFill>
  );
}
