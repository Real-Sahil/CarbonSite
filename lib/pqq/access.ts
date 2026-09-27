import type { OrgRole } from "@prisma/client";
import { MS_EDITORS, MS_READERS } from "@/lib/management-systems/access";

/** Bid and contract managers answer pre-qualification questionnaires alongside the management system editors. */
export const PQQ_EDITORS: OrgRole[] = [...MS_EDITORS, "contract_manager"];
export const PQQ_READERS: OrgRole[] = [...new Set([...MS_READERS, "contract_manager"])] as OrgRole[];
