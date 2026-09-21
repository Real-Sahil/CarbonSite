import { requireOrgMember, AuthError, ROLE_GROUPS } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ForecastingClient } from "./forecasting-client";

export default async function ForecastingPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  try {
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-8">
          <p className="text-red-600 text-sm">You do not have permission to view this page.</p>
        </div>
      );
    }
    throw err;
  }
  return <ForecastingClient />;
}
