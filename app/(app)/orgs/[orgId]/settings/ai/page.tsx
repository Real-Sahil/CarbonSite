export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { configuredProviders } from "@/lib/llm/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AiAssistToggle } from "./ai-assist-toggle";

interface Props {
  params: Promise<{ orgId: string }>;
}

const PROVIDER_NAMES: Record<string, string> = { groq: "Groq (US)", mistral: "Mistral AI (EU)" };

export default async function AiAssistPage({ params }: Props) {
  const { orgId } = await params;
  try {
    await requireOrgMember(orgId, "admin");
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <div className="p-8 text-sm text-red-600">Only organisation admins can change AI assistance.</div>;
  }
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { aiAssistEnabled: true } });
  const providers = configuredProviders();

  return (
    <div className="flex max-w-4xl flex-col gap-[28px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI assistance</CardTitle>
          <CardDescription className="max-w-[70ch]">
            When on, MetricOra uses an AI model to word report summaries and to suggest categories and values from
            documents. Figures always come from your records: AI-written text that contains a number not in your
            data is discarded and the standard wording is used instead. Off by default.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-[#374151]">
          <AiAssistToggle orgId={orgId} enabled={org?.aiAssistEnabled === true} available={providers.length > 0} />
          <div>
            <p className="font-medium text-[#111827]">What is sent</p>
            <p className="mt-1 max-w-[70ch]">
              Totals, categories and the text of the document being read. Not your organisation&apos;s name, and
              never names or contact details of people. The providers below do not train models on it: Groq by
              contract, Mistral because this service has opted out.
            </p>
          </div>
          <div>
            <p className="font-medium text-[#111827]">Providers, in the order tried</p>
            <p className="mt-1">
              {providers.length > 0 ? providers.map((p) => PROVIDER_NAMES[p] ?? p).join(", then ") : "None configured on this service."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
