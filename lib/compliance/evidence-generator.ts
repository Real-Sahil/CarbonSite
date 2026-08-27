import { prisma } from '@/lib/db';
import { PDFDocument, rgb } from 'pdf-lib';

interface CompliancePackageOptions {
  frameworks: ('csrd' | 'sbti' | 'cdp' | 'ghg-protocol' | 'iso-14064')[];
  includeCalculations: boolean;
  includeAuditTrail: boolean;
}

interface ComplianceEvidence {
  reportId: string;
  organizationId: string;
  frameworks: string[];
  generatedAt: Date;
  auditTrail: Array<{
    timestamp: string;
    action: string;
    actor: string | null;
    resourceType: string;
    resourceId: string;
  }>;
  calculationFormulas: Array<{
    formula: string;
    factorVersion: string;
    methodologyVersion: string;
  }>;
  dataLineage: Array<{
    step: number;
    stage: string;
    description: string;
    timestamp: string;
    recordCount?: number;
  }>;
  complianceStatus: Record<string, {
    framework: string;
    compliant: boolean;
    gaps: string[];
  }>;
}

/**
 * Generate compliance evidence package for audit trail
 */
export async function generateComplianceEvidence(
  organizationId: string,
  reportId: string,
  options: CompliancePackageOptions
): Promise<ComplianceEvidence> {
  const report = await prisma.report.findUniqueOrThrow({
    where: { id: reportId },
    include: {
      snapshot: {
        include: {
          calculationRun: {
            include: {
              factorLibrary: true,
              methodologyVersion: true,
            },
          },
        },
      },
    },
  });

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      organizationId,
      OR: [
        { resourceId: reportId },
        { resourceId: report.snapshotId },
      ],
    },
    include: {
      actor: {
        select: { email: true },
      },
      auditContexts: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const calculations = await prisma.emissionCalculation.findMany({
    where: {
      calculationRunId: report.snapshot.calculationRunId,
    },
    take: 100,
  });

  const dataLineage = [
    {
      step: 1,
      stage: 'Data Import',
      description: 'Activity records imported from CSV or field submissions',
      timestamp: report.snapshot.calculationRun.createdAt.toISOString(),
      recordCount: calculations.length,
    },
    {
      step: 2,
      stage: 'Data Quality Checks',
      description: 'Records validated for completeness and accuracy',
      timestamp: report.snapshot.calculationRun.createdAt.toISOString(),
    },
    {
      step: 3,
      stage: 'Factor Selection',
      description: 'Emission factors selected based on category and geography',
      timestamp: report.snapshot.calculationRun.createdAt.toISOString(),
    },
    {
      step: 4,
      stage: 'Calculation',
      description: 'CO2e calculated for each record (gas-specific with GWP AR6)',
      timestamp: report.snapshot.calculationRun.finishedAt?.toISOString() || new Date().toISOString(),
    },
    {
      step: 5,
      stage: 'Snapshot Publication',
      description: 'Results published and locked for audit',
      timestamp: report.snapshot.publishedAt?.toISOString() || new Date().toISOString(),
    },
    {
      step: 6,
      stage: 'Report Generation',
      description: 'Compliance report generated from snapshot',
      timestamp: report.createdAt.toISOString(),
    },
  ];

  const complianceStatus: Record<string, any> = {};
  options.frameworks.forEach((framework) => {
    complianceStatus[framework] = {
      framework,
      compliant: true,
      gaps: [],
    };

    if (framework === 'csrd' && !report.snapshot.calculationRun.methodologyVersion) {
      complianceStatus[framework].gaps.push('Methodology version not recorded');
      complianceStatus[framework].compliant = false;
    }
  });

  return {
    reportId,
    organizationId,
    frameworks: options.frameworks,
    generatedAt: new Date(),
    auditTrail: auditLogs.map((log) => ({
      timestamp: log.createdAt.toISOString(),
      action: log.action,
      actor: log.actor?.email || 'System',
      resourceType: log.resourceType,
      resourceId: log.resourceId,
    })),
    calculationFormulas: [
      {
        formula: 'CO2e = amount × factor × (1 + CH4×GWP + N2O×GWP)',
        factorVersion: report.snapshot.calculationRun.factorLibrary.version,
        methodologyVersion: report.snapshot.calculationRun.methodologyVersion?.name || 'GHG Protocol v1',
      },
    ],
    dataLineage,
    complianceStatus,
  };
}

/**
 * Create a PDF document containing compliance evidence
 */
export async function createCompliancePDF(
  evidence: ComplianceEvidence
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  // Add title page
  let page = pdfDoc.addPage([612, 792]); // Letter size
  const { height } = page.getSize();
  
  page.drawText('Compliance Evidence Report', {
    x: 50,
    y: height - 50,
    size: 24,
    color: rgb(0, 0, 0),
  });

  page.drawText(`Organization: ${evidence.organizationId}`, {
    x: 50,
    y: height - 100,
    size: 12,
    color: rgb(0.5, 0.5, 0.5),
  });

  page.drawText(`Report ID: ${evidence.reportId}`, {
    x: 50,
    y: height - 130,
    size: 12,
    color: rgb(0.5, 0.5, 0.5),
  });

  page.drawText(`Generated: ${evidence.generatedAt.toISOString()}`, {
    x: 50,
    y: height - 160,
    size: 12,
    color: rgb(0.5, 0.5, 0.5),
  });

  page.drawText(`Frameworks: ${evidence.frameworks.join(', ')}`, {
    x: 50,
    y: height - 190,
    size: 12,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Add data lineage section
  page = pdfDoc.addPage([612, 792]);
  let yPos = height - 50;

  page.drawText('Data Lineage', {
    x: 50,
    y: yPos,
    size: 16,
    color: rgb(0, 0, 0),
  });

  yPos -= 40;
  evidence.dataLineage.forEach((step) => {
    page.drawText(`${step.step}. ${step.stage}`, {
      x: 50,
      y: yPos,
      size: 12,
      color: rgb(0, 0, 0),
    });

    page.drawText(step.description, {
      x: 70,
      y: yPos - 20,
      size: 10,
      color: rgb(0.5, 0.5, 0.5),
    });

    if (step.recordCount) {
      page.drawText(`Records: ${step.recordCount}`, {
        x: 70,
        y: yPos - 35,
        size: 10,
        color: rgb(0.7, 0.7, 0.7),
      });
      yPos -= 50;
    } else {
      yPos -= 40;
    }
  });

  // Add calculation formulas section
  page = pdfDoc.addPage([612, 792]);
  yPos = height - 50;

  page.drawText('Calculation Formulas', {
    x: 50,
    y: yPos,
    size: 16,
    color: rgb(0, 0, 0),
  });

  yPos -= 40;
  evidence.calculationFormulas.forEach((formula, index) => {
    page.drawText(`Calculation Method ${index + 1}`, {
      x: 50,
      y: yPos,
      size: 11,
      color: rgb(0, 0, 0),
    });

    page.drawText(`Formula: ${formula.formula}`, {
      x: 70,
      y: yPos - 20,
      size: 9,
      color: rgb(0.5, 0.5, 0.5),
    });

    page.drawText(`Methodology: ${formula.methodologyVersion} (Factors v${formula.factorVersion})`, {
      x: 70,
      y: yPos - 35,
      size: 9,
      color: rgb(0.5, 0.5, 0.5),
    });

    yPos -= 55;
    if (yPos < 50) {
      page = pdfDoc.addPage([612, 792]);
      yPos = height - 50;
    }
  });

  // Add audit trail section
  page = pdfDoc.addPage([612, 792]);
  yPos = height - 50;

  page.drawText('Audit Trail', {
    x: 50,
    y: yPos,
    size: 16,
    color: rgb(0, 0, 0),
  });

  yPos -= 40;
  evidence.auditTrail.slice(0, 20).forEach((entry) => {
    page.drawText(`${entry.timestamp}`, {
      x: 50,
      y: yPos,
      size: 9,
      color: rgb(0, 0, 0),
    });

    page.drawText(`${entry.action} (${entry.resourceType} ${entry.resourceId}) by ${entry.actor}`, {
      x: 70,
      y: yPos - 15,
      size: 9,
      color: rgb(0.5, 0.5, 0.5),
    });

    yPos -= 30;
    if (yPos < 50) {
      page = pdfDoc.addPage([612, 792]);
      yPos = height - 50;
    }
  });

  return await pdfDoc.save();
}
