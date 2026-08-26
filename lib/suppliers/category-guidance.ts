export interface CategoryGuidance {
  categoryCode: string;
  categoryName: string;
  description: string;
  whatToInclude: string[];
  whatToExclude: string[];
  unitGuidance: string;
  calculationTip: string;
  commonMistakes: string[];
  resources: Array<{
    title: string;
    url: string;
  }>;
}

export const CATEGORY_GUIDANCE: Record<string, CategoryGuidance> = {
  "s3-business-travel": {
    categoryCode: "s3-business-travel",
    categoryName: "Business Travel",
    description:
      "Emissions from employee travel for business purposes, including flights, trains, hotels, and ground transportation.",
    whatToInclude: [
      "Employee flights (domestic and international)",
      "Train and coach travel",
      "Hotel accommodation nights",
      "Taxi, car rental, and rideshare for business",
      "Congresses and conference attendance",
    ],
    whatToExclude: [
      "Commuting to the office (see Employee Commuting)",
      "Personal holidays",
      "Employee relocation",
      "Moving offices or equipment",
    ],
    unitGuidance:
      "Record either total distance in km/miles OR total spend in GBP/USD. If you have both, report the distance (more accurate). For hotels, report number of nights or spend amount.",
    calculationTip:
      "For flights: use actual flight distance. For trains: use journey distance. For hotels: multiply nights × average emissions factor. If using spend: divide total budget by number of trips to estimate per-trip emissions.",
    commonMistakes: [
      "Including commuting to regular office location",
      "Double-counting flights (each leg separately is usually wrong—report round-trip distance)",
      "Using air distance instead of actual flight distance",
      "Forgetting to include ground transport (taxi to airport, etc.)",
    ],
    resources: [
      {
        title: "GHG Protocol Scope 3 Standard — Category 6",
        url: "https://ghgprotocol.org/",
      },
      {
        title: "UK Government GHG Conversion Factors — Business Travel",
        url: "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting",
      },
    ],
  },

  "s3-purchased-goods": {
    categoryCode: "s3-purchased-goods",
    categoryName: "Purchased Goods and Services",
    description:
      "Emissions from manufacturing and delivery of goods and services your organization purchases, excluding capital goods.",
    whatToInclude: [
      "Raw materials and components",
      "Finished goods for resale",
      "Office supplies (paper, pens, furniture)",
      "Software licenses and IT services",
      "Consulting and professional services",
      "Packaging materials",
    ],
    whatToExclude: [
      "Capital equipment (see Purchased Goods if capitalized)",
      "Direct energy purchases (see Scope 2)",
      "Outsourced transportation (see Upstream Transport)",
      "Employee salaries and benefits",
    ],
    unitGuidance:
      "Preferred: annual spend in GBP/USD. Alternative: weight of materials in kg or tonnes. If weight is all you have, we'll convert using average material factors.",
    calculationTip:
      "Best practice: track spending by supplier category (e.g., stationery, IT, consulting). Then apply average emission factors per £/$ spent. If weight data is available (e.g., recycled paper), use that instead—it's usually more accurate.",
    commonMistakes: [
      "Including spend on energy or utilities (separate category)",
      "Forgetting to include small recurring purchases (coffee, printing)",
      "Using gross spend instead of COGS for retail/resale goods",
      "Not adjusting for one-time large purchases (can skew averages)",
    ],
    resources: [
      {
        title: "GHG Protocol Scope 3 Standard — Category 1",
        url: "https://ghgprotocol.org/",
      },
      {
        title: "EPA Supply Chain Guidance",
        url: "https://www.epa.gov/industries/lean-supply-chain-handbook",
      },
    ],
  },

  "s3-upstream-transport": {
    categoryCode: "s3-upstream-transport",
    categoryName: "Upstream Transportation and Distribution",
    description:
      "Emissions from third-party logistics, freight, and courier services used to transport purchased goods to your facilities.",
    whatToInclude: [
      "Supplier-paid freight and logistics",
      "Third-party courier and delivery services",
      "Warehouse storage and distribution",
      "Inbound logistics from manufacturers",
      "Import and export transportation",
    ],
    whatToExclude: [
      "Transport you operate directly (see Scope 1 Mobile Combustion)",
      "Your downstream distribution to customers (Scope 3 Category 9)",
      "Employee commuting (see Employee Commuting)",
      "Business travel (see Business Travel)",
    ],
    unitGuidance:
      "Best: tonne-km (weight × distance). Alternative: total spend in GBP/USD. Alternative: vehicle-km for known routes.",
    calculationTip:
      "If you know shipment weight and distance: tonne-km is most accurate. If only spend: divide by typical cost per tonne-km in your region. If vehicle count: multiply by average annual km per vehicle.",
    commonMistakes: [
      "Including your own distribution as upstream (it's downstream)",
      "Using straight-line distance instead of actual road/route distance",
      "Forgetting to include return empty vehicle miles",
      "Double-counting if supplier already included in Purchased Goods spend",
    ],
    resources: [
      {
        title: "GHG Protocol Scope 3 Standard — Category 4",
        url: "https://ghgprotocol.org/",
      },
      {
        title: "UK Government GHG Factors — Freight Transport",
        url: "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting",
      },
    ],
  },

  "s3-commuting": {
    categoryCode: "s3-commuting",
    categoryName: "Employee Commuting",
    description: "Emissions from employee travel to and from work on a regular basis.",
    whatToInclude: [
      "Employee car commutes",
      "Public transport (bus, train, tram)",
      "Cycling and walking (zero emissions, but count trips)",
      "Company shuttles or minibuses",
      "Car-sharing and carpooling",
      "Electric vehicle charging",
    ],
    whatToExclude: [
      "Business travel (see Business Travel)",
      "One-time office relocations",
      "Field worker travel to job sites (depends—see guidance)",
      "Personal vehicle use for non-commute purposes",
    ],
    unitGuidance:
      "Best: total annual km by mode (car, public transport, etc.). Alternative: number of employees × average commute distance. Alternative: modal split percentages (60% car, 30% bus, etc.).",
    calculationTip:
      "Survey a sample of employees about commute distance and mode. Multiply by working days (typically 230/year). Use mode-specific emission factors (cars ~0.2 kg CO₂/km, bus ~0.05 kg CO₂/km).",
    commonMistakes: [
      "Using one-way distance instead of round-trip",
      "Forgetting hybrid/remote workers (0 km on days not in office)",
      "Not accounting for seasonal variation (summer holidays, winter weather)",
      "Treating all car commutes as single-occupant (carshare should be divided)",
    ],
    resources: [
      {
        title: "GHG Protocol Scope 3 Standard — Category 7",
        url: "https://ghgprotocol.org/",
      },
      {
        title: "UK Government GHG Factors — Employee Commuting",
        url: "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting",
      },
    ],
  },

  "s3-waste-disposal": {
    categoryCode: "s3-waste-disposal",
    categoryName: "Waste Disposal",
    description:
      "Emissions from treatment and disposal of waste generated by your organization, including landfill, incineration, and recycling.",
    whatToInclude: [
      "Waste sent to landfill",
      "Waste sent to incineration",
      "Recyclable materials (paper, plastic, metal)",
      "Composted organic waste",
      "Hazardous waste disposal",
      "Data center equipment recycling",
    ],
    whatToExclude: [
      "Waste generated by suppliers (included in Purchased Goods)",
      "Downstream waste from customer use (Scope 3 Category 12)",
      "Emissions from your own waste management operations (Scope 1)",
    ],
    unitGuidance: "Weight of waste in kg or tonnes. Break down by disposal method (landfill, recycled, incinerated) if possible.",
    calculationTip:
      "Best: weigh or track waste by type and disposal method. Estimate from: number of employees × waste per capita (UK average ~350 kg/person/year). Separate high-impact items (single-use plastics, electronics).",
    commonMistakes: [
      "Including weight of packaging in waste (it's part of purchased goods)",
      "Not separating recycled waste (lower emissions than landfill)",
      "Assuming all waste goes to landfill (track actual disposal routes)",
      "Forgetting construction or renovation waste (can be significant)",
    ],
    resources: [
      {
        title: "GHG Protocol Scope 3 Standard — Category 5",
        url: "https://ghgprotocol.org/",
      },
      {
        title: "UK Government GHG Factors — Waste Management",
        url: "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting",
      },
    ],
  },

  "s1-stationary": {
    categoryCode: "s1-stationary",
    categoryName: "Stationary Combustion",
    description: "Emissions from burning fuel on-site for heating, power generation, or industrial processes.",
    whatToInclude: [
      "Natural gas for heating or cooking",
      "Diesel for backup generators",
      "Oil for heating or furnaces",
      "Coal for industrial kilns or boilers",
      "LPG for forklifts or heating",
    ],
    whatToExclude: [
      "Purchased electricity (see Scope 2)",
      "Fuel for vehicles you own (see Mobile Combustion)",
      "Emissions from waste treatment (Scope 3)",
    ],
    unitGuidance:
      "Record actual fuel consumption in kWh (for gas meter readings), litres, kg, or tonnes. If billing data only: provide annual cost and fuel type.",
    calculationTip:
      "Read meter directly if possible (most accurate). If not: convert from billing units. For natural gas: 1 m³ ≈ 10.5 kWh. Multiply kWh/volume by emission factor for that fuel type.",
    commonMistakes: [
      "Mixing net calorific value (NCV) with gross calorific value (GCV) factors",
      "Including electricity in 'on-site fuel' (it's Scope 2)",
      "Not accounting for heating efficiency loss",
      "Forgetting to annualize if you only have partial-year data",
    ],
    resources: [
      {
        title: "GHG Protocol Scope 1 Standard",
        url: "https://ghgprotocol.org/",
      },
      {
        title: "UK DEFRA Conversion Factors",
        url: "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting",
      },
    ],
  },

  "s1-mobile": {
    categoryCode: "s1-mobile",
    categoryName: "Mobile Combustion",
    description: "Emissions from fuel burned in company-owned or leased vehicles (cars, vans, trucks).",
    whatToInclude: [
      "Petrol and diesel cars",
      "Company vans and lorries",
      "Fleet vehicles",
      "Hybrid vehicle fuel use",
      "LPG and other fuels for vehicles",
    ],
    whatToExclude: [
      "Employee commuting in personal vehicles (Scope 3)",
      "Third-party logistics vehicles (Scope 3)",
      "Fuel for business travel by air/rail (Scope 3)",
      "Off-road vehicles (e.g., construction equipment—check classification)",
    ],
    unitGuidance:
      "Best: actual fuel consumed in litres. Alternative: vehicle distance in km/miles. Alternative: spend on fuel in GBP/USD.",
    calculationTip:
      "Ideal: track fuel receipts by vehicle. If not: fleet size × average fuel consumption (km/litre) × annual km. Electric vehicles: track electricity consumption separately (often counted in Scope 2).",
    commonMistakes: [
      "Including business travel miles (they're Scope 3 Business Travel)",
      "Forgetting to include employee mileage claims (if fuel reimbursed)",
      "Not accounting for idling, traffic, or driving style differences",
      "Using manufacturer fuel figures instead of actual consumption",
    ],
    resources: [
      {
        title: "GHG Protocol Scope 1 Standard",
        url: "https://ghgprotocol.org/",
      },
      {
        title: "UK Government Fleet Carbon Guidance",
        url: "https://www.gov.uk/government/publications/buying-transport-services",
      },
    ],
  },

  "s2-electricity-lb": {
    categoryCode: "s2-electricity-lb",
    categoryName: "Electricity (Location-Based)",
    description:
      "Emissions from purchased electricity, calculated using the average grid carbon intensity for your location.",
    whatToInclude: [
      "Electricity from grid supply",
      "Office and facility electricity",
      "Data center power",
      "EV charging (grid electricity)",
      "Leased space electricity (apportioned)",
    ],
    whatToExclude: [
      "Renewable energy from contracts (see Market-Based method)",
      "On-site solar/wind generation (separate tracking)",
      "Steam or hot water purchased (separate category)",
    ],
    unitGuidance: "Annual electricity consumption in kWh or MWh. Read from meter or utility bills.",
    calculationTip:
      "Multiply total kWh by location-based grid factor (provided by government bodies like DEFRA). For UK: typically 0.2–0.4 kg CO₂/kWh depending on region and year.",
    commonMistakes: [
      "Confusing location-based with market-based (they give different results)",
      "Using old grid factors (electricity gets cleaner year-on-year)",
      "Not including renewable energy—it still counts (just with low factor)",
      "Forgetting apportioned electricity in shared buildings",
    ],
    resources: [
      {
        title: "GHG Protocol Scope 2 Standard",
        url: "https://ghgprotocol.org/",
      },
      {
        title: "UK Electricity Grid Factors",
        url: "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting",
      },
    ],
  },

  "s2-electricity-mb": {
    categoryCode: "s2-electricity-mb",
    categoryName: "Electricity (Market-Based)",
    description:
      "Emissions from purchased electricity, calculated using actual contracts or tariffs you've negotiated (e.g., green energy deals).",
    whatToInclude: [
      "Electricity from green tariffs (certified renewable)",
      "Electricity from Power Purchase Agreements (PPAs)",
      "RECs (Renewable Energy Certificates) retirement",
      "On-site generation you've self-contracted",
    ],
    whatToExclude: [
      "Grid average electricity (use Location-Based method)",
      "Contractual claims without certification",
      "Double-counting if you also claim Scope 2 renewable energy credit",
    ],
    unitGuidance: "Annual electricity consumption in kWh/MWh, plus: contract type, percentage renewable, and certification body.",
    calculationTip:
      "Multiply kWh by contract-specific factor (often 0 for 100% renewable). If partial green: calculate blended factor (e.g., 50% renewable at 0 kg CO₂/kWh + 50% grid at 0.3 = 0.15 kg CO₂/kWh).",
    commonMistakes: [
      "Mixing location-based and market-based in the same year (pick one per scope 2)",
      "Claiming renewable without contract backing (DEFRA requires proof)",
      "Retiring RECs twice (REC + contract = over-claiming)",
      "Not updating as contracts change (annual reconciliation needed)",
    ],
    resources: [
      {
        title: "GHG Protocol Scope 2 Guidance",
        url: "https://ghgprotocol.org/",
      },
      {
        title: "Carbon Trust Renewable Energy Guide",
        url: "https://www.carbontrust.com/our-work-and-impact/news-and-insights/insights/understanding-renewable-energy-tariffs",
      },
    ],
  },
};

export function getCategoryGuidance(categoryCode: string): CategoryGuidance | null {
  return CATEGORY_GUIDANCE[categoryCode] ?? null;
}

export function getGuidanceForSupplier(categoryCode: string): {
  name: string;
  whatToInclude: string;
  unitGuidance: string;
  tip: string;
} | null {
  const guidance = getCategoryGuidance(categoryCode);
  if (!guidance) return null;

  return {
    name: guidance.categoryName,
    whatToInclude: guidance.whatToInclude.join("\n• "),
    unitGuidance: guidance.unitGuidance,
    tip: guidance.calculationTip,
  };
}
