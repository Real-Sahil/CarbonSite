import { describe, expect, test } from "vitest";
import { notificationPresentation } from "../presentation";
import type { NotificationJobData } from "@/lib/jobs/queues/index";

const base = { recipientUserId: "user-1", orgId: "org-1", resourceId: "res-1" };

describe("notificationPresentation", () => {
  test("report_ready links to the reports page and uses the report label", () => {
    const p = notificationPresentation({
      ...base,
      type: "report_ready",
      metadata: { reportLabel: "Audit Package" },
    });
    expect(p.title).toBe("Report ready");
    expect(p.body).toContain("audit package");
    expect(p.link).toBe("/orgs/org-1/reports");
  });

  test("dsar_sla_alert pluralises days and deep-links to the request", () => {
    const p = notificationPresentation({
      ...base,
      type: "dsar_sla_alert",
      metadata: { daysRemaining: 1, subjectEmail: "jo@example.com" },
    });
    expect(p.title).toBe("DSAR deadline: 1d remaining");
    expect(p.body).toContain("within 1 day.");
    expect(p.body).toContain("jo@example.com");
    expect(p.link).toBe("/orgs/org-1/compliance/dsar/res-1");
  });

  test("submission_reviewed reflects approved status and links to the submission", () => {
    const p = notificationPresentation({
      ...base,
      type: "submission_reviewed",
      metadata: { status: "approved" },
    });
    expect(p.title).toBe("Submission approved");
    expect(p.link).toBe("/orgs/org-1/submissions/res-1");
  });

  test("supplier_account_terminated has no link", () => {
    const p = notificationPresentation({ ...base, type: "supplier_account_terminated" });
    expect(p.link).toBeNull();
  });

  test("every notification type yields a non-empty title and body", () => {
    const types: NotificationJobData["type"][] = [
      "task_assigned",
      "import_failed",
      "report_ready",
      "submission_reviewed",
      "submission_received",
      "supplier_password_expiring",
      "supplier_account_terminated",
      "supplier_account_expiring",
      "dsar_sla_alert",
      "security_alert",
    ];
    for (const type of types) {
      const p = notificationPresentation({ ...base, type });
      expect(p.title.length, `title for ${type}`).toBeGreaterThan(0);
      expect(p.body.length, `body for ${type}`).toBeGreaterThan(0);
    }
  });
});
