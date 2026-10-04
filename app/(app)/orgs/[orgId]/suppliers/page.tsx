export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { SavedViewsMenu } from "@/components/saved-views/saved-views-menu";
import { SURFACES, activeFilters } from "@/lib/saved-views";
import { mayShare, viewRoles } from "@/lib/saved-views/roles";
import { SuppliersFilters } from "./suppliers-filters";
import { SuppliersTable } from "./suppliers-table";

interface SuppliersPageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SuppliersPage({ params, searchParams }: SuppliersPageProps) {
  const { orgId } = await params;
  const query = await searchParams;
  const one = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  const filters = activeFilters("suppliers", Object.fromEntries(SURFACES.suppliers.filters.map((k) => [k, one(k)])));

  // The list API enforces who may read suppliers; this only decides whether to
  // offer saved views, and sends a signed-out visitor to sign in.
  let role: string | null = null;
  try {
    role = (await requireOrgMember(orgId, ...viewRoles())).membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Supplier Management</h1>
        <p className="text-gray-600 mt-2">
          Monitor supplier submission performance and data quality
        </p>
      </div>

      {role && (
        <SavedViewsMenu
          orgId={orgId}
          surface="suppliers"
          filters={filters}
          canShare={mayShare(role)}
          isAdmin={role === "admin"}
        />
      )}
      <SuppliersFilters filters={filters} />
      <SuppliersTable orgId={orgId} filters={filters} />
    </div>
  );
}
