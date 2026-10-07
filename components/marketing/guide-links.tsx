import { Section, SectionIntro, TextLink } from "@/components/marketing/kit";

export type GuideLink = { href: string; title: string; text: string };

/** A short row of related guides, so product and audience pages link to the articles that answer the questions behind them. */
export function GuideLinks({ links, title = "Guides for this" }: { links: GuideLink[]; title?: string }) {
  return (
    <Section tone="paper">
      <SectionIntro eyebrow="Read more" title={title} />
      <ul className="mt-10 grid gap-6 md:grid-cols-3">
        {links.map((g) => (
          <li key={g.href} className="flex flex-col gap-2">
            <TextLink href={g.href}>{g.title}</TextLink>
            <p className="text-[15px] leading-relaxed text-mk-muted">{g.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
