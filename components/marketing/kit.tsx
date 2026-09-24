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
  const pad = size === "lg" ? "py-24 sm:py-32" : size === "sm" ? "py-14 sm:py-16" : "py-20 sm:py-24";
  return (
    <section id={id} className={cn("relative isolate scroll-mt-20 overflow-hidden", TONE_BG[tone], pad, className)}>
      {video ? <BackgroundVideo src={video} poster={poster} tone={tone} /> : null}
      <Container className="relative">{children}</Container>
    </section>
  );
}

function BackgroundVideo({ src, poster, tone }: { src: string; poster?: string; tone: Tone }) {
  const dark = tone === "dark";
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10">
      <LoopVideo src={src} poster={poster} className={cn("h-full w-full scale-110 object-cover blur-[6px]", dark ? "opacity-40" : "opacity-20")} />
      <div
        className={cn(
          "absolute inset-0",
          dark
            ? "bg-[linear-gradient(90deg,#0B100E_0%,rgba(11,16,14,0.92)_38%,rgba(11,16,14,0.55)_100%)]"
            : "bg-[linear-gradient(90deg,#F3F5F2_0%,rgba(243,245,242,0.94)_45%,rgba(243,245,242,0.7)_100%)]",
        )}
      />
    </div>
  );
}

export function Eyebrow({ children, tone = "light" }: { children: ReactNode; tone?: Tone }) {
  return (
    <p
      className={cn(
        "font-mono text-[12px] font-medium uppercase tracking-[0.12em]",
        tone === "dark" ? "text-mk-accent-lit" : "text-mk-accent",
      )}
    >
      {children}
    </p>
  );
}

export function H1({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={cn("text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] text-balance sm:text-[56px] lg:text-[64px]", className)}>
      {children}
    </h1>
  );
}

export function H2({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn("text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-balance sm:text-[40px]", className)}>
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
    "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] px-5 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent";
  const styles =
    variant === "primary"
      ? "bg-mk-accent text-white hover:bg-mk-accent-hover"
      : tone === "dark"
        ? "border border-white/20 text-mk-on-dark hover:border-white/40 hover:bg-white/5"
        : "border border-mk-text/20 text-mk-text hover:border-mk-text/40 hover:bg-mk-text/[0.03]";
  return (
    <Link href={href} className={cn(base, styles, className)}>
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

/** A browser-window frame around a real product capture. Captures come from the demo tenant, so the label says so. */
export function ProductFrame({ children, caption, tone = "light", className }: { children: ReactNode; caption?: string; tone?: Tone; className?: string }) {
  return (
    <figure className={cn("m-0", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-[12px] border shadow-[0_24px_60px_-24px_rgba(11,16,14,0.35)]",
          tone === "dark" ? "border-white/10 bg-mk-ink-2" : "border-mk-line bg-mk-surface",
        )}
      >
        <div className={cn("flex items-center gap-1.5 border-b px-3.5 py-2.5", tone === "dark" ? "border-white/10" : "border-mk-line")}>
          <span className="h-2.5 w-2.5 rounded-full bg-[#E5E7EB]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#E5E7EB]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#E5E7EB]/70" />
          <span className={cn("ml-3 font-mono text-[11px]", tone === "dark" ? "text-mk-on-dark-3" : "text-mk-text-3")}>app.metricora · demo data</span>
        </div>
        {children}
      </div>
      {caption ? (
        <figcaption className={cn("mt-3 text-[13px]", tone === "dark" ? "text-mk-on-dark-3" : "text-mk-text-3")}>{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export function ProductShot({
  src,
  alt,
  width = 1440,
  height = 900,
  caption,
  tone,
  priority,
  className,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  caption?: string;
  tone?: Tone;
  priority?: boolean;
  className?: string;
}) {
  return (
    <ProductFrame caption={caption} tone={tone} className={className}>
      <Image src={src} alt={alt} width={width} height={height} priority={priority} sizes="(min-width: 1024px) 720px, 100vw" className="block h-auto w-full" />
    </ProductFrame>
  );
}

export function ProductLoop({ src, poster, label, caption, tone }: { src: string; poster: string; label: string; caption?: string; tone?: Tone }) {
  return (
    <ProductFrame caption={caption} tone={tone}>
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
      {eyebrow ? <Eyebrow tone={tone}>{eyebrow}</Eyebrow> : null}
      <H2>{title}</H2>
      {lead ? <Lead tone={tone} className={align === "center" ? "mx-auto" : undefined}>{lead}</Lead> : null}
    </div>
  );
}

/** Closing call to action shared by every page. */
export function ClosingCta({ title, lead }: { title: ReactNode; lead: ReactNode }) {
  return (
    <Section tone="dark" size="lg" video="/marketing/loops/prove.mp4" poster="/marketing/loops/prove.jpg">
      <div className="flex max-w-2xl flex-col gap-6">
        <H2>{title}</H2>
        <Lead tone="dark">{lead}</Lead>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/sign-up">Start a 30-day trial</ButtonLink>
          <ButtonLink href="/contact" variant="secondary" tone="dark">
            Book a pilot
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}
