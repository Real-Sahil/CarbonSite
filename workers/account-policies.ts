import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { dispatchNotification } from "@/lib/jobs/dispatch";

// Supplier account policies an org admin can switch on in settings
// (Organization.supplierPasswordRotationDays / supplierAccountExpiryDays).
// Orgs that leave both unset are never touched. Runs daily.
//
// - Password rotation: the supplier is reminded 7 days and 1 day before their
//   password is due, then told it is overdue on the due day and weekly after.
// - Inactivity expiry: a supplier who has not signed in for the set number of
//   days loses access to this organisation only (their membership is ended,
//   their account and other memberships are untouched). They are warned 14
//   and 3 days before. Someone who has never signed in counts from the day
//   they were added, so a new invitee is never cut off on day one.

const DAY = 24 * 60 * 60 * 1000;
const PASSWORD_WARN_DAYS = [7, 1];
const EXPIRY_WARN_DAYS = [14, 3];

export type SupplierState = {
  userId: string;
  joinedAt: Date;
  lastSignInAt: Date | null;
  passwordChangedAt: Date | null;
};

export type PolicyAction =
  | { kind: "password_expiring"; userId: string; daysRemaining: number }
  | { kind: "password_overdue"; userId: string; daysOverdue: number }
  | { kind: "access_expiring"; userId: string; daysRemaining: number }
  | { kind: "terminate"; userId: string; inactiveDays: number };

/** Whole days from `a` to `b`, counting calendar days in UTC. */
function daysBetween(a: Date, b: Date): number {
  const utc = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((utc(b) - utc(a)) / DAY);
}

/** What the daily run should do for one supplier. Pure, so it can be tested. */
export function planSupplierPolicies(
  s: SupplierState,
  policy: { passwordRotationDays: number | null; accountExpiryDays: number | null },
  now: Date,
): PolicyAction[] {
  const actions: PolicyAction[] = [];

  if (policy.accountExpiryDays && policy.accountExpiryDays > 0) {
    const lastActive = s.lastSignInAt && s.lastSignInAt > s.joinedAt ? s.lastSignInAt : s.joinedAt;
    const inactive = daysBetween(lastActive, now);
    const remaining = policy.accountExpiryDays - inactive;
    if (remaining <= 0) {
      return [{ kind: "terminate", userId: s.userId, inactiveDays: inactive }];
    }
    if (EXPIRY_WARN_DAYS.includes(remaining)) {
      actions.push({ kind: "access_expiring", userId: s.userId, daysRemaining: remaining });
    }
  }

  if (policy.passwordRotationDays && policy.passwordRotationDays > 0 && s.passwordChangedAt) {
    const age = daysBetween(s.passwordChangedAt, now);
    const remaining = policy.passwordRotationDays - age;
    if (remaining > 0 && PASSWORD_WARN_DAYS.includes(remaining)) {
      actions.push({ kind: "password_expiring", userId: s.userId, daysRemaining: remaining });
    } else if (remaining <= 0 && Math.abs(remaining) % 7 === 0) {
      actions.push({ kind: "password_overdue", userId: s.userId, daysOverdue: Math.abs(remaining) });
    }
  }

  return actions;
}

export async function processAccountPolicies(now = new Date()) {
  const orgs = await prisma.organization.findMany({
    where: {
      OR: [{ supplierPasswordRotationDays: { gt: 0 } }, { supplierAccountExpiryDays: { gt: 0 } }],
    },
    select: { id: true, supplierPasswordRotationDays: true, supplierAccountExpiryDays: true },
  });

  const summary = { orgs: orgs.length, terminated: 0, notified: 0 };

  for (const org of orgs) {
    const suppliers = await prisma.organizationMembership.findMany({
      where: { organizationId: org.id, role: "supplier", terminatedAt: null },
      select: {
        userId: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            sessions: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
            accounts: {
              where: { providerId: "credential" },
              select: { passwordChangedAt: true, createdAt: true },
              take: 1,
            },
          },
        },
      },
    });

    for (const m of suppliers) {
      const account = m.user.accounts[0];
      const actions = planSupplierPolicies(
        {
          userId: m.userId,
          joinedAt: m.createdAt,
          lastSignInAt: m.user.sessions[0]?.createdAt ?? null,
          passwordChangedAt: account ? account.passwordChangedAt ?? account.createdAt : null,
        },
        { passwordRotationDays: org.supplierPasswordRotationDays, accountExpiryDays: org.supplierAccountExpiryDays },
        now,
      );

      for (const action of actions) {
        if (action.kind === "terminate") {
          await prisma.organizationMembership.update({
            where: { organizationId_userId: { organizationId: org.id, userId: m.userId } },
            data: { terminatedAt: now },
          });
          await writeAuditLog({
            organizationId: org.id,
            action: "supplier_account.terminated",
            resourceType: "OrganizationMembership",
            resourceId: m.userId,
            actorUserId: null,
            metadata: { supplierEmail: m.user.email, reason: "inactivity", inactiveDays: action.inactiveDays },
          });
          await notify({ type: "supplier_account_terminated", recipientUserId: m.userId, orgId: org.id, resourceId: m.userId, metadata: { reason: "inactivity" } });
          summary.terminated++;
        } else if (action.kind === "access_expiring") {
          await notify({
            type: "supplier_account_expiring",
            recipientUserId: m.userId,
            orgId: org.id,
            resourceId: m.userId,
            metadata: { daysRemaining: action.daysRemaining, daysUntilExpiry: action.daysRemaining },
          });
          summary.notified++;
        } else if (action.kind === "password_expiring") {
          await notify({
            type: "supplier_password_expiring",
            recipientUserId: m.userId,
            orgId: org.id,
            resourceId: m.userId,
            metadata: { daysRemaining: action.daysRemaining, daysUntilExpiry: action.daysRemaining },
          });
          summary.notified++;
        } else {
          await writeAuditLog({
            organizationId: org.id,
            action: "supplier_account.password_reset",
            resourceType: "OrganizationMembership",
            resourceId: m.userId,
            actorUserId: null,
            metadata: { supplierEmail: m.user.email, reason: "rotation_overdue", daysOverdue: action.daysOverdue },
          });
          await notify({
            type: "supplier_password_expiring",
            recipientUserId: m.userId,
            orgId: org.id,
            resourceId: m.userId,
            metadata: { daysRemaining: 0, daysUntilExpiry: 0 },
          });
          summary.notified++;
        }
      }
    }
  }

  console.log(`[account-policies] ${JSON.stringify(summary)}`);
  return summary;
}

// A failed email must not stop the rest of the run.
async function notify(data: Parameters<typeof dispatchNotification>[0]) {
  await dispatchNotification(data).catch((err) =>
    console.error(`[account-policies] notification ${data.type} failed:`, err),
  );
}
