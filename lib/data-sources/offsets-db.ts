/**
 * OffsetsDB API client.
 *
 * Base: https://offsets-db-api.onrender.com
 * Docs: https://offsets-db-data.readthedocs.io
 * Licence: free, no auth, no API key required.
 * Coverage: Verra VCS, Gold Standard, ACR, CAR, ART/TREES retirement records.
 *
 * Used to verify carbon offset retirement certificates against live registry data.
 */

import { DataSourceError } from "./types";

const BASE = "https://offsets-db-api.onrender.com";
const TIMEOUT_MS = 15_000; // cold starts on Render free tier can be slow

export interface OffsetsDbProject {
  project_id: string;
  name: string;
  registry: string; // "Verra" | "Gold Standard" | "ACR" | "CAR" | "ART/TREES"
  protocol: string | null;
  country: string | null;
  project_type: string | null;
  status: string | null;
  /** Total credits issued */
  issued: number | null;
  /** Total credits retired */
  retired: number | null;
}

export interface OffsetsDbCredit {
  project_id: string;
  registry: string;
  vintage_year: number | null;
  transaction_date: string | null;
  transaction_type: string; // "issuance" | "retirement" | "cancellation"
  quantity: number;
  serial_numbers: string | null;
  retirement_reason: string | null;
  retirement_beneficiary: string | null;
}

export interface RetirementVerification {
  verified: boolean;
  projectId: string | null;
  registry: string | null;
  projectName: string | null;
  retirementDate: string | null;
  quantity: number | null;
  serialMatch: boolean;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search for a project by name or ID across all registries.
 */
export async function searchProjects(query: string): Promise<OffsetsDbProject[]> {
  const url = `${BASE}/projects?search=${encodeURIComponent(query)}&limit=10`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new DataSourceError("offsets-db", res.status, await res.text().catch(() => ""));
  const data = (await res.json()) as { data: OffsetsDbProject[] };
  return data.data ?? [];
}

/**
 * Get a project by its registry-specific ID.
 */
export async function getProject(projectId: string, registry: string): Promise<OffsetsDbProject | null> {
  const url = `${BASE}/projects/${encodeURIComponent(registry)}/${encodeURIComponent(projectId)}`;
  const res = await fetchWithTimeout(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new DataSourceError("offsets-db", res.status, await res.text().catch(() => ""));
  return (await res.json()) as OffsetsDbProject;
}

/**
 * Verify a retirement certificate. Returns verification result including
 * whether serial numbers match any recorded retirement transaction.
 */
export async function verifyRetirement(params: {
  projectId: string;
  registry?: string;
  serialNumbers?: string;
  expectedQuantity?: number;
}): Promise<RetirementVerification> {
  const registries = ["Verra", "Gold Standard", "ACR", "CAR", "ART/TREES"];
  const targetRegistries = params.registry ? [params.registry] : registries;

  for (const registry of targetRegistries) {
    try {
      const url = `${BASE}/credits?project_id=${encodeURIComponent(params.projectId)}&registry=${encodeURIComponent(registry)}&transaction_type=retirement&limit=50`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) continue;

      const data = (await res.json()) as { data: OffsetsDbCredit[] };
      const retirements = data.data ?? [];

      if (retirements.length === 0) continue;

      // Check if any retirement matches the serial numbers
      let serialMatch = false;
      if (params.serialNumbers) {
        const cleanSerial = params.serialNumbers.replace(/\s/g, "").toLowerCase();
        serialMatch = retirements.some((r) =>
          r.serial_numbers?.replace(/\s/g, "").toLowerCase().includes(cleanSerial)
        );
      }

      const project = await getProject(params.projectId, registry);

      return {
        verified: true,
        projectId: params.projectId,
        registry,
        projectName: project?.name ?? null,
        retirementDate: retirements[0]?.transaction_date ?? null,
        quantity: retirements.reduce((sum, r) => sum + r.quantity, 0),
        serialMatch: params.serialNumbers ? serialMatch : true,
      };
    } catch {
      continue;
    }
  }

  return {
    verified: false,
    projectId: params.projectId,
    registry: params.registry ?? null,
    projectName: null,
    retirementDate: null,
    quantity: null,
    serialMatch: false,
  };
}
