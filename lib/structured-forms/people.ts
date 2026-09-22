import { prisma } from "@/lib/db";

export type PersonRef = { id: string; name: string | null };

export async function lookupPeople(
  ids: Array<string | null | undefined>,
): Promise<(id: string | null | undefined) => PersonRef | null> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  const users = unique.length
    ? await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return (id) => (id ? byId.get(id) ?? null : null);
}

/** Stored sections are always a JSON object; anything else (legacy null, bad write) opens as an empty form. */
export function asSections<T extends object>(value: unknown): T | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as T) : null;
}
