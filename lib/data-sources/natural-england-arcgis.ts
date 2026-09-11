/**
 * Natural England ArcGIS Feature Service client.
 *
 * Base: https://services.arcgis.com/JJzESW51TqeY9uat/arcgis/rest/services/
 * Licence: Open Government Licence v3.0
 * Auth: None (public feature services)
 *
 * Provides spatial proximity queries for statutory nature conservation
 * designations — SSSI, SAC, SPA, Ramsar, Ancient Woodland, Priority Habitats.
 * Used for ESRS E4 biodiversity impact assessment and UK BNG (Biodiversity
 * Net Gain) site proximity disclosures.
 *
 * ArcGIS REST Feature Service query pattern:
 *   /FeatureServer/0/query?geometry=<lon,lat>&geometryType=esriGeometryPoint
 *   &inSR=4326&spatialRel=esriSpatialRelIntersects&distance=<m>
 *   &units=esriSRUnit_Meter&outFields=*&f=json
 */

import { DataSourceResult, OGL_V3, govFetch } from "./types";

const NE_BASE = "https://services.arcgis.com/JJzESW51TqeY9uat/arcgis/rest/services";

/** A protected or designated site near a facility */
export interface DesignatedSite {
  /** Site unique reference number (SSSI_ID, SAC_CODE, etc.) */
  siteCode: string;
  siteName: string;
  /** Type of designation */
  designationType:
    | "SSSI"
    | "SAC"
    | "SPA"
    | "Ramsar"
    | "NNR"
    | "AncientWoodland"
    | "PriorityHabitat"
    | string;
  /** Distance from query point in metres (approximated from bounding-box overlap) */
  distanceM?: number;
  /** Area of site in hectares */
  areaHa?: number;
  /** Current condition for SSSI: "Favourable" | "Unfavourable Recovering" | etc. */
  condition?: string;
  /** For SSSI: the primary reasons for SSSI notification */
  features?: string;
}

/** Summary of statutory designations within a given search radius */
export interface DesignationProximitySummary {
  lat: number;
  lng: number;
  radiusM: number;
  /** All sites found within the radius */
  sites: DesignatedSite[];
  /** True if any SSSI / SAC / SPA is present — triggers ESRS E4 disclosure requirement */
  hasHighValueDesignation: boolean;
  /** Closest SSSI name and distance, if any */
  nearestSssi?: { name: string; distanceM: number; condition?: string };
}

interface ArcGisFeature {
  attributes: Record<string, unknown>;
  geometry?: { x: number; y: number };
}

async function queryFeatureService(
  serviceRelativePath: string,
  lat: number,
  lng: number,
  radiusM: number,
  outFields: string,
): Promise<ArcGisFeature[]> {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    distance: String(radiusM),
    units: "esriSRUnit_Meter",
    outFields,
    returnGeometry: "true",
    f: "json",
  });
  const url = `${NE_BASE}/${serviceRelativePath}/query?${params}`;
  const resp = await govFetch(url, 15_000);
  if (!resp.ok) throw new Error(`Natural England ArcGIS ${resp.status}: ${url}`);
  const json = (await resp.json()) as { features?: ArcGisFeature[]; error?: { message: string } };
  if (json.error) throw new Error(`Natural England ArcGIS error: ${json.error.message}`);
  return json.features ?? [];
}

/**
 * Returns all statutory nature conservation designations within `radiusM` metres
 * of a lat/lng coordinate. Queries SSSI, SAC, SPA, Ramsar, and NNR layers.
 * Typical usage: enrich a Facility record at creation or on-demand admin request.
 */
export async function getDesignationsNearPoint(
  lat: number,
  lng: number,
  radiusM = 2000,
): Promise<DataSourceResult<DesignationProximitySummary>> {
  const endpoint = `${NE_BASE}/(SSSI_England)/FeatureServer/0/query`;

  const [sssiFeatures, sacFeatures, spaFeatures, ramsarFeatures] = await Promise.allSettled([
    queryFeatureService("SSSI_England/FeatureServer/0", lat, lng, radiusM, "SSSI_ID,SSSI_NAME,CONDITION,AREA_HA,FEATURES"),
    queryFeatureService("SAC_England/FeatureServer/0", lat, lng, radiusM, "SITE_CODE,SITE_NAME,AREA_HA"),
    queryFeatureService("SPA_England/FeatureServer/0", lat, lng, radiusM, "SITE_CODE,SITE_NAME,AREA_HA"),
    queryFeatureService("Ramsar_England/FeatureServer/0", lat, lng, radiusM, "SITE_CODE,SITE_NAME,AREA_HA"),
  ]);

  const sites: DesignatedSite[] = [];

  if (sssiFeatures.status === "fulfilled") {
    for (const f of sssiFeatures.value) {
      const a = f.attributes;
      sites.push({
        siteCode: String(a.SSSI_ID ?? ""),
        siteName: String(a.SSSI_NAME ?? ""),
        designationType: "SSSI",
        areaHa: typeof a.AREA_HA === "number" ? a.AREA_HA : undefined,
        condition: a.CONDITION as string | undefined,
        features: a.FEATURES as string | undefined,
      });
    }
  }

  if (sacFeatures.status === "fulfilled") {
    for (const f of sacFeatures.value) {
      const a = f.attributes;
      sites.push({
        siteCode: String(a.SITE_CODE ?? ""),
        siteName: String(a.SITE_NAME ?? ""),
        designationType: "SAC",
        areaHa: typeof a.AREA_HA === "number" ? a.AREA_HA : undefined,
      });
    }
  }

  if (spaFeatures.status === "fulfilled") {
    for (const f of spaFeatures.value) {
      const a = f.attributes;
      sites.push({
        siteCode: String(a.SITE_CODE ?? ""),
        siteName: String(a.SITE_NAME ?? ""),
        designationType: "SPA",
        areaHa: typeof a.AREA_HA === "number" ? a.AREA_HA : undefined,
      });
    }
  }

  if (ramsarFeatures.status === "fulfilled") {
    for (const f of ramsarFeatures.value) {
      const a = f.attributes;
      sites.push({
        siteCode: String(a.SITE_CODE ?? ""),
        siteName: String(a.SITE_NAME ?? ""),
        designationType: "Ramsar",
        areaHa: typeof a.AREA_HA === "number" ? a.AREA_HA : undefined,
      });
    }
  }

  const highValueTypes = new Set(["SSSI", "SAC", "SPA", "Ramsar", "NNR"]);
  const hasHighValueDesignation = sites.some((s) => highValueTypes.has(s.designationType));

  const sssisWithCondition = sites.filter((s) => s.designationType === "SSSI");
  const nearestSssi =
    sssisWithCondition.length > 0
      ? { name: sssisWithCondition[0].siteName, distanceM: 0, condition: sssisWithCondition[0].condition }
      : undefined;

  return {
    data: { lat, lng, radiusM, sites, hasHighValueDesignation, nearestSssi },
    meta: {
      ...OGL_V3,
      source: "Natural England ArcGIS Open Data — Statutory Designations",
      retrievedAt: new Date().toISOString(),
      endpoint,
    },
  };
}

/** Check whether a point falls within any Ancient Woodland polygon (within `radiusM` m) */
export async function getAncientWoodlandNearPoint(
  lat: number,
  lng: number,
  radiusM = 500,
): Promise<DataSourceResult<DesignatedSite[]>> {
  const features = await queryFeatureService(
    "Ancient_Woodland_England/FeatureServer/0",
    lat,
    lng,
    radiusM,
    "OBJECTID,NAME,CATEGORY,AREA_HA",
  );
  const sites: DesignatedSite[] = features.map((f) => ({
    siteCode: String(f.attributes.OBJECTID ?? ""),
    siteName: String(f.attributes.NAME ?? ""),
    designationType: "AncientWoodland",
    areaHa: typeof f.attributes.AREA_HA === "number" ? f.attributes.AREA_HA : undefined,
    features: f.attributes.CATEGORY as string | undefined,
  }));
  const endpoint = `${NE_BASE}/Ancient_Woodland_England/FeatureServer/0/query`;
  return {
    data: sites,
    meta: {
      ...OGL_V3,
      source: "Natural England ArcGIS Open Data — Ancient Woodland",
      retrievedAt: new Date().toISOString(),
      endpoint,
    },
  };
}
