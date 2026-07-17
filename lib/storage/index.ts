// Storage abstraction — supports three drivers:
//   STORAGE_DRIVER=r2    — Cloudflare R2 / any S3-compatible bucket
//   STORAGE_DRIVER=db    — bytes persisted in Postgres (zero-cost default
//                          for production when no bucket is configured)
//   STORAGE_DRIVER=local — local filesystem under ./uploads/ (development
//                          only; serverless filesystems are ephemeral, so
//                          "local" silently upgrades to "db" in production)

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { signStorageUrl } from "./signing";

function resolveDriver(): "r2" | "db" | "local" {
  const configured = process.env.STORAGE_DRIVER;
  const isProd = process.env.NODE_ENV === "production";
  const hasR2 = Boolean(
    process.env.STORAGE_ENDPOINT &&
      process.env.STORAGE_ACCESS_KEY_ID &&
      process.env.STORAGE_SECRET_ACCESS_KEY,
  );

  if (configured === "r2") return "r2";
  if (configured === "db") return "db";
  if (configured === "local") {
    if (isProd) {
      console.warn(
        "[storage] STORAGE_DRIVER=local cannot persist files on serverless — using the Postgres-backed driver instead.",
      );
      return "db";
    }
    return "local";
  }
  // Nothing configured: prefer R2 when its credentials exist, otherwise a
  // driver that actually works in the current environment.
  if (hasR2) return "r2";
  return isProd ? "db" : "local";
}

const DRIVER = resolveDriver();
const PRESIGN_TTL = 60 * 15; // 15 minutes

// Absolute origin for db-driver URLs — mobile clients and redirects need a
// full URL, never a bare path.
function appOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

// ── R2 client (only initialised when driver = r2) ────────────────────────────
const s3 =
  DRIVER === "r2"
    ? new S3Client({
        region: "auto",
        endpoint: process.env.STORAGE_ENDPOINT!,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
          secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
        },
      })
    : null;

const BUCKET = process.env.STORAGE_BUCKET ?? "carbonsite";
const SAFE_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._ -]*$/;

// ── Key conventions ───────────────────────────────────────────────────────────
export const keys = {
  evidence: (orgId: string, evidenceId: string, filename: string) =>
    `org/${orgId}/evidence/${evidenceId}/${filename}`,
  importSource: (orgId: string, importId: string, extension = "csv") =>
    `org/${orgId}/imports/${importId}/source.${extension}`,
  importErrors: (orgId: string, importId: string) =>
    `org/${orgId}/imports/${importId}/errors.csv`,
  reportPdf: (orgId: string, reportId: string) =>
    `org/${orgId}/reports/${reportId}/report.pdf`,
  reportCsv: (orgId: string, reportId: string) =>
    `org/${orgId}/reports/${reportId}/report.csv`,
  brandingLogo: (orgId: string, filename: string) =>
    `org/${orgId}/branding/${filename}`,
};

// Legacy exports for backward compat
export const evidenceKey = keys.evidence;
export const importSourceKey = keys.importSource;
export const importErrorKey = keys.importErrors;
export const reportPdfKey = keys.reportPdf;
export const reportCsvKey = keys.reportCsv;

export function sanitizeStorageFilename(filename: string) {
  let sanitized = filename.replace(/[^\w.\- ]+/g, "_").trim();
  if (!sanitized || sanitized === "." || sanitized === "..") return "upload";
  if (!/^[A-Za-z0-9]/.test(sanitized)) sanitized = `upload_${sanitized.replace(/^[._ -]+/, "")}`;
  if (!sanitized || sanitized === "upload_") return "upload";
  return sanitized.slice(0, 180);
}

export function isValidStorageKey(key: string) {
  if (key.length === 0 || key.length > 1024) return false;
  if (!key.startsWith("org/")) return false;
  if (key.startsWith("/") || key.includes("\\") || key.includes("//")) return false;

  const segments = key.split("/");
  if (segments.length < 4) return false;
  if (segments[0] !== "org") return false;
  if (!["evidence", "imports", "reports", "branding"].includes(segments[2])) return false;

  return segments.every((segment) => {
    if (!segment || segment === "." || segment === "..") return false;
    return SAFE_SEGMENT_RE.test(segment);
  });
}

export function assertStorageKey(key: string) {
  if (!isValidStorageKey(key)) {
    throw new Error(`Invalid storage key: ${key}`);
  }
}

// ── Upload ────────────────────────────────────────────────────────────────────
export async function presignUpload(key: string, contentType: string): Promise<string> {
  assertStorageKey(key);
  if (DRIVER === "local") {
    // Local dev: return a special internal upload route
    return `/api/dev/storage/upload?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(contentType)}`;
  }
  if (DRIVER === "db") {
    const exp = Date.now() + PRESIGN_TTL * 1000;
    const sig = signStorageUrl(key, exp);
    return `${appOrigin()}/api/storage/upload?key=${encodeURIComponent(key)}&exp=${exp}&sig=${encodeURIComponent(sig)}&contentType=${encodeURIComponent(contentType)}`;
  }
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(s3!, cmd, { expiresIn: PRESIGN_TTL });
}

// ── Download ──────────────────────────────────────────────────────────────────
export async function presignDownload(key: string): Promise<string> {
  assertStorageKey(key);
  if (DRIVER === "local") {
    return `/api/dev/storage/serve?key=${encodeURIComponent(key)}`;
  }
  if (DRIVER === "db") {
    const exp = Date.now() + PRESIGN_TTL * 1000;
    const sig = signStorageUrl(key, exp);
    return `${appOrigin()}/api/storage/serve?key=${encodeURIComponent(key)}&exp=${exp}&sig=${encodeURIComponent(sig)}`;
  }
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3!, cmd, { expiresIn: PRESIGN_TTL });
}

// ── Direct read (used by workers, not by HTTP clients) ───────────────────────
export async function getObject(key: string): Promise<Buffer> {
  if (DRIVER === "db") {
    return dbRead(key);
  }
  if (DRIVER === "local") {
    const { readFile } = await import("fs/promises");
    const localPath = path.join(process.cwd(), "uploads", key);
    return readFile(localPath);
  }
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const response = await s3!.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const stream = response.Body;
  if (!stream) throw new Error(`Empty response body for key: ${key}`);
  // Collect stream chunks into a Buffer
  const chunks: Uint8Array[] = [];
  // @ts-expect-error — AWS SDK stream is a web ReadableStream or Node stream depending on env
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// ── Direct write (used by workers, not by HTTP clients) ───────────────────────
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  assertStorageKey(key);
  if (DRIVER === "db") {
    await dbWrite(key, body, contentType);
    return;
  }
  if (DRIVER === "local") {
    const localPath = localStoragePath(key);
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(localPath, body);
    return;
  }
  await s3!.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  assertStorageKey(key);
  if (DRIVER === "db") {
    return dbRead(key);
  }
  if (DRIVER === "local") {
    const localPath = localStoragePath(key);
    return readFile(localPath);
  }

  const result = await s3!.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// ── Delete ────────────────────────────────────────────────────────────────────
export async function deleteObject(key: string): Promise<void> {
  assertStorageKey(key);
  if (DRIVER === "db") {
    await prisma.storageObject.deleteMany({ where: { key } });
    return;
  }
  if (DRIVER === "local") {
    const localPath = localStoragePath(key);
    await unlink(localPath).catch(() => {}); // ignore if already gone
    return;
  }
  await s3!.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// ── Postgres-backed driver primitives ────────────────────────────────────────
export async function dbWrite(key: string, body: Buffer, contentType: string): Promise<void> {
  const bytes = new Uint8Array(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)) as Uint8Array<ArrayBuffer>;
  await prisma.storageObject.upsert({
    where: { key },
    update: { bytes, contentType, byteSize: body.byteLength },
    create: { key, bytes, contentType, byteSize: body.byteLength },
  });
}

async function dbRead(key: string): Promise<Buffer> {
  const object = await prisma.storageObject.findUnique({ where: { key } });
  if (!object) throw new Error(`Storage object not found: ${key}`);
  return Buffer.from(object.bytes);
}

export async function dbReadWithType(
  key: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const object = await prisma.storageObject.findUnique({ where: { key } });
  if (!object) return null;
  return { bytes: Buffer.from(object.bytes), contentType: object.contentType };
}

function localStoragePath(key: string) {
  const root = path.resolve(process.cwd(), "uploads");
  const resolved = path.resolve(root, key);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Invalid local storage path: ${key}`);
  }
  return resolved;
}
