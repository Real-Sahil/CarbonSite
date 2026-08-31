export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Mail,
  Users,
  FileText,
  CheckCircle,
  Truck,
  Send,
} from "lucide-react";

interface SuppliersPageProps {
  params: Promise<{ orgId: string }>;
}

export async function generateMetadata({ params }: SuppliersPageProps) {
  const { orgId } = await params;
  return {
    title: "Supplier Invitations | CarbonSite",
    description: "Invite suppliers to submit emissions data and collaborate on Scope 3 calculations",
  };
}

export default async function SuppliersPage({ params }: SuppliersPageProps) {
  const { orgId } = await params;

  const user = await requireOrgMember(orgId, "admin", "editor");

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { name: true },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Link href={`/orgs/${orgId}/integrations`} className="flex items-center gap-2 text-amber-400 hover:text-amber-300 mb-4">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Integrations</span>
          </Link>
          <div className="mb-2 flex items-center gap-2">
            <Truck className="h-5 w-5 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400 uppercase tracking-widest">Supplier Management</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Invite Suppliers to Collaborate</h1>
          <p className="text-slate-400">
            Send secure invitations to suppliers to submit emissions data, facility information, and supporting documentation.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8">
          {/* Invite Section */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Mail className="h-5 w-5 text-amber-400" />
                Send Supplier Invitation
              </CardTitle>
              <CardDescription>Create a secure link and send to suppliers via email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="supplier-email" className="block text-sm font-medium text-white mb-2">
                    Supplier Email Address
                  </label>
                  <input
                    id="supplier-email"
                    type="email"
                    placeholder="contact@supplier.com"
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label htmlFor="supplier-name" className="block text-sm font-medium text-white mb-2">
                    Supplier Name
                  </label>
                  <input
                    id="supplier-name"
                    type="text"
                    placeholder="e.g., Acme Supply Co."
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label htmlFor="supplier-category" className="block text-sm font-medium text-white mb-2">
                    Category (Optional)
                  </label>
                  <select
                    id="supplier-category"
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Select category</option>
                    <option value="logistics">Logistics & Transport</option>
                    <option value="raw-materials">Raw Materials</option>
                    <option value="packaging">Packaging</option>
                    <option value="subcontractors">Subcontractors</option>
                    <option value="services">Professional Services</option>
                    <option value="facilities">Facilities & Utilities</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <Button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                  <Send className="h-4 w-4 mr-2" />
                  Send Invitation
                </Button>
              </div>

              <div className="border-t border-slate-700 pt-6">
                <h4 className="font-semibold text-white mb-3">What suppliers will see:</h4>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Secure link to submit emissions data without creating an account</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Simple form to enter facility information, waste, energy, and travel data</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Option to upload supporting documents (invoices, receipts, certifications)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Confirmation email when their submission is received and reviewed</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-400" />
                Active Suppliers
              </CardTitle>
              <CardDescription>Suppliers you've invited to collaborate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Truck className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400">No suppliers invited yet</p>
                <p className="text-sm text-slate-500 mt-1">Send your first invitation above to get started</p>
              </div>
            </CardContent>
          </Card>

          {/* How It Works */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">How Supplier Collaboration Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-semibold text-sm flex-shrink-0">1</div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">You Send Invitation</h4>
                    <p className="text-sm text-slate-300">Create an invitation with the supplier's email and send them a secure link.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-semibold text-sm flex-shrink-0">2</div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">Supplier Submits Data</h4>
                    <p className="text-sm text-slate-300">They fill out a simple form with facility info, emissions data, and can upload supporting documents. No account needed.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-semibold text-sm flex-shrink-0">3</div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">Your Team Reviews</h4>
                    <p className="text-sm text-slate-300">Submissions appear in your review queue. You can approve, request clarifications, or reject with feedback.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-semibold text-sm flex-shrink-0">4</div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">Data Powers Your Reports</h4>
                    <p className="text-sm text-slate-300">Approved supplier data is included in your Scope 3 calculations and audit-ready reports.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Best Practices */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">Best Practices for Supplier Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-white">Start early:</strong> Begin supplier outreach before your reporting deadline</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-white">Prioritize Tier 1:</strong> Focus first on direct suppliers with largest spend</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-white">Follow up:</strong> Send reminders after 1 week and 2 weeks if no response</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-white">Provide context:</strong> Explain why emissions data matters to your business</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-white">Use estimates:</strong> CarbonSite estimates Scope 3 if suppliers don't respond</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
