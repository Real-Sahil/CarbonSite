import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoopVideo } from "@/components/marketing/loop-video";

// Building blocks for every marketing page, so type, colour, spacing and
// link hierarchy stay the same everywhere. Tones: "dark" (ink), "paper"
// (off-white) and "light" (surface). Link hierarchy, strongest first:
// ButtonLink primary, ButtonLink secondary, TextLink.

export type Tone = "dark" | "paper" | "light";

/** Attributes String Tune reads (components/marketing/string-tune.tsx); inert until its script runs. An empty key only marks the element in view (-inview). */
const st = (key: string, extra: Record<string, string> = {}) => ({ string: key, ...extra }) as Record<string, string>;

/**
 * Props that fade an element up when it first scrolls into view, staggered by its place in a row of
 * `cols`. "inner" fades the element's children instead, for cards whose background must stay put
 * (a grid with hairline gaps would otherwise show the gap colour while a card is hidden).
 */
export function reveal(index = 0, mode: "self" | "inner" = "self", cols = 3) {
  return {
    ...st(""),
    "data-st": mode === "inner" ? "reveal-inner" : "reveal",
    style: { "--st-delay": `${(index % cols) * 90}ms` } as React.CSSProperties,
  };
}

/** Fades its children up the first time they scroll into view. Keep it off anything in the first screen. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <div {...st("")} data-st="reveal" style={delay ? ({ "--st-delay": `${delay}ms` } as React.CSSProperties) : undefined} className={className}>
      {children}
    </div>
  );
}

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-5 sm:px-8", className)}>{children}</div>;
}

const TONE_BG: Record<Tone, string> = {
  dark: "bg-mk-ink text-mk-on-dark",
  paper: "bg-mk-paper text-mk-text",
  light: "bg-mk-surface text-mk-text",
};

export function Section({
  tone = "light",
  id,
  className,
  children,
  video,
  poster,
  size = "md",
}: {
  tone?: Tone;
  id?: string;
  className?: string;
  children: ReactNode;
  /** Background loop (mp4 path under /marketing). Shown dimmed behind the content. */
  video?: string;
  poster?: string;
  size?: "sm" | "md" | "lg";
}) {
  // shortcut: a hero is found by its pt-24 offset under the fixed nav; give Section an explicit prop if another page type needs one.
  const hero = tone === "dark" && /\bpt-24\b/.test(className ?? "");
  const pad = size === "lg" ? "py-24 sm:py-32" : size === "sm" ? "py-14 sm:py-16" : "py-20 sm:py-24";
  return (
    <section id={id} className={cn("relative isolate scroll-mt-20 overflow-hidden", hero ? "mk-sky" : TONE_BG[tone], pad, className)}>
      {video && !hero ? <BackgroundVideo src={video} poster={poster} tone={tone} /> : null}
      <Container className="relative">{children}</Container>
    </section>
  );
}

function BackgroundVideo({ src, poster, tone }: { src: string; poster?: string; tone: Tone }) {
  const dark = tone === "dark";
  return (
    <div aria-hidden="true" {...st("progress", { "data-st": "drift" })} className="absolute inset-0 -z-10">
      <LoopVideo decorative src={src} poster={poster} className={cn("h-full w-full scale-110 object-cover blur-[6px]", dark ? "opacity-40" : "opacity-20")} />
      <div
        className={cn(
          "absolute inset-0",
          dark
            ? "bg-[linear-gradient(90deg,#131D29_0%,rgba(19,29,41,0.92)_38%,rgba(19,29,41,0.55)_100%)]"
            : "bg-[linear-gradient(90deg,#F9FAFC_0%,rgba(249,250,252,0.94)_45%,rgba(249,250,252,0.7)_100%)]",
        )}
      />
    </div>
  );
}

export function Eyebrow({ children, tone = "light" }: { children: ReactNode; tone?: Tone }) {
  return (
    <p
      className={cn(
        "font-sans text-[12px] font-medium uppercase tracking-[0.12em]",
        tone === "dark" ? "text-mk-accent-lit" : "text-mk-accent",
      )}
    >
      {children}
    </p>
  );
}

/** Typewriter pace: a line takes about 1.6 s whatever its length, 18 to 45 ms a character. */
export function typeStepMs(length: number) {
  return Math.round(Math.min(45, Math.max(18, 1600 / Math.max(length, 1))));
}

const TYPE_START_MS = 200;

/**
 * A string title types itself. Each character is an aria-hidden span timed in CSS (`.mk-type-char`,
 * globals.css) that draws its glyph from `data-char`, so the title is in the DOM once: the visually
 * hidden copy that leads the heading, which is also what screen readers announce.
 */
export function H1({ children, className }: { children: ReactNode; className?: string }) {
  const cls = cn("font-display text-[44px] font-light leading-[1.02] tracking-[-0.02em] text-balance sm:text-[64px] lg:text-[76px]", className);
  if (typeof children !== "string") return <h1 className={cls}>{children}</h1>;
  const chars = Array.from(children);
  const step = typeStepMs(chars.length);
  return (
    <h1 className={cls} style={{ "--mk-type-step": `${step}ms` } as React.CSSProperties}>
      <span className="sr-only">{children}</span>
      {chars.map((ch, i) => (
        <span
          // eslint-disable-next-line react/no-array-index-key -- fixed text, never reordered
          key={i}
          aria-hidden="true"
          data-char={ch}
          className={cn("mk-type-char", i === chars.length - 1 && "mk-type-last")}
          style={{ "--mk-type-delay": `${TYPE_START_MS + i * step}ms` } as React.CSSProperties}
        />
      ))}
    </h1>
  );
}

export function H2({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      {...(typeof children === "string" ? st("split", { "string-split": "word" }) : {})}
      className={cn("font-display text-[34px] font-light leading-[1.08] tracking-[-0.02em] text-balance sm:text-[46px]", className)}
    >
      {children}
    </h2>
  );
}

export function H3({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("text-[18px] font-semibold leading-snug tracking-[-0.01em]", className)}>{children}</h3>;
}

export function Lead({ children, tone = "light", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <p className={cn("max-w-[62ch] text-[17px] leading-relaxed sm:text-[18px]", tone === "dark" ? "text-mk-on-dark-2" : "text-mk-text-2", className)}>
      {children}
    </p>
  );
}

export function Body({ children, tone = "light", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <p className={cn("max-w-[62ch] text-[15px] leading-relaxed", tone === "dark" ? "text-mk-on-dark-2" : "text-mk-text-2", className)}>{children}</p>;
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  tone = "light",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  tone?: Tone;
  className?: string;
}) {
  const base =
    "inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent";
  const styles =
    variant === "primary"
      ? "bg-mk-accent text-white hover:bg-mk-accent-hover"
      : tone === "dark"
        ? "border border-mk-on-dark/25 text-mk-on-dark hover:border-mk-on-dark/45 hover:bg-mk-on-dark/5"
        : "border border-mk-text/10 bg-white text-mk-text shadow-[0_2px_8px_rgba(19,29,41,0.05)] hover:border-mk-text/25";
  return (
    <Link
      href={href}
      {...(variant === "primary" ? st("magnetic", { "string-strength": "0.25", "string-radius": "90" }) : {})}
      className={cn(base, styles, className)}
    >
      {children}
      {variant === "primary" ? <ArrowRight aria-hidden="true" className="h-4 w-4" /> : null}
    </Link>
  );
}

export function TextLink({ href, children, tone = "light", className }: { href: string; children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-1.5 text-[15px] font-medium underline-offset-4 hover:underline",
        tone === "dark" ? "text-mk-accent-lit" : "text-mk-accent",
        className,
      )}
    >
      {children}
      <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function CheckList({ items, tone = "light" }: { items: ReactNode[]; tone?: Tone }) {
  return (
    <ul className="grid gap-2.5">
      {items.map((item, i) => (
        <li key={i} className={cn("flex gap-3 text-[15px] leading-relaxed", tone === "dark" ? "text-mk-on-dark-2" : "text-mk-text-2")}>
          <Check aria-hidden="true" className={cn("mt-1 h-4 w-4 shrink-0", tone === "dark" ? "text-mk-accent-lit" : "text-mk-accent")} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** The only caption under demo material: an asterisk and the words. */
export function DemoNote({ tone = "light", className }: { tone?: Tone; className?: string }) {
  return (
    <p className={cn("mt-3 text-[13px]", tone === "dark" ? "text-mk-on-dark-3" : "text-mk-text-3", className)}>*Demo data</p>
  );
}

/** A browser-window frame around a real product capture. Captures come from the demo tenant, so every frame carries the one-line note. */
export function ProductFrame({ children, tone = "light", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <figure {...st("")} data-st="reveal" className={cn("m-0", className)}>
      <div
        {...st("tilt", { "string-tilt-max": "3" })}
        className={cn(
          "overflow-hidden rounded-[18px] border shadow-[0_32px_70px_-24px_rgba(19,29,41,0.35)]",
          tone === "dark" ? "border-mk-on-dark/10 bg-mk-ink-2" : "border-mk-line bg-mk-surface",
        )}
      >
        <div className={cn("flex items-center gap-1.5 border-b px-3.5 py-2.5", tone === "dark" ? "border-mk-on-dark/10" : "border-mk-line")}>
          <span className="h-2.5 w-2.5 rounded-full bg-mk-line/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-mk-line/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-mk-line/70" />
        </div>
        {children}
      </div>
      <DemoNote tone={tone} />
    </figure>
  );
}

export function ProductShot({
  src,
  alt,
  width = 1440,
  height = 900,
  tone,
  priority,
  className,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  tone?: Tone;
  priority?: boolean;
  className?: string;
}) {
  return (
    <ProductFrame tone={tone} className={className}>
      <Image src={src} alt={alt} width={width} height={height} priority={priority} sizes="(min-width: 1024px) 720px, 100vw" className="block h-auto w-full" />
    </ProductFrame>
  );
}

export function ProductLoop({ src, poster, label, tone }: { src: string; poster: string; label: string; tone?: Tone }) {
  return (
    <ProductFrame tone={tone}>
      <LoopVideo src={src} poster={poster} label={label} className="block aspect-[16/10] h-auto w-full object-cover object-top" />
    </ProductFrame>
  );
}

/** Heading block used at the top of most sections. */
export function SectionIntro({
  eyebrow,
  title,
  lead,
  tone = "light",
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  tone?: Tone;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("flex flex-col gap-4", align === "center" && "items-center text-center")}>
      {eyebrow ? (
        <Reveal>
          <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
        </Reveal>
      ) : null}
      <H2>{title}</H2>
      {lead ? (
        <Reveal delay={180}>
          <Lead tone={tone} className={align === "center" ? "mx-auto" : undefined}>
            {lead}
          </Lead>
        </Reveal>
      ) : null}
    </div>
  );
}

/** Closing call to action shared by every page: one accent band, white on ember. */
export function ClosingCta({ title, lead }: { title: ReactNode; lead: ReactNode }) {
  return (
    <Section tone="paper" size="md">
      <div className="flex flex-col gap-6 rounded-[28px] bg-mk-accent px-6 py-12 text-white sm:px-14 sm:py-16">
        <H2 className="max-w-2xl">{title}</H2>
        <p className="max-w-[56ch] text-[17px] leading-relaxed text-white/90 sm:text-[18px]">{lead}</p>
        {/* One primary action; the pilot is a quieter link so the trial reads as the next step. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/sign-up"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-mk-accent hover:bg-mk-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Start a 30-day trial
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          <Link href="/contact" className="inline-flex items-center gap-1.5 text-[15px] font-medium text-white underline underline-offset-4">
            Or book a pilot
          </Link>
        </div>
      </div>
    </Section>
  );
}
