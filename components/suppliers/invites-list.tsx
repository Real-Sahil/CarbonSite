import { Users, Truck, Clock, CheckCircle, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Invite {
  id: string;
  email: string;
  companyName: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  inviteMethod: string;
  createdBy: {
    name: string | null;
    email: string;
  };
}

interface SupplierInvitesListProps {
  orgId: string;
  invites: Invite[];
}

export function SupplierInvitesList({
  orgId,
  invites,
}: SupplierInvitesListProps) {
  const getStatus = (
    usedAt: Date | null,
    expiresAt: Date,
    inviteMethod: string
  ): { label: string; color: string; icon: React.ReactNode } => {
    if (usedAt) {
      return {
        label: "Accepted",
        color: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: <CheckCircle className="h-4 w-4" />,
      };
    }

    if (new Date() > expiresAt && inviteMethod === "magic-link") {
      return {
        label: "Expired",
        color: "bg-slate-100 text-slate-500 border-slate-200",
        icon: <XCircle className="h-4 w-4" />,
      };
    }

    return {
      label: "Pending",
      color: "bg-[#fff7ed] text-[#f97316] border-[#fed7aa]",
      icon: <Clock className="h-4 w-4" />,
    };
  };

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-900 flex items-center gap-2">
          <Users className="h-5 w-5 text-[#f97316]" />
          Supplier Invitations
        </CardTitle>
        <CardDescription>
          Suppliers you&apos;ve invited to collaborate
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invites.length === 0 ? (
          <div className="text-center py-8">
            <Truck className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-500">No suppliers invited yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Send your first invitation above to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {invites.map((invite) => {
              const status = getStatus(
                invite.usedAt,
                invite.expiresAt,
                invite.inviteMethod
              );

              return (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-4 bg-white border border-[#E5E7EB] rounded-lg hover:border-slate-300 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div>
                        <p className="font-medium text-slate-900">
                          {invite.companyName || "Unknown Company"}
                        </p>
                        <p className="text-sm text-slate-500">{invite.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge
                        variant="outline"
                        className={`text-xs border ${status.color} flex items-center gap-1`}
                      >
                        {status.icon}
                        {status.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs border-slate-300 text-slate-600">
                        {invite.inviteMethod === "magic-link"
                          ? "Magic Link"
                          : "Account Created"}
                      </Badge>
                      {invite.inviteMethod === "magic-link" && !invite.usedAt && (
                        <span className="text-xs text-slate-500">
                          Expires {new Date(invite.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Invited by {invite.createdBy.name || invite.createdBy.email} on{" "}
                      {new Date(invite.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
