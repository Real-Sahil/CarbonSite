"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Mermaid from "@/components/ui/mermaid";

const dataLineageDiagram = `graph TD
  A["📥 Data Import<br/>CSV/Field Submissions<br/>Activity Records"] --> B["✓ Data Quality Checks<br/>Validation & Completeness<br/>Outlier Detection"]
  B --> C["🔍 Factor Selection<br/>Emission Factors<br/>Geography & Methodology"]
  C --> D["⚙️ Calculation<br/>CO2e Computation<br/>GWP Adjustments"]
  D --> E["📊 Dashboard Aggregate<br/>Pre-computed Totals<br/>Scope 1/2/3 Breakdown"]
  E --> F["📸 Snapshot Publication<br/>Immutable Version<br/>Audit Lock"]
  F --> G["📄 Report Generation<br/>PDF/CSV Export<br/>QR Code Verification"]
  
  style A fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
  style B fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
  style C fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
  style D fill:#fff3e0,stroke:#f57c00,stroke-width:2px
  style E fill:#fce4ec,stroke:#c2185b,stroke-width:2px
  style F fill:#e0f2f1,stroke:#00796b,stroke-width:2px
  style G fill:#f1f5fe,stroke:#0d47a1,stroke-width:2px
`;

export default function DataLineagePage() {
  const steps = [
    {
      stage: "Data Import",
      description: "Activity records imported from CSV files or field worker submissions",
      icon: "📥",
      details: [
        "Source: CSV uploads, field submissions, accounting software sync",
        "Format: Standardized to canonical units (kg, kWh, m³)",
        "Validation: Schema validation, business rule checks",
      ],
    },
    {
      stage: "Data Quality Checks",
      description: "Records validated for completeness, accuracy, and consistency",
      icon: "✓",
      details: [
        "Soda Core validation rules applied",
        "Outlier detection via PyOD (isolation forest)",
        "Missing value imputation for estimation-based fills",
      ],
    },
    {
      stage: "Factor Selection",
      description: "Emission factors matched based on category, geography, and methodology",
      icon: "🔍",
      details: [
        "Factor library versioning (DEFRA/EPA/SustainMetrics)",
        "Deterministic selection with audit trail",
        "Scope 2 method choice (location-based vs market-based)",
      ],
    },
    {
      stage: "Calculation",
      description: "CO2e computed for each record with GWP adjustments",
      icon: "⚙️",
      details: [
        "Gas-specific: CO2 + (CH4 × 27.9) + (N2O × 273)",
        "Formula stored immutably for audit",
        "Per-record EmissionCalculation row created (never updated)",
      ],
    },
    {
      stage: "Dashboard Aggregate",
      description: "Pre-computed totals rebuilt for real-time dashboards",
      icon: "📊",
      details: [
        "Scope 1: Stationary + Mobile + Fugitive",
        "Scope 2: Location-based + Market-based",
        "Scope 3: Business travel + Commuting + Purchased goods + Upstream transport",
      ],
    },
    {
      stage: "Snapshot Publication",
      description: "Results locked in immutable PublishedSnapshot for audit",
      icon: "📸",
      details: [
        "Timestamp recorded, never deleted",
        "Checksums for verification",
        "Linked to CalculationRun for full traceability",
      ],
    },
    {
      stage: "Report Generation",
      description: "PDF/CSV exports generated from snapshot with QR verification",
      icon: "📄",
      details: [
        "Report includes audit trail, calculation formulas, factors",
        "QR code links to verification endpoint",
        "Stored in R2 with 15-minute presigned download URLs",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Lineage</h1>
        <p className="text-gray-600 mt-2">
          Complete traceability from data import through calculation to published reports.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Emission Calculation Pipeline</CardTitle>
          <CardDescription>Visual flow of data transformations</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center bg-gray-50 rounded-lg p-6">
          <Mermaid diagram={dataLineageDiagram} />
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {steps.map((step, idx) => (
          <Card key={idx}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{step.icon}</span>
                  <div>
                    <CardTitle className="text-lg">{step.stage}</CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                  </div>
                </div>
                <Badge variant="outline">Step {idx + 1}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {step.details.map((detail, i) => (
                  <li key={i} className="text-sm text-gray-600 flex gap-2">
                    <span className="text-blue-600 font-semibold">•</span>
                    {detail}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Immutability & Audit Trail</CardTitle>
          <CardDescription>How data integrity is maintained</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-2">EmissionCalculation (Immutable)</h4>
            <p className="text-sm text-gray-600">
              Once created, calculation rows are never updated or deleted. Recalculations create new rows with a new CalculationRun. This ensures audit trail integrity and prevents data tampering.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-2">AuditLog (Append-Only)</h4>
            <p className="text-sm text-gray-600">
              Every action (import, calculation, snapshot, report) is logged immutably with actor, timestamp, IP address, and cryptographic hash chains. Logs cannot be updated or deleted.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-2">PublishedSnapshot (Locked)</h4>
            <p className="text-sm text-gray-600">
              Snapshots are timestamped and checksummed. Once published, they are the source of truth for that reporting period. Replacement requires explicit diff review and audit trail entry.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
