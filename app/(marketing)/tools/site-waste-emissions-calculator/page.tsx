import type { Metadata } from "next";
import { withSocial } from "@/lib/seo/page-meta";
import { PageJsonLd } from "@/lib/seo/json-ld";
import { Body, ClosingCta, Container, H1, H2, H3, Lead, Section, TextLink } from "@/components/marketing/kit";
import { SITE_WASTES, WASTE_FACTOR_SET } from "@/lib/tools/site-waste";
import { SiteWasteCalculator } from "./calculator";

export const metadata: Metadata = withSocial({
  title: "Site waste emissions calculator (landfill, recycling, EfW)",
  description:
    "Free calculator for construction site waste emissions. Enter tonnes sent to landfill, energy from waste or recycling and get tonnes CO2e from the DESNZ 2026 conversion factors.",
  alternates: { canonical: "/tools/site-waste-emissions-calculator" },
});

const FAQ = [
  {
    q: "How do I calculate CO2e from tonnes of waste?",
    a: `Multiply the tonnes by the factor for the disposal route, then divide by 1,000. For example, 10 tonnes of mixed waste to landfill at ${SITE_WASTES[0].kgCo2ePerTonne.toFixed(1)} kg CO2e per tonne is about 5.2 tonnes CO2e.`,
  },
  {
    q: "Why is inert waste so low and wood so high?",
    a: `Inert material such as brick and concrete barely breaks down in landfill (${SITE_WASTES[2].kgCo2ePerTonne.toFixed(1)} kg CO2e per tonne), while wood decays and releases methane (${SITE_WASTES[1].kgCo2ePerTonne.toFixed(0)} kg CO2e per tonne). Sorting the stream changes the answer far more than the total tonnage does.`,
  },
  {
    q: "Does this include transport to the facility?",
    a: "No. The factors cover disposal or treatment only. Carrier and skip lorry journeys are a separate calculation, using tonne-kilometres and a freight factor.",
  },
  {
    q: "Where do the factors come from?",
    a: `${WASTE_FACTOR_SET.name} (${WASTE_FACTOR_SET.version}), published by DESNZ and Defra under the ${WASTE_FACTOR_SET.licence}.`,
  },
  {
    q: "Where does the tonnage come from?",
    a: "From waste transfer notes and weighbridge tickets, not from the number of skips. A skip count needs an assumed weight, and that assumption is usually the weakest part of the figure.",
  },
];

export default function SiteWasteCalculatorPage() {
  return (
    <>
      <PageJsonLd meta={metadata} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          }),
        }}
      />
      <Section tone="dark" className="pt-24 sm:pt-24">
        <Container className="flex flex-col gap-5 px-0 sm:px-0">
          <H1>Site waste emissions calculator</H1>
          <Lead tone="dark">Enter the tonnes of waste by disposal route and get tonnes of CO2e, using the current DESNZ conversion factors. It runs in your browser and stores nothing.</Lead>
        </Container>
      </Section>

      <Section tone="paper">
        <Container className="flex flex-col gap-6 px-0 sm:px-0">
          <SiteWasteCalculator />
        </Container>
      </Section>

      <Section tone="light">
        <Container className="flex flex-col gap-6 px-0 sm:px-0">
          <H2>The factors used</H2>
          <Body>
            Kilograms of CO2e per tonne of waste, disposal or treatment only. Source: {WASTE_FACTOR_SET.name}, {WASTE_FACTOR_SET.version}, published under the {WASTE_FACTOR_SET.licence}. Contains public sector information licensed under the Open Government Licence v3.0.{" "}
            <TextLink href={WASTE_FACTOR_SET.sourceUrl}>Published by DESNZ and Defra</TextLink>.
          </Body>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[15px]">
              <thead>
                <tr className="border-b border-mk-line text-[13px] text-mk-text-2">
                  <th className="py-2 pr-4 font-medium">Waste and route</th>
                  <th className="py-2 pr-4 font-medium">kg CO2e per tonne</th>
                  <th className="py-2 font-medium">What it covers</th>
                </tr>
              </thead>
              <tbody>
                {SITE_WASTES.map((w) => (
                  <tr key={w.id} className="border-b border-mk-line align-top">
                    <td className="py-2 pr-4 font-medium text-mk-text">{w.label}</td>
                    <td className="py-2 pr-4 text-mk-text">{w.kgCo2ePerTonne}</td>
                    <td className="py-2 text-mk-text-2">{w.covers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Section>

      <Section tone="paper">
        <Container className="flex flex-col gap-6 px-0 sm:px-0">
          <H2>Mistakes that move the number</H2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <H3>One factor for the whole skip</H3>
              <Body>Wood and mixed waste to landfill sit hundreds of kilograms per tonne above inert waste. Splitting the stream on the transfer note is worth more than any rounding.</Body>
            </div>
            <div className="flex flex-col gap-2">
              <H3>Skips counted, not weighed</H3>
              <Body>A skip count turns into tonnes through an assumed weight. Use the weight on the waste transfer note or weighbridge ticket where you have it.</Body>
            </div>
          </div>
          <Body>
            From ticket to reported figure, step by step:{" "}
            <TextLink href="/blog/waste-ticket-to-reported-tonne">from waste ticket to reported tonne</TextLink>.
          </Body>
        </Container>
      </Section>

      <Section tone="light">
        <Container className="flex flex-col gap-6 px-0 sm:px-0">
          <H2>Questions</H2>
          <div className="flex flex-col gap-6">
            {FAQ.map((f) => (
              <div key={f.q} className="flex flex-col gap-2">
                <H3>{f.q}</H3>
                <Body>{f.a}</Body>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <ClosingCta title="Keep the tickets, the tonnes and the total in one place." lead="MetricOra reads waste transfer notes, checks carriers against the register and shows the calculation behind every tonne reported." />
    </>
  );
}
