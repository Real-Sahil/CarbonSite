import type { Archiver } from "archiver";

/** Streams a ZIP that `write` fills, as a download response. */
export async function zipResponse(filename: string, write: (archive: Archiver) => Promise<unknown>): Promise<Response> {
  const [{ PassThrough, Readable }, { ZipArchive }, Sentry] = await Promise.all([import("node:stream"), import("archiver"), import("@sentry/nextjs")]);
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const out = new PassThrough();
  archive.on("error", (err: Error) => {
    Sentry.captureException(err);
    out.destroy(err);
  });
  archive.pipe(out);
  void write(archive)
    .then(() => archive.finalize())
    .catch((err) => {
      Sentry.captureException(err);
      archive.abort();
      out.destroy(err instanceof Error ? err : new Error(String(err)));
    });
  return new Response(Readable.toWeb(out) as ReadableStream, {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}
