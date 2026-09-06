// ghg-calculator HTTP client wrapper
// Communicates with ghg-calculator FastMCP service for calculation & factor lookup
// Fallback: if unavailable, uses current MetricOra engine

export type GhgCalculatorConfig = {
  apiUrl: string;
  timeout?: number;
  enabled?: boolean;
};

export type CalculateRequest = {
  amount: number;
  unit: string;
  scope: 'scope1' | 'scope2' | 'scope3';
  category: string; // e.g., "stationary_fuel", "electricity", "purchased_goods"
  activityType?: string; // e.g., "diesel", "natural_gas", "location_based"
  geography?: {
    country?: string;
    region?: string;
  };
  date: string; // ISO 8601
};

export type GasBreakdown = {
  co2?: number | null;
  ch4?: number | null;
  n2o?: number | null;
  co2e?: number | null;
};

export type CalculateResponse = {
  totalCo2e: number;
  gases: GasBreakdown;
  factorId: string; // Track which factor was used
  factorLibraryVersion: string; // e.g., "DEFRA_2025.1"
  formula: string; // Audit trail
  warnings?: string[];
};

export type FactorQuery = {
  scope: 'scope1' | 'scope2' | 'scope3';
  category: string;
  activityType?: string;
  geography?: {
    country?: string;
    region?: string;
  };
  date?: string; // ISO 8601; defaults to today
};

export type FactorInfo = {
  id: string;
  externalId?: string;
  scope: string;
  category: string;
  activityType?: string;
  inputUnit: string;
  gases: GasBreakdown;
  geography?: {
    country?: string;
    region?: string;
  };
  libraryVersion: string;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
};

export type FactorsResponse = {
  factors: FactorInfo[];
  totalCount: number;
};

export class GhgCalculatorClient {
  private apiUrl: string;
  private timeout: number;
  private enabled: boolean;

  constructor(config: GhgCalculatorConfig) {
    this.apiUrl = config.apiUrl;
    this.timeout = config.timeout ?? 10000;
    this.enabled = config.enabled ?? true;
  }

  async calculate(req: CalculateRequest): Promise<CalculateResponse> {
    if (!this.enabled) {
      throw new Error('ghg-calculator is disabled');
    }

    const response = await fetch(`${this.apiUrl}/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`ghg-calculator: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as CalculateResponse;
  }

  async getFactors(query: FactorQuery): Promise<FactorsResponse> {
    if (!this.enabled) {
      throw new Error('ghg-calculator is disabled');
    }

    const params = new URLSearchParams();
    params.append('scope', query.scope);
    params.append('category', query.category);
    if (query.activityType) params.append('activity_type', query.activityType);
    if (query.geography?.country) params.append('country', query.geography.country);
    if (query.geography?.region) params.append('region', query.geography.region);
    if (query.date) params.append('date', query.date);

    const response = await fetch(`${this.apiUrl}/factors?${params}`, {
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`ghg-calculator: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as FactorsResponse;
  }

  async getLibraryInfo(): Promise<{ version: string; factorCount: number; sources: string[] }> {
    if (!this.enabled) {
      throw new Error('ghg-calculator is disabled');
    }

    const response = await fetch(`${this.apiUrl}/info`, {
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`ghg-calculator: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as { version: string; factorCount: number; sources: string[] };
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export function createGhgCalculatorClient(): GhgCalculatorClient | null {
  const apiUrl = process.env.GHG_CALCULATOR_API_URL;
  if (!apiUrl) return null;

  return new GhgCalculatorClient({
    apiUrl,
    enabled: true,
  });
}

export const ghgCalculatorClient = createGhgCalculatorClient();
