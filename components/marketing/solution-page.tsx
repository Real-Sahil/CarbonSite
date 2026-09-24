import type { ReactNode } from "react";
import {
  Body,
  ButtonLink,
  CheckList,
  ClosingCta,
  Eyebrow,
  H1,
  H3,
  Lead,
  ProductLoop,
  ProductShot,
  Section,
  SectionIntro,
} from "@/components/marketing/kit";

type Media = { kind: "shot"; src: string; alt: string } | { kind: "loop"; src: string; label: string };

export type SolutionContent = {
  eyebrow: string;
  title: string;
  lead: string;
  heroVideo: string;
  problems: { problem: string; answer: string }[];
  feature: { eyebrow: string; title: string; lead: string; points: ReactNode[]; media: Media };
  detail?: { eyebrow: string; title: string; lead: string; points: ReactNode[]; media: Media };
  closing: { title: string; lead: string };
};

function MediaBlock({ media, tone }: { media: Media; tone?: "dark" }) {
  return media.kind === "loop" ? (
    <ProductLoop src={media.src} poster={media.src.replace(".mp4", ".jpg")} label={media.label} tone={tone} />
  ) : (
    <ProductShot src={media.src} alt={media.alt} width={2400} height={1500} tone={tone} />
  );
}

// Shared layout for /solutions/* so the three audience pages read the same way.
export function SolutionPage({ c }: { c: SolutionContent }) {
  return (
    <>
      <Section tone="dark" size="lg" video={c.heroVideo} poster={c.heroVideo.replace(".mp4", ".jpg")} className="pt-36 sm:pt-40">
        <div className="flex max-w-3xl flex-col gap-6">
          <Eyebrow tone="dark">{c.eyebrow}</Eyebrow>
          <H1>{c.title}</H1>
          <Lead tone="dark">{c.lead}</Lead>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/sign-up">Start a 30-day trial</ButtonLink>
            <ButtonLink href="/contact" variant="secondary" tone="dark">
              Book a pilot
            </ButtonLink>
          </div>
        </div>
      </Section>

      <Section tone="light">
        <SectionIntro eyebrow="Where it helps" title="The jobs that usually end up in a spreadsheet." />
        <div className="mt-12 grid gap-px overflow-hidden rounded-[12px] border border-mk-line bg-mk-line md:grid-cols-2">
          {c.problems.map((p) => (
            <div key={p.problem} className="flex flex-col gap-3 bg-mk-surface p-7">
              <H3>{p.problem}</H3>
              <Body>{p.answer}</Body>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="dark" video={c.feature.media.kind === "loop" ? c.feature.media.src : undefined} poster={c.feature.media.kind === "loop" ? c.feature.media.src.replace(".mp4", ".jpg") : undefined}>
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <SectionIntro eyebrow={c.feature.eyebrow} title={c.feature.title} lead={c.feature.lead} tone="dark" />
            <CheckList items={c.feature.points} tone="dark" />
          </div>
          <MediaBlock media={c.feature.media} tone="dark" />
        </div>
      </Section>

      {c.detail ? (
        <Section tone="paper">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div className="lg:order-2 flex flex-col gap-6">
              <SectionIntro eyebrow={c.detail.eyebrow} title={c.detail.title} lead={c.detail.lead} />
              <CheckList items={c.detail.points} />
            </div>
            <div className="lg:order-1">
              <MediaBlock media={c.detail.media} />
            </div>
          </div>
        </Section>
      ) : null}

      <ClosingCta title={c.closing.title} lead={c.closing.lead} />
    </>
  );
}
