import { prisma } from "@/lib/db";
import { llmClient } from "./client";

/**
 * True when this organisation's admins have turned on AI-assisted wording
 * and a provider is configured. Every call that sends an organisation's
 * information to a model checks this first.
 */
export async function aiAssistEnabled(orgId: string): Promise<boolean> {
  if (!llmClient.isConfigured()) return false;
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { aiAssistEnabled: true } });
  return org?.aiAssistEnabled === true;
}
