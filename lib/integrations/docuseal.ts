/**
 * DocuSeal API client — digital signatures for audit report packages.
 *
 * Env vars required (production only — skip in development):
 *   DOCUSEAL_API_KEY   — API key from DocuSeal account settings
 *   DOCUSEAL_BASE_URL  — e.g. https://api.docuseal.com  (or self-hosted URL)
 *
 * DocuSeal docs: https://www.docuseal.com/docs/api
 */

const BASE_URL = process.env.DOCUSEAL_BASE_URL ?? "https://api.docuseal.com";
const API_KEY = process.env.DOCUSEAL_API_KEY ?? "";

function headers() {
  return {
    "X-Auth-Token": API_KEY,
    "Content-Type": "application/json",
  };
}

export class DocuSealError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "DocuSealError";
  }
}

async function request<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
): Promise<T> {
  if (!API_KEY) {
    throw new DocuSealError("DOCUSEAL_API_KEY is not configured", 0, null);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new DocuSealError(
      `DocuSeal ${method} ${path} failed: ${res.status}`,
      res.status,
      json,
    );
  }

  return json as T;
}

export interface DocuSealSubmitter {
  email: string;
  name: string;
  role?: string;
}

export interface CreateSubmissionParams {
  /** DocuSeal template ID for audit report sign-off. */
  templateId: number;
  submitters: DocuSealSubmitter[];
  /** Pre-filled field values keyed by field name. */
  fields?: Record<string, string>;
  /** Redirect URL after signing. */
  completedRedirectUrl?: string;
}

export interface DocuSealSubmission {
  id: number;
  status: "pending" | "completed" | "declined" | "expired";
  submitters: Array<{
    id: number;
    email: string;
    name: string;
    status: "pending" | "opened" | "completed" | "declined";
    embed_src?: string;
    completed_at?: string;
  }>;
  created_at: string;
  updated_at: string;
}

/**
 * Create a DocuSeal submission (triggers email to each submitter).
 * Returns the submission including per-submitter embed URLs for inline signing.
 */
export async function createSubmission(
  params: CreateSubmissionParams,
): Promise<DocuSealSubmission> {
  const payload: Record<string, unknown> = {
    template_id: params.templateId,
    submitters: params.submitters.map((s) => ({
      email: s.email,
      name: s.name,
      role: s.role ?? "Signatory",
    })),
  };

  if (params.fields) {
    payload.fields = Object.entries(params.fields).map(([name, value]) => ({
      name,
      default_value: value,
    }));
  }

  if (params.completedRedirectUrl) {
    payload.completed_redirect_url = params.completedRedirectUrl;
  }

  return request<DocuSealSubmission>("POST", "/submissions", payload);
}

/**
 * Fetch the current state of a submission.
 */
export async function getSubmission(submissionId: number): Promise<DocuSealSubmission> {
  return request<DocuSealSubmission>("GET", `/submissions/${submissionId}`);
}

/**
 * Void / archive a submission (e.g. when a report is superseded).
 * DocuSeal uses DELETE to archive submissions.
 */
export async function archiveSubmission(submissionId: number): Promise<void> {
  if (!API_KEY) {
    throw new DocuSealError("DOCUSEAL_API_KEY is not configured", 0, null);
  }

  const res = await fetch(`${BASE_URL}/submissions/${submissionId}`, {
    method: "DELETE",
    headers: headers(),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new DocuSealError(
      `DocuSeal DELETE /submissions/${submissionId} failed: ${res.status}`,
      res.status,
      json,
    );
  }
}

/**
 * Verify a DocuSeal webhook signature.
 *
 * DocuSeal signs webhook payloads with HMAC-SHA256 using DOCUSEAL_WEBHOOK_SECRET.
 * Signature is in the X-DocuSeal-Signature header as a hex digest.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): Promise<boolean> {
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET;
  if (!secret) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expected === signature.toLowerCase();
}
