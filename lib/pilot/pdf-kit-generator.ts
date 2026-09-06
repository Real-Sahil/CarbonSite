import { jsPDF } from "jspdf";

/**
 * Pilot Client PDF Documentation Kit Generator
 *
 * Generates a comprehensive 6-PDF onboarding package:
 * 1. Executive Summary & Quick Start
 * 2. Sustainability Manager Role Guide
 * 3. Finance Lead Integration Guide
 * 4. Field Worker Mobile Setup
 * 5. Technical Integration & Admin Guide
 * 6. Compliance & Audit Framework
 */

export interface PilotClientContext {
  organizationId: string;
  organizationName: string;
  industry: string;
  facilityCount: number;
  facilityNames: string[];
  accountingSystem?: string;
  stakeholders: {
    sustainabilityLead: { name: string; email: string; role: string };
    financeLead: { name: string; email: string; role: string };
    itAdmin: { name: string; email: string };
    externalAuditor?: { name: string; firm: string; email: string };
  };
  complianceFrameworks: string[];
  timelineDays: number;
  pilotStartDate: Date;
  supplierCount: number;
  fieldWorkerCount: number;
  reportingCurrency: string;
  timezone: string;
}

// Helper function to add header to each page
function addHeader(doc: jsPDF, title: string, subtitle: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header background
  doc.setFillColor(249, 115, 22); // Orange accent
  doc.rect(0, 0, pageWidth, 35, "F");

  // Header text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 15, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(subtitle, 15, 25);

  // Page number
  const pageCount = doc.internal.pages.length - 1;
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text(`Page ${pageCount}`, pageWidth - 25, 28);

  // Reset text color for body
  doc.setTextColor(55, 65, 81);
}

// Helper function to add footer
function addFooter(doc: jsPDF, orgName: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Footer line
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);

  // Footer text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(`${orgName} • MetricOra Pilot Program`, 15, pageHeight - 8);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 50, pageHeight - 8);
}

/**
 * Document 1: Executive Summary
 */
export async function generateExecutiveSummary(context: PilotClientContext): Promise<Buffer> {
  const doc = new jsPDF();

  // Page 1
  addHeader(doc, "MetricOra", "Executive Summary");

  let yPos = 50;
  const lineHeight = 5;
  const maxWidth = 180;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Welcome to MetricOra", 15, yPos);
  yPos += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const introText = `We're excited to partner with ${context.organizationName} on this ${context.timelineDays}-day pilot program to establish a comprehensive, auditable emissions tracking foundation across your ${context.facilityCount} facilities.`;
  doc.text(introText, 15, yPos, { maxWidth, align: "left" });
  yPos += 20;

  // Timeline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("90-Day Timeline", 15, yPos);
  yPos += 10;

  const phases = [
    {
      name: "Phase 1: Setup",
      weeks: "Weeks 1–2",
      tasks: [
        "Admin access configured",
        "SSO/OAuth authentication live",
        "Field worker invites sent",
      ],
    },
    {
      name: "Phase 2: Data Capture",
      weeks: "Weeks 3–6",
      tasks: [
        "Historical data imported",
        "Field workers active on mobile app",
        "Real-time OCR extraction live",
      ],
    },
    {
      name: "Phase 3: Validation & Reporting",
      weeks: "Weeks 7–10",
      tasks: [
        "First calculation run completed",
        "Scope 3 estimations validated",
        "Draft report generated",
      ],
    },
    {
      name: "Phase 4: Review & Optimization",
      weeks: "Weeks 11–13",
      tasks: [
        "Anomaly detection refined",
        "Audit trail verified",
        "Production readiness confirmed",
      ],
    },
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  phases.forEach((phase) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${phase.name} (${phase.weeks})`, 15, yPos);
    yPos += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    phase.tasks.forEach((task) => {
      doc.text(`• ${task}`, 20, yPos);
      yPos += 5;
    });
    yPos += 5;
  });

  yPos += 5;

  // Key Contacts
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Key Contacts", 15, yPos);
  yPos += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const contacts = [
    `Sustainability Lead: ${context.stakeholders.sustainabilityLead.name} (${context.stakeholders.sustainabilityLead.email})`,
    `Finance Lead: ${context.stakeholders.financeLead.name} (${context.stakeholders.financeLead.email})`,
    `IT Administrator: ${context.stakeholders.itAdmin.name} (${context.stakeholders.itAdmin.email})`,
  ];

  contacts.forEach((contact) => {
    doc.text(contact, 15, yPos);
    yPos += 7;
  });

  addFooter(doc, context.organizationName);

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Document 2: Sustainability Manager Guide
 */
export async function generateSustainabilityManagerGuide(
  context: PilotClientContext
): Promise<Buffer> {
  const doc = new jsPDF();
  addHeader(doc, "Sustainability Manager", "Role Guide & Responsibilities");

  let yPos = 50;
  const lineHeight = 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Your Role in the Pilot", 15, yPos);
  yPos += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const roleText =
    "As Sustainability Lead, you are responsible for overseeing data quality, supplier engagement, and ensuring that emissions calculations align with organizational sustainability targets.";
  doc.text(roleText, 15, yPos, { maxWidth: 180 });
  yPos += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Key Responsibilities", 15, yPos);
  yPos += 8;

  const responsibilities = [
    "Review and approve all activity records before they are calculated",
    "Manage supplier data collection and performance tracking",
    "Monitor anomaly detection alerts and investigate outliers",
    "Validate Scope 3 estimation results against industry benchmarks",
    "Prepare quarterly emissions reports for executive review",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  responsibilities.forEach((resp) => {
    doc.text(`• ${resp}`, 20, yPos, { maxWidth: 170 });
    yPos += 10;
  });

  yPos += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Dashboard Key Metrics", 15, yPos);
  yPos += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const metrics = [
    "Total Emissions: Scope 1, 2, and 3 breakdown by category",
    "Data Quality Score: Completeness, accuracy, timeliness metrics",
    "Supplier Performance: Submission rate, data quality trends",
    "Anomaly Detection: Flagged records requiring review",
    "Trend Analysis: Month-over-month and year-over-year changes",
  ];

  metrics.forEach((metric) => {
    doc.text(`• ${metric}`, 20, yPos, { maxWidth: 170 });
    yPos += 10;
  });

  addFooter(doc, context.organizationName);

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Document 3: Finance Lead Guide
 */
export async function generateFinanceLeadGuide(context: PilotClientContext): Promise<Buffer> {
  const doc = new jsPDF();
  addHeader(doc, "Finance Lead", "Integration & Scope 3 Guide");

  let yPos = 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Finance Integration Overview", 15, yPos);
  yPos += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const financeText = `MetricOra integrates with ${context.accountingSystem || "your accounting system"} to automatically extract spend data for Scope 3 emissions calculations. This eliminates manual data entry and ensures accuracy.`;
  doc.text(financeText, 15, yPos, { maxWidth: 180 });
  yPos += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Action Items", 15, yPos);
  yPos += 8;

  const actionItems = [
    {
      title: "API Key Setup",
      desc: `Provide API credentials for ${context.accountingSystem || "accounting system"} connection`,
    },
    {
      title: "Historical Data Import",
      desc: "Upload 12 months of historical spend data for baseline calculation",
    },
    {
      title: "Category Mapping",
      desc: "Map GL accounts to emission categories (materials, services, travel, etc.)",
    },
    {
      title: "Spend Categorization Rules",
      desc: "Define rules for automatic Scope 3 categorization of invoices",
    },
    {
      title: "Invoice Anomaly Review",
      desc: "Review flagged invoices for errors, duplicates, and data quality issues",
    },
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  actionItems.forEach((item, idx) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${idx + 1}. ${item.title}`, 20, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.text(item.desc, 25, yPos, { maxWidth: 165 });
    yPos += 10;
  });

  addFooter(doc, context.organizationName);

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Document 4: Field Worker Guide
 */
export async function generateFieldWorkerGuide(context: PilotClientContext): Promise<Buffer> {
  const doc = new jsPDF();
  addHeader(doc, "Field Worker", "Mobile App Setup & Usage");

  let yPos = 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Quick Start Guide", 15, yPos);
  yPos += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Use the MetricOra mobile app to capture emissions data from the field.", 15, yPos);
  yPos += 15;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Step 1: Install & Login", 15, yPos);
  yPos += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("1. Download MetricOra app from App Store or Google Play", 20, yPos);
  yPos += 6;
  doc.text("2. Tap the deep link sent via email (or enter invite code)", 20, yPos);
  yPos += 6;
  doc.text("3. Set your PIN (4 digits minimum)", 20, yPos);
  yPos += 6;
  doc.text("4. You're ready to capture data", 20, yPos);
  yPos += 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Step 2: Capture Data", 15, yPos);
  yPos += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("1. Open app → Select 'New Submission'", 20, yPos);
  yPos += 6;
  doc.text("2. Choose submission type (Waste Ticket, Delivery Note, etc.)", 20, yPos);
  yPos += 6;
  doc.text("3. Photograph the document using your camera", 20, yPos);
  yPos += 6;
  doc.text("4. AI automatically extracts: weight, date, supplier name, code", 20, yPos);
  yPos += 6;
  doc.text("5. Review & correct any OCR results", 20, yPos);
  yPos += 6;
  doc.text("6. Tap 'Submit' → saved locally, synced when online", 20, yPos);
  yPos += 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Offline Capability", 15, yPos);
  yPos += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    "MetricOra works completely offline. Submissions are saved locally and synced automatically when you reconnect to the internet.",
    15,
    yPos,
    { maxWidth: 180 }
  );

  addFooter(doc, context.organizationName);

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Document 5: Technical Integration Guide
 */
export async function generateTechnicalIntegrationGuide(
  context: PilotClientContext
): Promise<Buffer> {
  const doc = new jsPDF();
  addHeader(doc, "IT Administrator", "Technical Setup & API Access");

  let yPos = 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Technical Integration Checklist", 15, yPos);
  yPos += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    "This guide covers SSO setup, user provisioning, and API access configuration.",
    15,
    yPos
  );
  yPos += 15;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("1. Single Sign-On (SSO) Setup", 15, yPos);
  yPos += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const ssoSteps = [
    "Supported providers: Okta, Azure AD, Google Workspace",
    "Contact MetricOra to receive SAML metadata template",
    "Configure your IdP to trust MetricOra's SSO endpoint",
    "Test SSO login flow before rolling out to team",
  ];
  ssoSteps.forEach((step) => {
    doc.text(`• ${step}`, 20, yPos, { maxWidth: 170 });
    yPos += 8;
  });

  yPos += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("2. User Provisioning", 15, yPos);
  yPos += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const provSteps = [
    "Admin creates users via MetricOra dashboard or API",
    "Assign roles: admin, editor, reviewer, viewer, auditor, field_worker",
    "Field workers receive deep link invitation for mobile onboarding",
  ];
  provSteps.forEach((step) => {
    doc.text(`• ${step}`, 20, yPos, { maxWidth: 170 });
    yPos += 8;
  });

  yPos += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("3. API Access", 15, yPos);
  yPos += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Organization API Key: [Available in Settings → API Keys]", 20, yPos);
  yPos += 7;
  doc.text("Base URL: https://api.metricora.io/orgs/{orgId}", 20, yPos);
  yPos += 7;
  doc.text("Authentication: Bearer token in Authorization header", 20, yPos);

  addFooter(doc, context.organizationName);

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Document 6: Compliance & Audit Guide
 */
export async function generateComplianceGuide(context: PilotClientContext): Promise<Buffer> {
  const doc = new jsPDF();
  addHeader(doc, "Compliance Officer", "Audit & Framework Mapping");

  let yPos = 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Compliance & Audit Trail", 15, yPos);
  yPos += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    "MetricOra provides immutable audit trails and evidence packages for compliance verification.",
    15,
    yPos
  );
  yPos += 15;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Supported Frameworks", 15, yPos);
  yPos += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const frameworks = context.complianceFrameworks.join(", ");
  doc.text(`Your organization is configured for: ${frameworks}`, 15, yPos, { maxWidth: 180 });
  yPos += 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Framework-Specific Mappings:", 15, yPos);
  yPos += 8;

  const mappings: Record<string, string[]> = {
    CSRD: [
      "DoubleMaturity requirement: Double materiality assessment",
      "Scope 1, 2, 3 coverage with audit trail",
      "Annual reporting with governance attestation",
    ],
    SBTi: [
      "Science-based target validation against GHG Protocol",
      "Baseline year analysis with historical data",
      "Progress tracking against committed reduction targets",
    ],
    CDP: [
      "Climate Change Disclosure questionnaire support",
      "Scope 3 supply chain emissions mapping",
      "Risk and opportunity assessment framework",
    ],
    "GHG-Protocol": [
      "Corporate Standard & Scope 3 Standard compliance",
      "GWP values (AR6) embedded in calculations",
      "Factor library versioning for reproducibility",
    ],
  };

  context.complianceFrameworks.forEach((fw) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${fw}:`, 20, yPos);
    yPos += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (mappings[fw]) {
      mappings[fw].forEach((point) => {
        doc.text(`• ${point}`, 25, yPos, { maxWidth: 160 });
        yPos += 7;
      });
    }
    yPos += 4;
  });

  yPos += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Evidence Package Export", 15, yPos);
  yPos += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    "Download complete audit evidence packages including: calculation formulas, factor selections, data lineage, verification checksums, and immutability proofs.",
    15,
    yPos,
    { maxWidth: 180 }
  );

  addFooter(doc, context.organizationName);

  return Buffer.from(doc.output("arraybuffer"));
}
