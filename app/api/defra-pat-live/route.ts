import { createHash } from "node:crypto";
import { defraFetch } from "@/lib/defra-dwt/client";

// TEMPORARY. One-off live Production Approval Test run against Defra's External Test host. Never merged; removed after the run.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const KEY_SHA256 = "61a934a2a97800bbf56d19ba105fa883c5c4835b5c6f79bc5eba79615cab3576";

const t = (amount: number) => ({ metric: "Tonnes", amount, isEstimate: false });
const item = (patch: Record<string, unknown> = {}) => ({
  ewcCodes: ["170904"],
  wasteDescription: "Basic mixed construction and demolition waste, this includes recyclable house bricks, gypsum plaster and slates.",
  physicalForm: "Solid",
  numberOfContainers: 1,
  typeOfContainers: "SKI",
  weight: t(6.9),
  disposalOrRecoveryCodes: [{ code: "R1", weight: t(6.9) }],
  containsPops: false,
  containsHazardous: false,
  ...patch,
});
const carrier = { registrationNumber: "CBDL12345", organisationName: "A Haulier", meansOfTransport: "Road", vehicleRegistration: "RNT 493" };
const receipt = (items: Record<string, unknown>[], carrierPatch: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  apiCode: "1f83215e-4b90-4785-9ab2-2614839aa2e9",
  dateTimeReceived: "2026-10-12T09:30:00Z",
  wasteItems: items,
  carrier: { ...carrier, ...carrierPatch },
  receiver: { siteName: "Depot", authorisationNumber: "EPR/AB1234CD" },
  receipt: { address: { fullAddress: "1 Yard Lane", postcode: "RG1 1AA" } },
  ...extra,
});
const haz = (codes: string[], components: Record<string, unknown>[]) =>
  item({ ewcCodes: ["170503"], containsHazardous: true, hazardous: { sourceOfComponents: "OWN_TESTING", hazCodes: codes, components } });
const CJ = "CJ32LE/A0001";

const scenarios: { id: string; body: unknown; refused?: boolean }[] = [
  { id: "R01", body: receipt([item()]) },
  { id: "R02", body: receipt([item(), item({ ewcCodes: ["200301"], wasteDescription: "Mixed municipal waste from a site office", weight: t(2.1), disposalOrRecoveryCodes: [{ code: "D10", weight: t(2.1) }] })]) },
  { id: "R03", body: receipt([item()], { meansOfTransport: "Road", vehicleRegistration: "AB12 CDE" }) },
  { id: "R04", body: receipt([item({ disposalOrRecoveryCodes: [] })]) },
  { id: "R05", body: receipt([item({ disposalOrRecoveryCodes: [{ code: "R1", weight: t(4) }, { code: "R3", weight: t(2.9) }] })]) },
  { id: "R07", body: receipt([item({ ewcCodes: ["200301", "200307"] })]) },
  { id: "C01", refused: true, body: receipt([item()], { registrationNumber: null }) },
  { id: "C02", body: receipt([item()], { registrationNumber: null, reasonForNoRegistrationNumber: "ONE_OFF" }) },
  { id: "B01", body: receipt([item()], {}, { brokerOrDealer: { organisationName: "Dealer Waste Ltd", registrationNumber: "CBDL54321", address: { fullAddress: "2 Dealer Road", postcode: "RG2 2BB" } } }) },
  { id: "P01", body: receipt([item({ containsPops: true, pops: { sourceOfComponents: "GUIDANCE", components: [{ code: "PFHXS", concentration: 0.5 }, { code: "PFOA", concentration: 2 }] } })]) },
  { id: "H01", body: receipt([haz(["HP_5", "HP_10"], [{ name: "Lead", concentration: 2.1 }, { name: "Chromium", concentration: 40 }])], {}, { hazardousWasteConsignmentCode: CJ }) },
  { id: "H02", refused: true, body: receipt([haz(["HP_3"], [{ name: "Lead" }])]) },
  { id: "H03", body: receipt([haz(["HP_3"], [{ name: "Lead" }])], {}, { reasonForNoConsignmentCode: "NO_DOC_WITH_WASTE" }) },
  { id: "X01", body: receipt([item({ ewcCodes: ["170503"], containsHazardous: true, hazardous: { sourceOfComponents: "OWN_TESTING", hazCodes: ["HP_5"], components: [{ name: "Lead", concentration: 2.1 }] }, containsPops: true, pops: { sourceOfComponents: "GUIDANCE", components: [{ code: "PFOA", concentration: 2 }] } })], {}, { hazardousWasteConsignmentCode: CJ }) },
];

const parse = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 500);
  }
};

export async function GET(req: Request) {
  const k = new URL(req.url).searchParams.get("k") ?? "";
  if (process.env.VERCEL_ENV !== "preview" || createHash("sha256").update(k).digest("hex") !== KEY_SHA256) {
    return new Response("not found", { status: 404 });
  }
  const created: { id: string; wtid: string }[] = [];
  const creates: unknown[] = [];
  const only = new URL(req.url).searchParams.get("only")?.split(",");
  for (const s of scenarios.filter((x) => !only || only.includes(x.id))) {
    try {
      const res = await defraFetch("/movements/receive", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(s.body) });
      const body = parse(await res.text());
      const wtid = typeof body === "object" && body ? ((body as Record<string, unknown>).wasteTrackingId as string | undefined) : undefined;
      if (wtid) created.push({ id: s.id, wtid });
      creates.push({ scenario: s.id, expectRefused: !!s.refused, status: res.status, body });
    } catch (e) {
      creates.push({ scenario: s.id, error: e instanceof Error ? e.name : "error" });
    }
  }
  let pat: unknown = null;
  if (created.length) {
    const res = await defraFetch("/production-approval-tests", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(created.map((c) => ({ scenarioId: c.id, wasteTrackingId: c.wtid }))),
    });
    pat = { status: res.status, body: parse(await res.text()) };
  }
  return Response.json({ creates, pat });
}
