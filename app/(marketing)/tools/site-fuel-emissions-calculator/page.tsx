import type { Metadata } from "next";
import { withSocial } from "@/lib/seo/page-meta";
import { PageJsonLd } from "@/lib/seo/json-ld";
import { Body, ClosingCta, Container, H1, H2, H3, Lead, Section, TextLink } from "@/components/marketing/kit";
import { FUEL_FACTOR_SET, SITE_FUELS } from "@/lib/tools/site-fuel";
import { SiteFuelCalculator } from "./calculator";

export const metadata: Metadata = withSocial({
  title: "Site fuel emissions calculator (diesel, gas oil, HVO)",
  description:
    "Free calculator for construction site fuel emissions. Enter litres of diesel, gas oil, petrol, LPG or HVO and get tonnes CO2e from the DESNZ 2026 conversion factors.",
  alternates: { canonical: "/tools/site-fuel-emissions-calculator" },
});

const FAQ = [
  {
    q: "How do I calculate CO2e from litres of diesel?",
    a: `Multiply the litres by the emission factor for that fuel, then divide by 1,000 for tonnes. For example, 4,000 litres of average-blend diesel at ${SITE_FUELS[0].kgCo2ePerLitre} kg CO2e per litre is about 10.3 tonnes CO2e.`,
  },
  {
    q: "Is red diesel the same as diesel for carbon reporting?",
    a: `No. Red diesel is gas oil and has its own factor (${SITE_FUELS[1].kgCo2ePerLitre} kg CO2e per litre, against ${SITE_FUELS[0].kgCo2ePerLitre} for average-blend road diesel). Using the road diesel factor for site plant understates the figure.`,
  },
  {
    q: "Where do the factors come from?",
    a: `${FUEL_FACTOR_SET.name} (${FUEL_FACTOR_SET.version}), published by DESNZ and Defra under the ${FUEL_FACTOR_SET.licence}.`,
  },
  {
    q: "Does the calculator include HVO?",
    a: "Yes. The HVO factor covers the fossil emissions only. DESNZ reports the biogenic CO2 outside the scopes, so it is not in this total.",
  },
  {
    q: "Is this enough for SECR or a Carbon Reduction Plan?",
    a: "It gives you the Scope 1 fuel figure. A report also needs the period, the boundary, the other scopes and the evidence behind each litre figure.",
  },
];

export default function SiteFuelCalculatorPage() {
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
          <H1>Site fuel emissions calculator</H1>
          <Lead tone="dark">Enter the litres burnt on site and get tonnes of CO2e, using the current DESNZ conversion factors. It runs in your browser and stores nothing.</Lead>
        </Container>
      </Section>

      <Section tone="paper">
        <Container className="flex flex-col gap-6 px-0 sm:px-0">
          <SiteFuelCalculator />
        </Container>
      </Section>

      <Section tone="light">
        <Container className="flex flex-col gap-6 px-0 sm:px-0">
          <H2>The factors used</H2>
          <Body>
            Kilograms of CO2e per litre, direct combustion only. Source: {FUEL_FACTOR_SET.name}, {FUEL_FACTOR_SET.version}, published under the {FUEL_FACTOR_SET.licence}. Contains public sector information licensed under the Open Government Licence v3.0.{" "}
            <TextLink href={FUEL_FACTOR_SET.sourceUrl}>Published by DESNZ and Defra</TextLink>.
          </Body>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[15px]">
              <thead>
                <tr className="border-b border-mk-line text-[13px] text-mk-text-2">
                  <th className="py-2 pr-4 font-medium">Fuel</th>
                  <th className="py-2 pr-4 font-medium">kg CO2e per litre</th>
                  <th className="py-2 font-medium">Typical use on site</th>
                </tr>
              </thead>
              <tbody>
                {SITE_FUELS.map((f) => (
                  <tr key={f.id} className="border-b border-mk-line align-top">
                    <td className="py-2 pr-4 font-medium text-mk-text">{f.label}</td>
                    <td className="py-2 pr-4 text-mk-text">{f.kgCo2ePerLitre}</td>
                    <td className="py-2 text-mk-text-2">{f.use}</td>
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
              <H3>Red diesel treated as road diesel</H3>
              <Body>Gas oil runs about 7% higher per litre. On 18,000 litres that is roughly 3 tonnes of CO2e missing.</Body>
            </div>
            <div className="flex flex-col gap-2">
              <H3>Delivered litres, not burnt litres</H3>
              <Body>Deliveries are not consumption. Count what was drawn from the tank, or adjust deliveries for the change in stock over the period.</Body>
            </div>
          </div>
          <Body>
            The full method, with worked examples, is in{" "}
            <TextLink href="/blog/how-to-calculate-site-fuel-emissions-construction">how to calculate site fuel emissions</TextLink>.
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

      <ClosingCta title="Keep the litres, the evidence and the total in one place." lead="MetricOra records fuel from receipts and meter readings, picks the right factor per record and shows the calculation behind every figure." />
    </>
  );
}
