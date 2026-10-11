export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { z } from "zod";
import { handleConnectorIngest, ingestEnvelope, MAX_INGEST_ROWS } from "@/lib/connectors/ingest";

// Records already in the platform's own shape, from any system that can POST JSON.
const recordSchema = z.object({
  emissionCategoryCode: z.string().min(1),
  amount: z.number().positive(),
  unit: z.string().min(1),
  activityDate: z.coerce.date().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sourceDescription: z.string().max(500).optional(),
  facilityName: z.string().max(200).optional(),
  businessUnitName: z.string().max(200).optional(),
  country: z.string().max(80).optional(),
  region: z.string().max(80).optional(),
  supplierName: z.string().max(200).optional(),
  fuelType: z.string().max(80).optional(),
  transportMode: z.string().max(80).optional(),
  refrigerantType: z.string().max(80).optional(),
  spendAmount: z.number().optional(),
  spendCurrency: z.string().length(3).optional(),
  distanceAmount: z.number().optional(),
  distanceUnit: z.string().max(20).optional(),
  scope2Method: z.enum(["location_based", "market_based"]).optional(),
  externalRecordId: z.string().max(200).optional(),
});

const bodySchema = ingestEnvelope.extend({
  records: z.array(recordSchema).min(1).max(MAX_INGEST_ROWS),
});

/**
 * POST /api/orgs/[orgId]/integrations/webhooks/ingest
 * API-key authenticated. Stages activity records sent as JSON for review;
 * nothing is committed until someone commits the batch in Imports.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  return handleConnectorIngest(req, params, "webhook", bodySchema, async (body: z.infer<typeof bodySchema>) => ({
    metadata: { provider: "webhook", ingestionDate: new Date(), externalBatchId: body.externalBatchId },
    records: body.records.map((r, i) => ({
      ...r,
      externalRecordId: r.externalRecordId ?? String(i + 1),
      facilityCode: r.facilityName,
      businessUnitCode: r.businessUnitName,
    })),
  }));
}
