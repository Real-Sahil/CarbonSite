import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 is S3-compatible. Swap endpoint for MinIO/Garage in self-hosted environments.
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.STORAGE_ENDPOINT!, // e.g. https://<account>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.STORAGE_BUCKET!;
const PRESIGN_TTL = 60 * 15; // 15 minutes

// Key convention: org/{orgId}/{resource-type}/{resourceId}/{filename}
export function evidenceKey(orgId: string, evidenceId: string, filename: string) {
  return `org/${orgId}/evidence/${evidenceId}/${filename}`;
}

export function importSourceKey(orgId: string, importId: string) {
  return `org/${orgId}/imports/${importId}/source.csv`;
}

export function importErrorKey(orgId: string, importId: string) {
  return `org/${orgId}/imports/${importId}/errors.csv`;
}

export function reportPdfKey(orgId: string, reportId: string) {
  return `org/${orgId}/reports/${reportId}/report.pdf`;
}

export function reportCsvKey(orgId: string, reportId: string) {
  return `org/${orgId}/reports/${reportId}/report.csv`;
}

export async function presignUpload(key: string, contentType: string) {
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(s3, cmd, { expiresIn: PRESIGN_TTL });
}

export async function presignDownload(key: string) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: PRESIGN_TTL });
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
