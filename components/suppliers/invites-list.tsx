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
        color: "bg-[#F9FAFC] text-[#5B6A78] border-[#E3E8EE]",
        icon: <XCircle className="h-4 w-4" />,
      };
    }

    return {
      label: "Pending",
      color: "bg-[#fff7ed] text-[#c2400c] border-[#fed7aa]",
      icon: <Clock className="h-4 w-4" />,
    };
  };

  return (
    <Card className="border-[#E3E8EE] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-[#131d29] flex items-center gap-2">
          <Users className="h-5 w-5 text-[#c2400c]" />
          Supplier Invitations
        </CardTitle>
        <CardDescription>
          Suppliers you&apos;ve invited to collaborate
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invites.length === 0 ? (
          <div className="text-center py-8">
            <Truck className="h-12 w-12 text-[#5B6A78] mx-auto mb-3" />
            <p className="text-[#5B6A78]">No suppliers invited yet</p>
            <p className="text-sm text-[#5B6A78] mt-1">
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
                  className="flex items-center justify-between p-4 bg-white border border-[#E3E8EE] rounded-lg hover:border-[#E3E8EE] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div>
                        <p className="font-medium text-[#131d29]">
                          {invite.companyName || "Unknown Company"}
                        </p>
                        <p className="text-sm text-[#5B6A78]">{invite.email}</p>
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
                      <Badge variant="outline" className="text-xs border-[#E3E8EE] text-[#41505F]">
                        {invite.inviteMethod === "magic-link"
                          ? "Magic Link"
                          : "Account Created"}
                      </Badge>
                      {invite.inviteMethod === "magic-link" && !invite.usedAt && (
                        <span className="text-xs text-[#5B6A78]">
                          Expires {new Date(invite.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#5B6A78] mt-2">
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
