/**
 * EA Environmental Permitting Public Register client.
 *
 * Base: https://environment.data.gov.uk/public-register/
 * Licence: Open Government Licence v3.0
 * Auth: None (read-only public access)
 *
 * Retrieves live permit details from the EA Public Register to enrich
 * EnvironmentalPermit records and surface permit conditions for the
 * compliance module (ESRS E3, E5 permit linkage).
 */

import { DataSourceResult, OGL_V3, govFetch } from "./types";

const BASE = "https://environment.data.gov.uk/public-register";

export interface EaPermitDetails {
  /** EA permit application number / reference, e.g. "EPR/AB1234CD/A001" */
  permitNumber: string;
  permitType?: string;
  status?: string;
  /** Permit holder legal name */
  holderName?: string;
  /** Site/installation name */
  siteName?: string;
  siteAddress?: string;
  sitePostcode?: string;
  lat?: number;
  lng?: number;
  issuedDate?: string;
  expiryDate?: string;
  /** Applicable regulatory regime (IED, WFD, etc.) */
  regime?: string;
  /** Link to the full permit document on GOV.UK */
  documentUrl?: string;
}

export interface EaPermitEnforcementHistory {
  permitNumber: string;
  actions: Array<{
    type: string;
    date: string;
    description: string;
  }>;
}

export interface EaWasteExemption {
  exemptionReference: string;
  description: string;
  operatorName: string;
  siteAddress?: string;
  registrationDate?: string;
  expiryDate?: string;
}

/**
 * Look up a permit by its EA reference number.
 * The EA Public Register uses the permit number as the primary key.
 */
export async function getPermitByReference(
  permitRef: string,
): Promise<DataSourceResult<EaPermitDetails | null>> {
  const url = `${BASE}/view/regulated-facility?permitRef=${encodeURIComponent(permitRef)}`;
  const resp = await govFetch(url);

  if (resp.status === 404) {
    return {
      data: null,
      meta: {
        ...OGL_V3,
        source: "EA Environmental Permitting Public Register",
        retrievedAt: new Date().toISOString(),
        endpoint: url,
      },
    };
  }
  if (!resp.ok) throw new Error(`EA Public Register ${resp.status}: ${url}`);

  const json = (await resp.json()) as {
    items?: Array<Record<string, unknown>>;
    result?: Record<string, unknown>;
  };

  const raw = json.result ?? json.items?.[0];
  if (!raw) {
    return {
      data: null,
      meta: {
        ...OGL_V3,
        source: "EA Environmental Permitting Public Register",
        retrievedAt: new Date().toISOString(),
        endpoint: url,
      },
    };
  }

  const data: EaPermitDetails = {
    permitNumber: String(raw.permitNumber ?? raw.notation ?? permitRef),
    permitType: raw.permitType as string | undefined,
    status: raw.regulatoryStatus as string | undefined,
    holderName: raw.operatorName as string | undefined,
    siteName: (raw.installationName as string | undefined) ?? (raw.siteName as string | undefined),
    siteAddress: raw.address as string | undefined,
    sitePostcode: raw.postcode as string | undefined,
    issuedDate: raw.issuedDate as string | undefined,
    expiryDate: raw.expiresDate as string | undefined,
    regime: raw.regime as string | undefined,
    documentUrl: raw.documentUrl as string | undefined,
  };

  if (typeof raw.lat === "number") data.lat = raw.lat;
  if (typeof raw.long === "number") data.lng = raw.long;

  return {
    data,
    meta: {
      ...OGL_V3,
      source: "EA Environmental Permitting Public Register",
      retrievedAt: new Date().toISOString(),
      endpoint: url,
    },
  };
}

/**
 * Search for permitted sites by operator name and/or postcode.
 * Useful for discovering permits when only the operator/address is known.
 */
export async function searchPermitsByOperator(
  operatorName?: string,
  postcode?: string,
  limitRows = 20,
): Promise<DataSourceResult<EaPermitDetails[]>> {
  const params = new URLSearchParams();
  if (operatorName) params.set("operatorName", operatorName);
  if (postcode) params.set("postcode", postcode.replace(/\s+/g, "").toUpperCase());
  params.set("_pageSize", String(limitRows));

  const url = `${BASE}/view/regulated-facility?${params}`;
  const resp = await govFetch(url);
  if (!resp.ok) throw new Error(`EA Public Register ${resp.status}: ${url}`);

  const json = (await resp.json()) as { items?: Array<Record<string, unknown>> };
  const items: EaPermitDetails[] = (json.items ?? []).map((raw) => ({
    permitNumber: String(raw.permitNumber ?? raw.notation ?? ""),
    permitType: raw.permitType as string | undefined,
    status: raw.regulatoryStatus as string | undefined,
    holderName: raw.operatorName as string | undefined,
    siteName: (raw.installationName as string | undefined) ?? (raw.siteName as string | undefined),
    siteAddress: raw.address as string | undefined,
    sitePostcode: raw.postcode as string | undefined,
    issuedDate: raw.issuedDate as string | undefined,
    expiryDate: raw.expiresDate as string | undefined,
  }));

  return {
    data: items,
    meta: {
      ...OGL_V3,
      source: "EA Environmental Permitting Public Register",
      retrievedAt: new Date().toISOString(),
      endpoint: url,
    },
  };
}

/**
 * Fetch waste carrier/broker/dealer exemptions for an organisation.
 * Relevant for ESRS E5 waste chain-of-custody documentation.
 */
export async function getWasteExemptions(
  operatorName: string,
): Promise<DataSourceResult<EaWasteExemption[]>> {
  const url = `${BASE}/view/waste-exemption?operatorName=${encodeURIComponent(operatorName)}`;
  const resp = await govFetch(url);
  if (!resp.ok) throw new Error(`EA Public Register ${resp.status}: ${url}`);

  const json = (await resp.json()) as { items?: Array<Record<string, unknown>> };
  const items: EaWasteExemption[] = (json.items ?? []).map((raw) => ({
    exemptionReference: String(raw.exemptionRef ?? raw.reference ?? ""),
    description: String(raw.description ?? ""),
    operatorName: String(raw.operatorName ?? ""),
    siteAddress: raw.address as string | undefined,
    registrationDate: raw.registrationDate as string | undefined,
    expiryDate: raw.expiryDate as string | undefined,
  }));

  return {
    data: items,
    meta: {
      ...OGL_V3,
      source: "EA Environmental Permitting Public Register — Waste Exemptions",
      retrievedAt: new Date().toISOString(),
      endpoint: url,
    },
  };
}
