export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { handleRouteError } from "@/lib/validation/api";

const contactSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  email: z.string().email().max(254).trim(),
  company: z.string().min(1).max(200).trim(),
  message: z.string().min(10).max(5000).trim(),
});

const CONTACT_EMAIL = "hello@metricora.co.uk";

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitRequest(req, {
      key: "contact:form",
      limit: 5,
      windowMs: 3_600_000,
    });
    if (limited) return limited;

    const body = contactSchema.parse(await req.json());

    await sendTransactionalEmail({
      to: CONTACT_EMAIL,
      subject: `Pilot request from ${body.name} at ${body.company}`,
      text: [
        `Name: ${body.name}`,
        `Email: ${body.email}`,
        `Company: ${body.company}`,
        ``,
        `Message:`,
        body.message,
      ].join("\n"),
      html: `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#f8f9fa;margin:0;padding:0">
<div style="max-width:560px;margin:40px auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#0f172a;padding:24px 32px">
    <span style="color:#fff;font-size:18px;font-weight:600;letter-spacing:-0.02em">MetricOra — Pilot Request</span>
  </div>
  <div style="padding:32px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:90px">Name</td><td style="padding:8px 0;color:#111827;font-size:14px;font-weight:500">${escapeHtml(body.name)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Email</td><td style="padding:8px 0;font-size:14px"><a href="mailto:${escapeHtml(body.email)}" style="color:#f97316">${escapeHtml(body.email)}</a></td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Company</td><td style="padding:8px 0;color:#111827;font-size:14px">${escapeHtml(body.company)}</td></tr>
    </table>
    <div style="background:#f8f9fa;border-radius:6px;padding:16px">
      <p style="margin:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">Message</p>
      <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(body.message)}</p>
    </div>
  </div>
</div>
</body>
</html>`,
    });

    // Send a confirmation email to the enquirer
    await sendTransactionalEmail({
      to: body.email,
      subject: "We received your MetricOra pilot request",
      text: [
        `Hi ${body.name},`,
        ``,
        `Thanks for reaching out about a MetricOra pilot. We'll be in touch shortly at this address.`,
        ``,
        `In the meantime, you can create a free workspace to start exploring:`,
        `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.metricora.co.uk"}/sign-up`,
        ``,
        `The MetricOra team`,
        `hello@metricora.co.uk`,
      ].join("\n"),
      html: `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#f8f9fa;margin:0;padding:0">
<div style="max-width:520px;margin:40px auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#0f172a;padding:24px 32px">
    <span style="color:#fff;font-size:18px;font-weight:600;letter-spacing:-0.02em">MetricOra</span>
  </div>
  <div style="padding:32px">
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#111827;letter-spacing:-0.02em">We've received your request</h1>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;line-height:1.6">Hi ${escapeHtml(body.name)}, thanks for reaching out about a MetricOra pilot. We'll be in touch shortly.</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6">While you wait, you can create a free workspace to start exploring the platform.</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.metricora.co.uk"}/sign-up" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500">Create workspace</a>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:12px">Questions? Reply to this email or write to <a href="mailto:hello@metricora.co.uk" style="color:#f97316">hello@metricora.co.uk</a></p>
  </div>
</div>
</body>
</html>`,
    }).catch(() => {
      // Non-critical — don't fail the submission if the confirmation email fails
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
