import { Prisma } from "@prisma/client";

export function isMissingDatabaseObjectError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}
