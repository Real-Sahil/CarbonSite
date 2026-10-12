import type { Nation } from "./bank-holidays";
import { submissionDeadline, type WindowStart } from "./receipt";
import { isWorkingDay, ukDay } from "./working-days";

export type ReceiptReportStatus = "reported" | "reported-late" | "open" | "due-today" | "overdue";

export interface ReceiptReportState {
  status: ReceiptReportStatus;
  deadline: Date;
}

/**
 * Where one received load stands against its two-working-day window.
 * `reportedAt` is when a person submitted it to Defra, if they have.
 */
export function receiptReportState(input: {
  start: WindowStart;
  nation: Nation;
  now: Date;
  reportedAt?: Date | null;
}): ReceiptReportState {
  const deadline = submissionDeadline(input.start, input.nation);
  if (input.reportedAt) {
    return { deadline, status: input.reportedAt.getTime() <= deadline.getTime() ? "reported" : "reported-late" };
  }
  if (input.now.getTime() > deadline.getTime()) return { deadline, status: "overdue" };
  const today = ukDay(input.now);
  return { deadline, status: today === ukDay(deadline) && isWorkingDay(today, input.nation) ? "due-today" : "open" };
}
