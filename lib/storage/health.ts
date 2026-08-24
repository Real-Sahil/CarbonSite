import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/db";

function activeDriver(): "r2" | "db" | "local" {
  const configured = process.env.STORAGE_DRIVER;
  const isProd = process.env.NODE_ENV === "production";
  const hasR2 = Boolean(
    process.env.STORAGE_ENDPOINT &&
      process.env.STORAGE_ACCESS_KEY_ID &&
      process.env.STORAGE_SECRET_ACCESS_KEY,
  );
  if (configured === "r2") return "r2";
  if (configured === "db") return "db";
  if (configured === "local") return isProd ? "db" : "local";
  if (hasR2) return "r2";
  return isProd ? "db" : "local";
}

export async function checkStorageHealth(): Promise<{
  ok: boolean;
  driver: string;
  reason?: string;
}> {
  const driver = activeDriver();

  try {
    if (driver === "r2") {
      const s3 = new S3Client({
        region: "auto",
        endpoint: process.env.STORAGE_ENDPOINT!,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
          secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
        },
      });
      await s3.send(
        new HeadBucketCommand({ Bucket: process.env.STORAGE_BUCKET ?? "carbonsite" }),
      );
      return { ok: true, driver };
    }

    if (driver === "db") {
      await prisma.$queryRaw`SELECT 1 FROM storage_objects LIMIT 0`;
      return { ok: true, driver };
    }

    // local driver — dev-only; just confirm the uploads dir is writable
    const { access, mkdir } = await import("fs/promises");
    const { constants } = await import("fs");
    const { resolve } = await import("path");
    const uploadsDir = resolve(process.cwd(), "uploads");
    await mkdir(uploadsDir, { recursive: true });
    await access(uploadsDir, constants.W_OK);
    return { ok: true, driver };
  } catch (error) {
    return {
      ok: false,
      driver,
      reason: error instanceof Error ? error.message : "storage_unreachable",
    };
  }
}
