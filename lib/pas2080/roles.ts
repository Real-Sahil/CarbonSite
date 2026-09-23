import type { OrgRole } from "@prisma/client";
import { ROLE_GROUPS } from "@/lib/auth/session";

/** Sustainability editors and the project delivery team. Never field workers or suppliers. */
export const PAS2080_EDITORS: OrgRole[] = [...new Set([...ROLE_GROUPS.editor, ...ROLE_GROUPS.projectManagers])];
