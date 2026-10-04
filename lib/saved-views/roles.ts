import { ROLE_GROUPS } from "@/lib/auth/session";

/** Who may keep saved views: everyone who can read the inventory, plus contract and project managers. */
export const viewRoles = () => [
  ...new Set([...ROLE_GROUPS.dataReaders, ...ROLE_GROUPS.contractManagers, ...ROLE_GROUPS.projectManagers]),
];

/** Who may share a view with the organisation. */
export const mayShare = (role: string) => (ROLE_GROUPS.editor as string[]).includes(role);
