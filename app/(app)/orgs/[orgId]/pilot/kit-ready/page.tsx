import { redirect } from "next/navigation";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, FileText, Users, Settings, BookOpen, Shield, Download, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface KitReadyPageProps {
  params: Promise<{ orgId: string }>;
}

const documentConfig = [
  {
    icon: CheckCircle2,
    title: "Executive Summary",
    description: "90-day timeline overview, key milestones, contact summary, and success metrics",
    audience: "C-suite & Leadership",
  },
  {
    icon: Users,
    title: "Sustainability Manager Guide",
    description: "Data collection responsibilities, supplier management, key metrics tracking, and review workflows",
    audience: "Sustainability Lead",
  },
  {
    icon: Settings,
    title: "Finance Lead Guide",
    description: "Accounting system integration, historical data upload, Scope 3 spend validation, and ROI calculation",
    audience: "Finance & Accounting",
  },
  {
    icon: Download,
    title: "Field Worker Guide",
    description: "Mobile app setup, camera capture workflow, OCR extraction, offline capability, and submission process",
    audience: "Field Teams",
  },
  {
    icon: Settings,
    title: "Technical Integration Guide",
    description: "SSO/OAuth setup, user provisioning, API access, security best practices, and support contacts",
    audience: "IT Administrator",
  },
  {
    icon: Shield,
    title: "Compliance Guide",
    description: "Audit evidence packages, framework mapping (CSRD/SBTi/GHG), data quality standards, and immutability verification",
    audience: "Compliance & Audit",
  },
];

export default async function KitReadyPage({ params }: KitReadyPageProps) {
  const { orgId } = await params;

  try {
    // Authorization: admin or editor only
    await requireOrgMember(orgId, "admin", "editor");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      redirect(`/orgs/${orgId}/dashboard`);
    }
    throw err;
  }

  // Fetch organization and recent kit generation
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true },
  });

  if (!org) {
    redirect("/");
  }

  const recentGeneration = await prisma.auditLog.findFirst({
    where: {
      organizationId: orgId,
      action: "pilot_kit_generated",
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      metadata: true,
    },
  });

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        {/* Success Message */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="bg-emerald-100 rounded-full p-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-slate-900 mb-4">
            Documentation Kit Ready
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-2">
            Your personalized pilot program documentation has been generated successfully.
          </p>
          {recentGeneration && (
            <p className="text-sm text-slate-500">
              Generated on {new Date(recentGeneration.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Documents Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {documentConfig.map((doc, index) => {
            const IconComponent = doc.icon;
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <IconComponent className="h-6 w-6 text-slate-600" />
                    <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      PDF
                    </span>
                  </div>
                  <CardTitle className="text-lg">{doc.title}</CardTitle>
                  <CardDescription className="text-xs font-semibold text-slate-500">
                    FOR: {doc.audience}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-4">{doc.description}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    asChild
                  >
                    <a href={`/api/orgs/${orgId}/pilot/kit-download?doc=${index}`}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Next Steps */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              <li className="flex gap-4">
                <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                  1
                </span>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">Distribute Documents</h4>
                  <p className="text-sm text-slate-600">
                    Download and distribute the appropriate documents to each team member based on their role.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                  2
                </span>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">Schedule Kickoff Meeting</h4>
                  <p className="text-sm text-slate-600">
                    Bring all stakeholders together to review timelines, confirm responsibilities, and set success criteria.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                  3
                </span>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">Set Up SSO & User Accounts</h4>
                  <p className="text-sm text-slate-600">
                    Follow the Technical Integration Guide to configure authentication and provision user accounts.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                  4
                </span>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">Begin Data Collection</h4>
                  <p className="text-sm text-slate-600">
                    Import historical data and activate field workers on the mobile app for real-time capture.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                  5
                </span>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">Run First Calculation & Report</h4>
                  <p className="text-sm text-slate-600">
                    Validate your baseline emissions data and generate your first audit-ready report.
                  </p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Support Information */}
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 mb-4">
              The documentation kit includes contact information for CarbonSite's onboarding team. Refer to the Executive Summary for direct support details, or visit your organization's dashboard for additional resources.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild>
                <Link href={`/orgs/${orgId}/dashboard`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/orgs/${orgId}/pilot`}>
                  Generate New Kit
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
