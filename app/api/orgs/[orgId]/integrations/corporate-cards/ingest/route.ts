export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { z } from "zod";
import { CorporateCardsConnector } from "@/lib/connectors/corporate-cards-connector";
import { handleConnectorIngest, ingestEnvelope, MAX_INGEST_ROWS } from "@/lib/connectors/ingest";

const bodySchema = ingestEnvelope.extend({
  rows: z.array(z.record(z.unknown())).min(1).max(MAX_INGEST_ROWS),
});

/**
 * POST /api/orgs/[orgId]/integrations/corporate-cards/ingest
 * API-key authenticated. Accepts card transactions (Amex, Mastercard, Visa, Expensify, Concur; see lib/connectors/corporate-cards-connector.ts),
 * normalises them and stages an import batch for review. Nothing is committed
 * until someone commits the batch in Imports.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  return handleConnectorIngest(req, params, "corporate-cards", bodySchema, (body: z.infer<typeof bodySchema>) =>
    new CorporateCardsConnector().ingest({ rows: body.rows, externalBatchId: body.externalBatchId }),
  );
}
