/**
 * EA Catchment Planning / Water Framework Directive API client.
 *
 * Base: https://environment.data.gov.uk/catchment-planning/
 * Licence: Open Government Licence v3.0
 * Auth: None
 *
 * Provides Water Framework Directive (WFD) water body classification and
 * River Basin Management Plan data. Used for ESRS E3 water body ecological
 * status disclosures and water-stress context.
 */

import { DataSourceResult, OGL_V3, govFetch } from "./types";

const BASE = "https://environment.data.gov.uk/catchment-planning";

/** WFD ecological/chemical status classifications */
export type WfdStatus = "High" | "Good" | "Moderate" | "Poor" | "Bad" | "Does not require classification" | string;

export interface WaterBody {
  id: string;
  name: string;
  type: "River" | "Lake" | "Transitional" | "Coastal" | "Groundwater" | string;
  /** WFD ecological status for the current cycle */
  currentEcologicalStatus?: WfdStatus;
  currentChemicalStatus?: string;
  /** WFD objective — status the body should achieve */
  objectiveEcological?: WfdStatus;
  objectiveChemical?: string;
  /** Target year for achieving the objective */
  targetYear?: number;
  /** River Basin District this water body falls within */
  riverBasinDistrict?: string;
  catchmentName?: string;
  operationalCatchment?: string;
}

export interface ManagementCatchment {
  id: string;
  name: string;
  riverBasinDistrict: string;
  waterBodies: string[];
}

/** Fetch the WFD water body that contains a given point (nearest match) */
export async function getWaterBodyAtPoint(
  lat: number,
  lng: number,
): Promise<DataSourceResult<WaterBody | null>> {
  // The catchment planning API exposes water bodies as Linked Data.
  // We query operational catchments spatially first, then get the water body.
  const url = `${BASE}/OperationalCatchment.json?lat=${lat}&long=${lng}&dist=5`;
  const resp = await govFetch(url);

  if (!resp.ok && resp.status !== 404) {
    throw new Error(`EA Catchment Planning API ${resp.status}: ${url}`);
  }

  if (resp.status === 404 || !resp.ok) {
    return {
      data: null,
      meta: {
        ...OGL_V3,
        source: "EA Catchment Planning API (WFD)",
        retrievedAt: new Date().toISOString(),
        endpoint: url,
      },
    };
  }

  const json = (await resp.json()) as {
    items?: Array<{
      id?: string;
      notation?: string;
      label?: string;
      riverBasinDistrict?: { label?: string };
      managementCatchment?: { label?: string };
      waterBodies?: Array<{
        id?: string;
        notation?: string;
        label?: string;
        type?: string;
        currentEcologicalStatus?: { label?: string };
        currentChemicalStatus?: { label?: string };
        environmentalObjectiveEcological?: { label?: string };
        environmentalObjectiveChemical?: { label?: string };
        targetDate?: string;
      }>;
    }>;
  };

  const catchment = json.items?.[0];
  if (!catchment) {
    return {
      data: null,
      meta: {
        ...OGL_V3,
        source: "EA Catchment Planning API (WFD)",
        retrievedAt: new Date().toISOString(),
        endpoint: url,
      },
    };
  }

  const wbRaw = catchment.waterBodies?.[0];
  const waterBody: WaterBody | null = wbRaw
    ? {
        id: String(wbRaw.notation ?? wbRaw.id ?? ""),
        name: String(wbRaw.label ?? ""),
        type: String(wbRaw.type ?? ""),
        currentEcologicalStatus: wbRaw.currentEcologicalStatus?.label,
        currentChemicalStatus: wbRaw.currentChemicalStatus?.label,
        objectiveEcological: wbRaw.environmentalObjectiveEcological?.label,
        objectiveChemical: wbRaw.environmentalObjectiveChemical?.label,
        targetYear: wbRaw.targetDate ? parseInt(wbRaw.targetDate, 10) : undefined,
        riverBasinDistrict: catchment.riverBasinDistrict?.label,
        catchmentName: catchment.managementCatchment?.label,
        operationalCatchment: catchment.label,
      }
    : null;

  return {
    data: waterBody,
    meta: {
      ...OGL_V3,
      source: "EA Catchment Planning API (WFD)",
      retrievedAt: new Date().toISOString(),
      endpoint: url,
    },
  };
}

/** Fetch a specific water body by its WFD notation code */
export async function getWaterBodyById(
  wbId: string,
): Promise<DataSourceResult<WaterBody | null>> {
  const url = `${BASE}/WaterBody/${encodeURIComponent(wbId)}.json`;
  const resp = await govFetch(url);
  if (resp.status === 404) {
    return {
      data: null,
      meta: {
        ...OGL_V3,
        source: "EA Catchment Planning API (WFD)",
        retrievedAt: new Date().toISOString(),
        endpoint: url,
      },
    };
  }
  if (!resp.ok) throw new Error(`EA Catchment Planning API ${resp.status}: ${url}`);

  const json = (await resp.json()) as Record<string, unknown>;
  const waterBody: WaterBody = {
    id: wbId,
    name: String(json.label ?? ""),
    type: String(json.type ?? ""),
    currentEcologicalStatus:
      (json.currentEcologicalStatus as { label?: string } | undefined)?.label,
    currentChemicalStatus:
      (json.currentChemicalStatus as { label?: string } | undefined)?.label,
    riverBasinDistrict:
      (json.riverBasinDistrict as { label?: string } | undefined)?.label,
  };

  return {
    data: waterBody,
    meta: {
      ...OGL_V3,
      source: "EA Catchment Planning API (WFD)",
      retrievedAt: new Date().toISOString(),
      endpoint: url,
    },
  };
}
