import { describe, expect, test } from "vitest";
import { buildNotificationEmailMessage } from "../messages";

describe("notification email messages", () => {
  test("builds report-ready emails with a report link", () => {
    const message = buildNotificationEmailMessage({
      type: "report_ready",
      resourceId: "report-1",
      orgName: "Northbank",
      appUrl: "https://app.metricora.test",
      metadata: {
        orgId: "org-1",
        reportType: "audit_package",
        reportingPeriodLabel: "FY 2026",
      },
    });

    expect(message.subject).toContain("audit package report is ready");
    expect(message.text).toContain("FY 2026");
    expect(message.text).toContain("https://app.metricora.test/orgs/org-1/reports");
  });

  test("builds import failure emails with the failure reason", () => {
    const message = buildNotificationEmailMessage({
      type: "import_failed",
      resourceId: "import-1",
      orgName: "Northbank",
      appUrl: "https://app.metricora.test",
      metadata: {
        orgId: "org-1",
        sourceFilename: "waste.csv",
        error: "amount must be numeric",
      },
    });

    expect(message.subject).toContain("import needs attention");
    expect(message.text).toContain("waste.csv");
    expect(message.text).toContain("amount must be numeric");
  });

  test("builds task assignment emails with target context", () => {
    const message = buildNotificationEmailMessage({
      type: "task_assigned",
      resourceId: "task-1",
      orgName: "Northbank",
      appUrl: "https://app.metricora.test",
      metadata: {
        orgId: "org-1",
        targetType: "activity_record",
        targetLabel: "Concrete delivery",
        targetDetail: "Scope 3 purchased goods - in review",
        targetHref: "/orgs/org-1/records",
      },
    });

    expect(message.subject).toContain("task assigned");
    expect(message.text).toContain("activity record review task");
    expect(message.text).toContain("Concrete delivery");
    expect(message.text).toContain("https://app.metricora.test/orgs/org-1/records");
  });
});
