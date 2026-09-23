import type { OrgRole } from "@prisma/client";
import { ROLE_GROUPS } from "@/lib/auth/session";

/** Sustainability editors, operations and the project delivery team. */
export const PLANT_EDITORS: OrgRole[] = [
  ...new Set<OrgRole>([...ROLE_GROUPS.editor, ...ROLE_GROUPS.projectManagers, "operations_manager"]),
];
