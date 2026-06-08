// Storage abstraction — supports two drivers:
//   STORAGE_DRIVER=r2    (default, production) — Cloudflare R2 via S3 API
//   STORAGE_DRIVER=local (development) — local filesystem under ./uploads/

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import path from "path";

const DRIVER = process.env.STORAGE_DRIVER ?? "r2";
const PRESIGN_TTL = 60 * 15; // 15 minutes

// ── R2 client (only initialised when driver = r2) ────────────────────────────
const s3 =
  DRIVER === "r2"
    ? new S3Client({
        region: "auto",
        endpoint: process.env.STORAGE_ENDPOINT!,
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
  if (!["evidence", "imports", "reports"].includes(segments[2])) return false;

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
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(s3!, cmd, { expiresIn: PRESIGN_TTL });
}

// ── Download ──────────────────────────────────────────────────────────────────
export async function presignDownload(key: string): Promise<string> {
  assertStorageKey(key);
  if (DRIVER === "local") {
    return `/api/dev/storage/serve?key=${encodeURIComponent(key)}`;
  }
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3!, cmd, { expiresIn: PRESIGN_TTL });
}

// ── Direct write (used by workers, not by HTTP clients) ───────────────────────
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  assertStorageKey(key);
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
  if (DRIVER === "local") {
    const localPath = localStoragePath(key);
    await unlink(localPath).catch(() => {}); // ignore if already gone
    return;
  }
  await s3!.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

function localStoragePath(key: string) {
  const root = path.resolve(process.cwd(), "uploads");
  const resolved = path.resolve(root, key);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Invalid local storage path: ${key}`);
  }
  return resolved;
}
