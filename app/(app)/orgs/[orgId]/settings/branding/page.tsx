import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UpsertBrandingForm } from "./branding-actions";

interface BrandingPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function BrandingPage({ params }: BrandingPageProps) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, "admin");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-8">
          <p className="text-red-600">
            You do not have permission to manage branding settings.
          </p>
        </div>
      );
    }
    throw err;
  }

  const branding = await prisma.tenantBranding.findUnique({
    where: { organizationId: orgId },
  });

  return (
    <div className="p-[42px] max-w-[1200px] mx-auto flex flex-col gap-[42px]">
      <div>
        <p className="text-xs font-normal tracking-[-0.36px] text-[#0f3e17] bg-[#b6ced5] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
          Settings
        </p>
        <h1
          className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
          style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
        >
          Branding
        </h1>
        <p className="text-sm text-[#222222] font-normal tracking-[-0.42px] mt-[7px]">
          Configure white-label branding for your organisation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">White-label branding</CardTitle>
          <CardDescription>
            Set a subdomain, colours, and font to customise the look and feel for your users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UpsertBrandingForm
            orgId={orgId}
            current={
              branding
                ? {
                    subdomain: branding.subdomain,
                    primaryHex: branding.primaryHex,
                    accentHex: branding.accentHex,
                    emailFromName: branding.emailFromName,
                    fontFamily: branding.fontFamily,
                    customDomain: branding.customDomain,
                  }
                : null
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
