import { prisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/notifications/email";

export interface DigestTemplate {
  recipientEmail: string;
  organizationName: string;
  organizationId: string;
  recipientName: string;
  digestType: "daily" | "weekly" | "monthly";
  data: {
    alerts: Array<{ severity: string; message: string }>;
    newRecords: number;
    pendingReviews: number;
    completedCalculations: number;
    dataQualityScore: number;
    emissions: {
      total: number;
      scope1: number;
      scope2: number;
      scope3: number;
    };
    anomalies: number;
  };
}

/**
 * Generate HTML for digest email.
 */
function generateDigestHTML(template: DigestTemplate): string {
  const { organizationName, digestType, data } = template;

  const scoreColor =
    data.dataQualityScore >= 80
      ? "#10b981"
      : data.dataQualityScore >= 60
        ? "#f59e0b"
        : "#ef4444";

  const criticalAlerts = data.alerts.filter((a) => a.severity === "critical");
  const warningAlerts = data.alerts.filter((a) => a.severity === "warning");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #374151; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { border-bottom: 3px solid #1f2937; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { margin: 0 0 5px 0; font-size: 24px; color: #111827; }
        .header p { margin: 0; font-size: 14px; color: #6b7280; }
        .section { margin-bottom: 30px; }
        .section-title { font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 15px; border-left: 4px solid #2563eb; padding-left: 12px; }
        .metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .metric-card { background: #f9fafb; padding: 15px; border-radius: 8px; }
        .metric-value { font-size: 24px; font-weight: 700; color: #111827; }
        .metric-label { font-size: 12px; color: #6b7280; margin-top: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
        .alert-item { padding: 12px; border-radius: 6px; margin-bottom: 10px; border-left: 4px solid; }
        .alert-critical { border-left-color: #dc2626; background: #fef2f2; }
        .alert-warning { border-left-color: #f59e0b; background: #fffbeb; }
        .alert-info { border-left-color: #3b82f6; background: #eff6ff; }
        .alert-severity { font-weight: 600; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
        .alert-critical .alert-severity { color: #dc2626; }
        .alert-warning .alert-severity { color: #f59e0b; }
        .alert-info .alert-severity { color: #3b82f6; }
        .alert-message { font-size: 14px; color: #374151; }
        .emissions-breakdown { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; }
        .scope-card { background: #f3f4f6; padding: 12px; border-radius: 6px; text-align: center; }
        .scope-value { font-size: 18px; font-weight: 700; color: #111827; }
        .scope-label { font-size: 12px; color: #6b7280; margin-top: 5px; }
        .quality-score { font-size: 48px; font-weight: 700; color: ${scoreColor}; text-align: center; }
        .quality-label { text-align: center; font-size: 12px; color: #6b7280; margin-top: 10px; }
        .footer { border-top: 1px solid #e5e7eb; padding-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; }
        .empty-state { background: #f9fafb; padding: 20px; border-radius: 8px; text-align: center; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${organizationName}</h1>
          <p>${digestType.charAt(0).toUpperCase() + digestType.slice(1)} Digest — ${new Date().toLocaleDateString()}</p>
        </div>

        ${criticalAlerts.length > 0 ? `
          <div class="section">
            <div class="section-title">🚨 Critical Alerts</div>
            ${criticalAlerts.map((alert) => `
              <div class="alert-item alert-critical">
                <div class="alert-severity">Critical</div>
                <div class="alert-message">${alert.message}</div>
              </div>
            `).join("")}
          </div>
        ` : ""}

        ${warningAlerts.length > 0 ? `
          <div class="section">
            <div class="section-title">⚠️ Warnings</div>
            ${warningAlerts.map((alert) => `
              <div class="alert-item alert-warning">
                <div class="alert-severity">Warning</div>
                <div class="alert-message">${alert.message}</div>
              </div>
            `).join("")}
          </div>
        ` : ""}

        <div class="section">
          <div class="section-title">📊 Data Quality</div>
          <div class="quality-score">${data.dataQualityScore}%</div>
          <div class="quality-label">
            ${data.dataQualityScore >= 80 ? "Excellent - Audit Ready" : data.dataQualityScore >= 60 ? "Good - Minor Improvements Needed" : "Fair - Review Recommended"}
          </div>
        </div>

        <div class="section">
          <div class="section-title">📈 Emissions Summary</div>
          <div class="metric-grid">
            <div class="metric-card">
              <div class="metric-value">${Math.round(data.emissions.total).toLocaleString()}</div>
              <div class="metric-label">Total (kg CO₂e)</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${Math.round(data.emissions.scope1).toLocaleString()}</div>
              <div class="metric-label">Scope 1</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${Math.round(data.emissions.scope2).toLocaleString()}</div>
              <div class="metric-label">Scope 2</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${Math.round(data.emissions.scope3).toLocaleString()}</div>
              <div class="metric-label">Scope 3</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">📋 Activity Summary</div>
          <div class="metric-grid">
            <div class="metric-card">
              <div class="metric-value">${data.newRecords}</div>
              <div class="metric-label">New Records</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${data.pendingReviews}</div>
              <div class="metric-label">Pending Review</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${data.completedCalculations}</div>
              <div class="metric-label">Calculated</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${data.anomalies}</div>
              <div class="metric-label">Anomalies</div>
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.APP_URL}/orgs" class="button">View Dashboard</a>
        </div>

        <div class="footer">
          <p>This is an automated digest from CarbonSite. Manage your preferences in account settings.</p>
          <p>&copy; 2026 CarbonSite. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate digest text version (plain text).
 */
function generateDigestText(template: DigestTemplate): string {
  const { organizationName, digestType, data } = template;
  const scoreInterpretation =
    data.dataQualityScore >= 80
      ? "Excellent - Audit Ready"
      : data.dataQualityScore >= 60
        ? "Good - Minor Improvements Needed"
        : "Fair - Review Recommended";

  return `${organizationName} ${digestType.charAt(0).toUpperCase() + digestType.slice(1)} Digest
${new Date().toLocaleDateString()}

ALERTS
${data.alerts.length > 0 ? data.alerts.map((a) => `[${a.severity.toUpperCase()}] ${a.message}`).join("\n") : "No alerts"}

DATA QUALITY
${data.dataQualityScore}% (${scoreInterpretation})

EMISSIONS SUMMARY
Total: ${Math.round(data.emissions.total).toLocaleString()} kg CO₂e
Scope 1: ${Math.round(data.emissions.scope1).toLocaleString()} kg CO₂e
Scope 2: ${Math.round(data.emissions.scope2).toLocaleString()} kg CO₂e
Scope 3: ${Math.round(data.emissions.scope3).toLocaleString()} kg CO₂e

ACTIVITY SUMMARY
New Records: ${data.newRecords}
Pending Review: ${data.pendingReviews}
Completed Calculations: ${data.completedCalculations}
Anomalies Detected: ${data.anomalies}

View your dashboard: ${process.env.APP_URL}/orgs
`;
}

/**
 * Send a digest email to a user.
 */
export async function sendDigestEmail(template: DigestTemplate): Promise<void> {
  const html = generateDigestHTML(template);
  const text = generateDigestText(template);

  const digestLabel =
    template.digestType.charAt(0).toUpperCase() + template.digestType.slice(1);

  await sendTransactionalEmail({
    to: template.recipientEmail,
    subject: `${template.organizationName} ${digestLabel} Digest`,
    text,
    html,
  });
}

/**
 * Compile digest data for an organization user.
 */
export async function compileDigestData(
  organizationId: string,
  timeframe: "daily" | "weekly" | "monthly",
  userId?: string
): Promise<Partial<DigestTemplate["data"]> | null> {
  // Get time range based on digest type
  const now = new Date();
  let startDate = new Date();

  if (timeframe === "daily") {
    startDate.setDate(startDate.getDate() - 1);
  } else if (timeframe === "weekly") {
    startDate.setDate(startDate.getDate() - 7);
  } else {
    startDate.setMonth(startDate.getMonth() - 1);
  }

  // Get org details
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!org) return null;

  // Count new records
  const newRecords = await prisma.activityRecord.count({
    where: {
      organizationId,
      createdAt: { gte: startDate },
    },
  });

  // Count pending reviews
  const pendingReviews = await prisma.activityRecord.count({
    where: {
      organizationId,
      reviewStatus: "pending_review",
    },
  });

  // Count completed calculations
  const completedCalculations = await prisma.calculationRun.count({
    where: {
      organizationId,
      status: "completed",
      createdAt: { gte: startDate },
    },
  });

  // Get emissions summary
  const emissions = await prisma.dashboardAggregate.aggregate({
    where: { organizationId },
    _sum: {
      totalCo2e: true,
      scope1Total: true,
      scope2Total: true,
      scope3Total: true,
    },
  });

  // Get data quality score (simplified)
  const records = await prisma.activityRecord.count({
    where: { organizationId },
  });

  const withEvidence = await prisma.activityRecord.count({
    where: {
      organizationId,
      evidence: { some: {} },
    },
  });

  const dataQualityScore = records > 0 ? Math.round((withEvidence / records) * 100) : 0;

  return {
    emissions: {
      total: Number(emissions._sum.totalCo2e ?? 0),
      scope1: Number(emissions._sum.scope1Total ?? 0),
      scope2: Number(emissions._sum.scope2Total ?? 0),
      scope3: Number(emissions._sum.scope3Total ?? 0),
    },
    dataQualityScore,
    newRecords,
    pendingReviews,
    completedCalculations,
    anomalies: 0, // Would be fetched from anomaly detection
  };
}
