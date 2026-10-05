import { PassThrough, Readable } from "node:stream";
import * as Sentry from "@sentry/nextjs";
import { ZipArchive } from "archiver";
import { writeAssurancePack } from "./pack";

/** Streams the assurance pack ZIP for one snapshot; shared by the member route and the verifier link. */
export function assurancePackResponse(opts: {
  orgId: string;
  snapshot: { id: string; version: number | string; reportingPeriod: { label: string } };
  engagementId?: string | null;
  generatedBy: string;
}): Response {
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const out = new PassThrough();
  archive.on("error", (err) => {
    Sentry.captureException(err);
    out.destroy(err);
  });
  archive.pipe(out);
  void writeAssurancePack(archive, { orgId: opts.orgId, snapshotId: opts.snapshot.id, engagementId: opts.engagementId, generatedBy: opts.generatedBy })
    .then(() => archive.finalize())
    .catch((err) => {
      Sentry.captureException(err);
      archive.abort();
      out.destroy(err instanceof Error ? err : new Error(String(err)));
    });

  const slug = opts.snapshot.reportingPeriod.label.replace(/[^\w.-]+/g, "-").slice(0, 40);
  return new Response(Readable.toWeb(out) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="assurance-pack-${slug}-v${opts.snapshot.version}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
