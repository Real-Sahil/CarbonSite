import type { Metadata } from "next";
import { withSocial } from "@/lib/seo/page-meta";
import { SolutionPage } from "@/components/marketing/solution-page";

export const metadata: Metadata = withSocial({
  title: "Public-sector suppliers",
  description:
    "A PPN 006 Carbon Reduction Plan, PPN 026 social value KPIs and National TOMs from one MetricOra dataset, with a bid carbon pack built from published figures.",
  alternates: { canonical: "/solutions/public-sector" },
});

export default function PublicSectorPage() {
  return (
    <SolutionPage
      c={{
        eyebrow: "Public-sector suppliers",
        title: "The carbon and social value answers every tender asks for.",
        lead: "Central government contracts over £5 million a year ask for a Carbon Reduction Plan under PPN 006, and from January 2027 contracts of £1 million or more score social value on jobs and skills under PPN 026. MetricOra keeps both beside the records you already hold.",
        heroVideo: "/marketing/loops/plan.mp4",
        problems: [
          {
            problem: "Rewriting the Carbon Reduction Plan for every bid",
            answer: "A guided PPN 006 plan takes you through the Cabinet Office template section by section and checks each required item before it is generated. Next year's plan starts from this year's text, and the figures come from your published snapshots, so they match every other document you submit.",
          },
          {
            problem: "Tender carbon sections take days",
            answer: "The bid carbon pack pulls the plan, the emissions trend across published years, featured contracts and assurance status into one document. Sections without data are left out, not estimated.",
          },
          {
            problem: "Missing sign-off discovered at the deadline",
            answer: "A readiness check runs before the pack is generated and blocks it if the base year, director sign-off or a net zero year by 2050 is missing.",
          },
          {
            problem: "Social value tracked in another system",
            answer: "National TOMs commitments are held against contracts and periods, and delivery is logged as it happens, next to the carbon figures for the same contract.",
          },
          {
            problem: "PPN 026 commitments you have to prove during the contract",
            answer: "Add the PPN 026 Social Value Model to a contract, set a KPI against each award criterion you committed to (Good Jobs and Skills), and log delivery with the payroll extract, training record or timesheet attached. A check flags contracts of £5 million or more with fewer than three KPIs.",
          },
        ],
        feature: {
          eyebrow: "Reports",
          title: "Tender documents from published figures only.",
          lead: "Every figure in a pack comes from a published snapshot or your own records. Nothing is estimated or written for you.",
          points: [
            "Bid carbon pack with a PPN 006 Carbon Reduction Plan",
            "Emissions trend across your published years",
            "Each featured contract with its carbon, National TOMs and PPN 026 KPIs delivered against commitment, side by side",
            "Model answers built only from your published figures",
            "Emissions reports with the auditor's CSV calculation trail",
          ],
          media: { kind: "loop", src: "/marketing/loops/plan.mp4", label: "Guided Carbon Reduction Plan, section by section from boundary to sign-off" },
        },
        detail: {
          eyebrow: "Planning",
          title: "Targets that match the plan you submit.",
          lead: "The base year, targets and transition plan in MetricOra are the ones printed in the Carbon Reduction Plan, so they stay consistent between bids.",
          points: ["Base year with a recalculation threshold and restatement log", "Transition plan checklist with board approval", "Internal carbon price for tender appraisals"],
          media: { kind: "shot", src: "/marketing/screens/crp-baseline.jpg", alt: "Baseline step of the Carbon Reduction Plan comparing each scope with the base year" },
        },
        closing: { title: "Have your next Carbon Reduction Plan ready before the tender lands.", lead: "Publish a year of data in the trial and generate the plan from it." },
      }}
    />
  );
}
