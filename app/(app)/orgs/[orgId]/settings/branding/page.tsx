import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { presignDownload } from "@/lib/storage";
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

  // Short-lived preview URL for an already-uploaded logo.
  let logoPreviewUrl: string | null = null;
  if (branding?.reportHeaderLogoKey) {
    try {
      logoPreviewUrl = await presignDownload(branding.reportHeaderLogoKey);
    } catch {
      logoPreviewUrl = null;
    }
  }

  return (
    <div className="flex flex-col gap-[28px]">
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
                    reportHeaderLogoKey: branding.reportHeaderLogoKey,
                  }
                : null
            }
            logoPreviewUrl={logoPreviewUrl}
          />
        </CardContent>
      </Card>
    </div>
  );
}
