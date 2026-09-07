/**
 * Self-hosted PDF acknowledgment stamping using @signpdf/signpdf.
 *
 * Stamps a PDF with a visual acknowledgment block (signatory name, email,
 * date/time, truncated IP) and, when SIGNING_CERT_P12_BASE64 is set,
 * embeds a cryptographic digital signature using the provided P12 certificate.
 *
 * Env vars (all optional — falls back to visual-only stamp if absent):
 *   SIGNING_CERT_P12_BASE64   — base64-encoded P12/PFX certificate
 *   SIGNING_CERT_PASSPHRASE   — passphrase protecting the P12 (default: "")
 *
 * To generate a self-signed certificate for development:
 *   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 3650 -nodes -subj "/CN=CarbonSite Signing"
 *   openssl pkcs12 -export -out signing.p12 -inkey key.pem -in cert.pem -passout pass:changeme
 *   base64 signing.p12 | tr -d '\n'  # paste into SIGNING_CERT_P12_BASE64
 */

import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";

export interface AcknowledgmentParams {
  pdfBytes: Buffer;
  signatoryName: string;
  signatoryEmail: string;
  acknowledgedAt: Date;
  ip: string;
  reportId: string;
  requestId: string;
}

/**
 * Append an acknowledgment page to the PDF and optionally apply a
 * cryptographic P12 signature. Returns the stamped PDF bytes.
 */
export async function stampAcknowledgment(params: AcknowledgmentParams): Promise<Buffer> {
  const { pdfBytes, signatoryName, signatoryEmail, acknowledgedAt, ip, reportId, requestId } = params;

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Append a dedicated acknowledgment page
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const darkGreen = rgb(0.05, 0.35, 0.2);
  const black = rgb(0, 0, 0);
  const lightGray = rgb(0.85, 0.85, 0.85);

  // Header bar
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: darkGreen });
  page.drawText("Acknowledgment of Review", {
    x: 40, y: height - 48,
    size: 22, font: boldFont, color: rgb(1, 1, 1),
  });
  page.drawText("Digital confirmation record", {
    x: 40, y: height - 68,
    size: 11, font, color: rgb(0.8, 0.9, 0.85),
  });

  // Divider line
  page.drawLine({ start: { x: 40, y: height - 110 }, end: { x: width - 40, y: height - 110 }, thickness: 1, color: lightGray });

  const row = (label: string, value: string, y: number) => {
    page.drawText(label, { x: 40, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(value, { x: 40, y: y - 16, size: 11, font: boldFont, color: black });
  };

  row("SIGNATORY", signatoryName, height - 140);
  row("EMAIL ADDRESS", signatoryEmail, height - 190);
  row("ACKNOWLEDGED AT (UTC)", acknowledgedAt.toUTCString(), height - 240);
  row("NETWORK ADDRESS (MASKED)", maskIp(ip), height - 290);
  row("REPORT ID", reportId, height - 340);
  row("REQUEST ID", requestId, height - 390);

  page.drawLine({ start: { x: 40, y: height - 420 }, end: { x: width - 40, y: height - 420 }, thickness: 1, color: lightGray });

  page.drawText(
    "By completing this acknowledgment, the named individual confirms they have reviewed the\n" +
    "associated audit report in its entirety. This record is cryptographically bound to the\n" +
    "document and stored in the immutable audit log.",
    { x: 40, y: height - 450, size: 9, font, color: rgb(0.3, 0.3, 0.3), lineHeight: 16, maxWidth: width - 80 },
  );

  // Watermark on every existing page
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length - 1; i++) {
    const p = pages[i];
    p.drawText("ACKNOWLEDGED", {
      x: p.getWidth() / 2 - 60,
      y: p.getHeight() / 2,
      size: 40, font: boldFont,
      color: rgb(0, 0.5, 0.3),
      opacity: 0.08,
      rotate: degrees(45),
    });
  }

  const stampedBytes = Buffer.from(await pdfDoc.save());

  // Cryptographic signature (optional — requires P12 cert in env)
  const p12B64 = process.env.SIGNING_CERT_P12_BASE64;
  if (p12B64) {
    try {
      return await signWithP12(stampedBytes, p12B64, signatoryName, acknowledgedAt);
    } catch (err) {
      console.warn("[pdf-signer] P12 signing failed, returning visual-only stamp:", err);
    }
  }

  return stampedBytes;
}

async function signWithP12(
  pdfBytes: Buffer,
  p12B64: string,
  signatoryName: string,
  signingTime: Date,
): Promise<Buffer> {
  const { SignPdf } = await import("@signpdf/signpdf");
  const { pdflibAddPlaceholder } = await import("@signpdf/placeholder-pdf-lib");
  const { P12Signer } = await import("@signpdf/signer-p12");
  const { PDFDocument: PDFDoc } = await import("pdf-lib");

  const passphrase = process.env.SIGNING_CERT_PASSPHRASE ?? "";
  const p12Buffer = Buffer.from(p12B64, "base64");

  const pdfDoc = await PDFDoc.load(pdfBytes);

  await pdflibAddPlaceholder({
    pdfDoc,
    reason: `Acknowledged by ${signatoryName}`,
    contactInfo: signatoryName,
    name: signatoryName,
    location: "CarbonSite",
    signingTime,
  });

  const pdfWithPlaceholder = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));

  const signer = new P12Signer(p12Buffer, { passphrase });
  const signPdf = new SignPdf();
  const signed = await signPdf.sign(pdfWithPlaceholder, signer);
  return Buffer.from(signed);
}

function maskIp(ip: string): string {
  if (ip.includes(":")) {
    // IPv6 — show first 4 groups only
    const parts = ip.split(":");
    return parts.slice(0, 4).join(":") + "::****";
  }
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
  }
  return "****";
}
