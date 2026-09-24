import type { Metadata } from "next";
import { SolutionPage } from "@/components/marketing/solution-page";

export const metadata: Metadata = {
  title: "Main contractors",
  description:
    "Carbon accounting for UK main contractors: site fuel and plant, materials and embodied carbon, subcontractor evidence, waste and PAS 2080, in one inventory.",
  alternates: { canonical: "/solutions/construction" },
};

export default function ConstructionPage() {
  return (
    <SolutionPage
      c={{
        eyebrow: "Main contractors",
        title: "Site carbon, from the bowser to the board report.",
        lead: "Plant fuel, generators, deliveries, waste and subcontractor paperwork arrive from dozens of sources. MetricOra puts them through one review queue and one calculation, per site and per contract.",
        heroVideo: "/marketing/loops/prove.mp4",
        problems: [
          {
            problem: "Waste tickets arrive on paper from every subcontractor",
            answer: "Drivers and site staff photograph them in the field app. Weight, EWC code, date and vehicle are read on the phone and checked by a reviewer before they count.",
          },
          {
            problem: "Plant diesel and HVO are hard to reconcile",
            answer: "Fuel receipts and bowser deliveries become Scope 1 records. HVO and blends use the library's HVO factor, with biogenic CO₂ reported separately. Telematics feeds show idling and burnt fuel per machine.",
          },
          {
            problem: "Embodied carbon is worked out after the fact",
            answer: "Approving a delivery note can also create an embodied carbon record for the project, from the material's library factor or the supplier's own EPD, with transport to site added.",
          },
          {
            problem: "Clients ask for PAS 2080 and project budgets",
            answer: "Each project can hold a carbon management plan, a reduction opportunity log and a carbon budget with a burn-down against its programme dates.",
          },
        ],
        feature: {
          eyebrow: "Per site, per contract",
          title: "The same numbers for the site team and the head office.",
          lead: "Sites, contracts and programmes sit in one organisation, so a contract's carbon and the group SECR figure come from the same published snapshot.",
          points: [
            "Location- and market-based Scope 2 for site supplies and offices",
            "Spend-based Scope 3 for concrete, steel and services by UK SIC code",
            "Subcontractors submit evidence without seeing anything else",
          ],
          media: { kind: "loop", src: "/marketing/loops/prove.mp4", label: "Dashboard for a civils contractor with five sites" },
        },
        detail: {
          eyebrow: "Review",
          title: "A reviewer sees exactly what was captured on site.",
          lead: "Recognised values sit beside the submitted ones, so a corrected weight or a mistyped date is obvious before approval.",
          points: ["Claim a submission so two people do not review it", "Ask the worker for more information without losing the original", "Every decision is written to the audit trail"],
          media: { kind: "shot", src: "/marketing/screens/submission-review.jpg", alt: "Waste ticket review with a note querying the net weight" },
        },
        closing: { title: "Start with one live project.", lead: "Bring a site's fuel, electricity, waste and deliveries for one period. We will help you set up the field app for the team." },
      }}
    />
  );
}
