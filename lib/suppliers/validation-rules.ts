// Scope 3 category-specific validation rules
// Defines expected units, acceptable ranges, and guidance for each category

export interface CategoryRule {
  categoryCode: string;
  categoryName: string;
  expectedUnits: string[];
  description: string;
  examples: string[];
  acceptableRangeMultiplier?: number; // How many times the median is acceptable (e.g., 1.5x)
}

export const CATEGORY_RULES: Record<string, CategoryRule> = {
  's3-business-travel': {
    categoryCode: 's3-business-travel',
    categoryName: 'Business Travel',
    expectedUnits: ['km', 'mile', 'GBP', 'USD'],
    description:
      'Total distance travelled or spend on flights, trains, hotels, and taxis for business purposes.',
    examples: [
      '45,000 km (annual employee flights + trains)',
      '£125,000 (annual travel and accommodation spend)',
      'Mix: 12,500 km flights + £8,500 hotels',
    ],
    acceptableRangeMultiplier: 2.5,
  },

  's3-purchased-goods': {
    categoryCode: 's3-purchased-goods',
    categoryName: 'Purchased Goods',
    expectedUnits: ['kg', 'tonne', 'GBP', 'USD'],
    description:
      'Annual spend on goods and services purchased, or weight of materials/goods acquired.',
    examples: [
      '£2,500,000 (annual procurement spend)',
      '850 tonne (materials purchased)',
      'Software licenses, office supplies, inventory',
    ],
    acceptableRangeMultiplier: 3,
  },

  's3-upstream-transport': {
    categoryCode: 's3-upstream-transport',
    categoryName: 'Upstream Transport',
    expectedUnits: ['km', 'tonne-km', 'GBP', 'USD'],
    description:
      'Weight × distance (tonne-km) or spend on third-party logistics and freight services.',
    examples: [
      '180,000 tonne-km (inbound materials)',
      '95,000 vehicle-km (supplier deliveries)',
      '£45,000 (logistics outsourced spend)',
    ],
    acceptableRangeMultiplier: 2.5,
  },

  's3-commuting': {
    categoryCode: 's3-commuting',
    categoryName: 'Employee Commuting',
    expectedUnits: ['km', 'mile', 'GBP', 'USD'],
    description:
      'Estimated total distance travelled by employees commuting to work, or modal split percentages.',
    examples: [
      '320,000 km (estimated annual employee commutes)',
      '60% car, 30% public transport, 10% walk/cycle',
      '1,200 employees × 25 km average commute',
    ],
    acceptableRangeMultiplier: 2,
  },

  's3-waste-disposal': {
    categoryCode: 's3-waste-disposal',
    categoryName: 'Waste Disposal',
    expectedUnits: ['kg', 'tonne', 'GBP', 'USD'],
    description: 'Weight of waste sent to landfill, incineration, or recycling facilities.',
    examples: [
      '2,500 tonne (annual waste to landfill)',
      '1,200 tonne (recycled materials)',
      '£85,000 (waste management services)',
    ],
    acceptableRangeMultiplier: 2.5,
  },

  's1-stationary': {
    categoryCode: 's1-stationary',
    categoryName: 'Stationary Combustion',
    expectedUnits: ['kWh', 'MWh', 'litre', 'kg', 'tonne', 'GBP', 'USD'],
    description:
      'Fuel burned on-site for heating, power generation, or processing. Includes natural gas, diesel, oil.',
    examples: [
      '125,000 kWh (annual site gas consumption)',
      '850 litre (diesel for backup generators)',
      '42 tonne (coal for industrial kiln)',
    ],
    acceptableRangeMultiplier: 2,
  },

  's1-mobile': {
    categoryCode: 's1-mobile',
    categoryName: 'Mobile Combustion',
    expectedUnits: ['litre', 'kg', 'tonne', 'GBP', 'USD', 'mile', 'km'],
    description:
      'Fuel burned in owned or leased vehicles (cars, vans, trucks). Includes petrol, diesel, LPG.',
    examples: [
      '45,000 litre (annual fleet diesel consumption)',
      '12,500 km (vehicle mileage)',
      '£125,000 (fuel purchased for company vehicles)',
    ],
    acceptableRangeMultiplier: 2,
  },

  's2-electricity-lb': {
    categoryCode: 's2-electricity-lb',
    categoryName: 'Electricity (Location-Based)',
    expectedUnits: ['kWh', 'MWh', 'GBP', 'USD'],
    description:
      'Purchased electricity from the grid, calculated using location-based grid carbon intensity.',
    examples: [
      '450,000 kWh (annual office electricity)',
      '1,250 MWh (annual factory consumption)',
      '£85,000 (electricity bills)',
    ],
    acceptableRangeMultiplier: 1.5,
  },

  's2-electricity-mb': {
    categoryCode: 's2-electricity-mb',
    categoryName: 'Electricity (Market-Based)',
    expectedUnits: ['kWh', 'MWh', 'GBP', 'USD'],
    description:
      'Purchased electricity from the grid, calculated using market-based carbon intensity (contracts or tariffs).',
    examples: [
      '450,000 kWh (annual renewable tariff)',
      '1,250 MWh (PPA certificate-backed)',
      '£125,000 (green electricity contracts)',
    ],
    acceptableRangeMultiplier: 1.5,
  },
};

export function getCategoryRule(categoryCode: string): CategoryRule | null {
  return CATEGORY_RULES[categoryCode] || null;
}

export function getExpectedUnits(categoryCode: string): string[] {
  return getCategoryRule(categoryCode)?.expectedUnits || [];
}

export function getCategoryDescription(categoryCode: string): string {
  const rule = getCategoryRule(categoryCode);
  if (!rule) return 'Unknown category';
  return `${rule.categoryName}: ${rule.description}`;
}

export function getAcceptableRangeMultiplier(categoryCode: string): number {
  return getCategoryRule(categoryCode)?.acceptableRangeMultiplier || 2;
}
