// Permit and consent lifecycle.
//
// Operating on an expired permit is an offence in its own right, separate from
// whatever the permit regulates. The point of this module is that a permit
// never quietly lapses: every permit has a renewal lead time, and the register
// reports what is due before it becomes a breach rather than after.

import type { PermitStatus, ComplianceStatus } from "@prisma/client";

export type PermitUrgency = "expired" | "renewal_due" | "expiring_soon" | "current" | "not_active";

export interface PermitLike {
  status: PermitStatus;
  expiresOn: Date | null;
  renewalNoticeDays: number;
}

/** Whole days from now until the date. Negative once the date has passed. */
export function daysUntil(date: Date, now: Date = new Date()): number {
  const MS_PER_DAY = 86_400_000;
  const a = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / MS_PER_DAY);
}

/**
 * Where a permit sits in its lifecycle.
 *
 * "renewal_due" fires at the permit's own lead time, which differs by regime:
 * a waste carrier registration renews in weeks, a bespoke environmental permit
 * can take the better part of a year.
 */
export function permitUrgency(permit: PermitLike, now: Date = new Date()): PermitUrgency {
  if (permit.status !== "active" && permit.status !== "applied") return "not_active";
  if (!permit.expiresOn) return "current";

  const days = daysUntil(permit.expiresOn, now);
  if (days < 0) return "expired";
  if (days <= permit.renewalNoticeDays) return "renewal_due";
  if (days <= permit.renewalNoticeDays + 60) return "expiring_soon";
  return "current";
}

/**
 * A permit recorded as active whose expiry has passed is a live compliance
 * breach, not a housekeeping task, so it is reported separately from one that
 * was properly surrendered or revoked.
 */
export function isOperatingOnExpiredPermit(permit: PermitLike, now: Date = new Date()): boolean {
  return permit.status === "active" && permit.expiresOn !== null && daysUntil(permit.expiresOn, now) < 0;
}

export interface PermitRegisterSummary {
  total: number;
  active: number;
  expired: number;
  /// Active permits past their expiry date. Each one is a breach.
  operatingOnExpired: number;
  renewalDue: number;
  expiringSoon: number;
  /// Conditions across all permits that are in breach.
  conditionsInBreach: number;
  conditionsAtRisk: number;
  conditionsOverdueAssessment: number;
}

export function summarisePermitRegister(
  permits: Array<PermitLike & { conditions: Array<{ complianceStatus: ComplianceStatus; nextDueOn: Date | null }> }>,
  now: Date = new Date(),
): PermitRegisterSummary {
  const summary: PermitRegisterSummary = {
    total: permits.length,
    active: 0,
    expired: 0,
    operatingOnExpired: 0,
    renewalDue: 0,
    expiringSoon: 0,
    conditionsInBreach: 0,
    conditionsAtRisk: 0,
    conditionsOverdueAssessment: 0,
  };

  for (const permit of permits) {
    if (permit.status === "active") summary.active += 1;
    if (permit.status === "expired") summary.expired += 1;
    if (isOperatingOnExpiredPermit(permit, now)) summary.operatingOnExpired += 1;

    const urgency = permitUrgency(permit, now);
    if (urgency === "renewal_due") summary.renewalDue += 1;
    if (urgency === "expiring_soon") summary.expiringSoon += 1;

    for (const condition of permit.conditions) {
      if (condition.complianceStatus === "breach") summary.conditionsInBreach += 1;
      if (condition.complianceStatus === "at_risk") summary.conditionsAtRisk += 1;
      if (condition.nextDueOn && daysUntil(condition.nextDueOn, now) < 0) {
        summary.conditionsOverdueAssessment += 1;
      }
    }
  }

  return summary;
}

/** Sort key putting the most urgent permits first in the register. */
export function permitSortRank(urgency: PermitUrgency): number {
  const order: Record<PermitUrgency, number> = {
    expired: 0,
    renewal_due: 1,
    expiring_soon: 2,
    current: 3,
    not_active: 4,
  };
  return order[urgency];
}
