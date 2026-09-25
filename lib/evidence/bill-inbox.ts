/**
 * Bill inbox: each organisation can turn on an address
 * (<token>@BILL_INBOX_DOMAIN) that its people forward bills and fuel
 * receipts to. Resend receives the mail and calls our webhook with
 * `email.received`; the attachments are stored as the organisation's
 * evidence and listed on the records page, where a person reads each one,
 * matches it to a record and attaches it. Nothing enters the inventory
 * without that confirmation.
 *
 * Only mail from a current member who may handle records is accepted; the
 * rest is dropped and logged.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { OrgRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { ROLE_GROUPS } from "@/lib/auth/session";
import { storeEvidenceFile } from "./store";
import { READABLE_BILL_TYPES } from "./read-bill";

export const MAX_INBOX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const RESEND_API = process.env.RESEND_API_URL ?? "https://api.resend.com";

/** Roles whose forwarded mail is accepted: record editors, reviewers and site/project managers. */
export const INBOX_SENDER_ROLES: OrgRole[] = [...new Set([...ROLE_GROUPS.reviewersAndEditors, ...ROLE_GROUPS.projectManagers])];

export function inboxDomain(): string | null {
  const d = process.env.BILL_INBOX_DOMAIN?.trim().toLowerCase();
  return d ? d : null;
}

export function inboxAddress(token: string | null | undefined): string | null {
  const domain = inboxDomain();
  return token && domain ? `${token}@${domain}` : null;
}

/** Hard-to-guess local part, e.g. bills-k3v9q2m8xa. */
export function newInboxToken(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  return `bills-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

/** "Sam Hartley <sam@x.co.uk>" -> "sam@x.co.uk". */
export function emailOf(address: string): string | null {
  const m = address.match(/<([^>]+)>/);
  const e = (m ? m[1] : address).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** The inbox token a message was sent to, if any recipient is on our domain. */
export function tokenFromRecipients(to: string[], domain: string): string | null {
  for (const addr of to) {
    const e = emailOf(addr);
    if (!e) continue;
    const [local, host] = e.split("@");
    if (host === domain && /^bills-[a-z0-9]{6,32}$/.test(local)) return local;
  }
  return null;
}

/**
 * Verifies a Svix-signed webhook (Resend's scheme): HMAC-SHA256 over
 * "{svix-id}.{svix-timestamp}.{raw body}" with the base64 secret after
 * "whsec_", compared against each "v1,<base64>" in svix-signature, and a
 * timestamp within five minutes.
 */
export function verifySvix(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  rawBody: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > 300) return false;
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export type ReceivedEmail = {
  email_id: string;
  from: string;
  to: string[];
  subject?: string;
  attachments?: { id: string; filename?: string; content_type?: string }[];
};

type ResendAttachment = { id: string; filename?: string; content_type?: string; size?: number; download_url?: string };

async function listAttachments(emailId: string): Promise<ResendAttachment[]> {
  const res = await fetch(`${RESEND_API}/emails/receiving/${encodeURIComponent(emailId)}/attachments`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Resend attachments ${res.status}`);
  const body = (await res.json()) as { data?: ResendAttachment[] } | ResendAttachment[];
  return Array.isArray(body) ? body : (body.data ?? []);
}

export type InboxOutcome =
  | { status: "ignored"; reason: string }
  | { status: "stored"; organizationId: string; items: number; skipped: string[] };

/** Handles one `email.received` event. Idempotent per email and file. */
export async function receiveInboundEmail(email: ReceivedEmail): Promise<InboxOutcome> {
  const domain = inboxDomain();
  if (!domain) return { status: "ignored", reason: "inbox not configured" };
  const token = tokenFromRecipients(email.to ?? [], domain);
  if (!token) return { status: "ignored", reason: "no inbox address among recipients" };
  const org = await prisma.organization.findUnique({ where: { billInboxToken: token }, select: { id: true } });
  if (!org) return { status: "ignored", reason: "unknown inbox" };

  const sender = emailOf(email.from ?? "");
  const member = sender
    ? await prisma.organizationMembership.findFirst({
        where: { organizationId: org.id, terminatedAt: null, role: { in: INBOX_SENDER_ROLES }, user: { email: { equals: sender, mode: "insensitive" } } },
        select: { userId: true },
      })
    : null;
  if (!member) {
    await writeAuditLog({
      organizationId: org.id,
      action: "evidence.inbox_rejected",
      resourceType: "organization",
      resourceId: org.id,
      metadata: { from: sender ?? "unknown", reason: "sender is not a member who can add records" },
    });
    return { status: "ignored", reason: "sender not allowed" };
  }

  const skipped: string[] = [];
  let items = 0;
  const attachments = (await listAttachments(email.email_id)).slice(0, MAX_ATTACHMENTS);
  for (const att of attachments) {
    const name = (att.filename ?? "attachment").slice(0, 200);
    const type = (att.content_type ?? "").toLowerCase();
    if (!READABLE_BILL_TYPES.has(type)) {
      skipped.push(`${name}: not a PDF or photo`);
      continue;
    }
    if ((att.size ?? 0) > MAX_INBOX_FILE_BYTES) {
      skipped.push(`${name}: over 10 MB`);
      continue;
    }
    if (!att.download_url) {
      skipped.push(`${name}: no download link`);
      continue;
    }
    const file = await fetch(att.download_url);
    if (!file.ok) throw new Error(`Attachment download ${file.status}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_INBOX_FILE_BYTES) {
      skipped.push(`${name}: over 10 MB`);
      continue;
    }
    const stored = await storeEvidenceFile(org.id, member.userId, { name, type, buffer });
    await prisma.billInboxItem.upsert({
      where: { organizationId_emailId_evidenceFileId: { organizationId: org.id, emailId: email.email_id, evidenceFileId: stored.id } },
      create: {
        organizationId: org.id,
        evidenceFileId: stored.id,
        emailId: email.email_id,
        fromAddress: sender!,
        senderUserId: member.userId,
        subject: email.subject?.slice(0, 300) ?? null,
      },
      update: {},
    });
    items++;
  }
  await writeAuditLog({
    organizationId: org.id,
    actorUserId: member.userId,
    action: "evidence.uploaded",
    resourceType: "organization",
    resourceId: org.id,
    metadata: { use: "bill_inbox", emailId: email.email_id, files: items, skipped },
  });
  return { status: "stored", organizationId: org.id, items, skipped };
}
