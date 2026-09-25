import { z } from "zod";

/**
 * Where a trial came from, carried in the URL only: the marketing site adds
 * these query parameters to internal links and the sign-up form sends them
 * with the new organisation. Nothing is stored in the browser (the cookie
 * policy promises no tracking cookies).
 */
export const ACQUISITION_PARAMS = ["ref", "utm_source", "utm_medium", "utm_campaign"] as const;

const token = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{1,60}$/);

export const acquisitionSchema = z.object({
  source: token,
  medium: token.optional(),
  campaign: token.optional(),
});
export type Acquisition = z.infer<typeof acquisitionSchema>;

const clean = (v: string | null | undefined) => {
  const r = token.safeParse(v ?? "");
  return r.success ? r.data : undefined;
};

/** Host of an external referrer, without "www.", or undefined. */
export function referrerSource(referrer: string, ownHost: string): string | undefined {
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (!host || host === ownHost.replace(/^www\./, "")) return undefined;
    return clean(host);
  } catch {
    return undefined;
  }
}

/** Reads ?ref / utm_* (ref wins over utm_source); falls back to the referrer host. */
export function acquisitionFromParams(params: URLSearchParams, referrerHost?: string): Acquisition | null {
  const source = clean(params.get("ref")) ?? clean(params.get("utm_source")) ?? referrerHost;
  if (!source) return null;
  return { source, medium: clean(params.get("utm_medium")), campaign: clean(params.get("utm_campaign")) };
}

/** The query parameters that carry an acquisition to the next page. */
export function acquisitionQuery(a: Acquisition): URLSearchParams {
  const q = new URLSearchParams({ ref: a.source });
  if (a.medium) q.set("utm_medium", a.medium);
  if (a.campaign) q.set("utm_campaign", a.campaign);
  return q;
}

/** Adds the acquisition parameters to an internal href that has none of them. */
export function withAcquisition(href: string, a: Acquisition): string {
  const [path, hash = ""] = href.split("#", 2);
  const [base, search = ""] = path.split("?", 2);
  const q = new URLSearchParams(search);
  if (ACQUISITION_PARAMS.some((p) => q.has(p))) return href;
  for (const [k, v] of acquisitionQuery(a)) q.set(k, v);
  return `${base}?${q.toString()}${hash ? `#${hash}` : ""}`;
}
