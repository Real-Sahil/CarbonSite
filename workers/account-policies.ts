import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { enqueueNotification } from "@/lib/jobs/queues";
import { subDays } from "date-fns";

export async function processAccountPolicies() {
  const now = new Date();

  // Get all organizations with policies configured
  const orgsWithPolicies = await prisma.organization.findMany({
    where: {
      OR: [
        { supplierPasswordRotationDays: { not: null } },
        { supplierAccountExpiryDays: { not: null } },
      ],
    },
    select: {
      id: true,
      supplierPasswordRotationDays: true,
      supplierAccountExpiryDays: true,
    },
  });

  for (const org of orgsWithPolicies) {
    console.log(`[account-policies] checking org ${org.id}`);

    // ── Password Rotation Check ──────────────────────────────────────────────
    if (org.supplierPasswordRotationDays && org.supplierPasswordRotationDays > 0) {
      const rotationThreshold = subDays(now, org.supplierPasswordRotationDays);
      const warningThreshold = subDays(now, org.supplierPasswordRotationDays - 7);

      // Find suppliers whose password is stale
      const suppliersNeedingReset = await prisma.organizationMembership.findMany({
        where: {
          organizationId: org.id,
          role: "supplier",
          terminatedAt: null,
          user: {
            account: {
              passwordChangedAt: {
                lt: rotationThreshold,
              },
            },
          },
        },
        select: {
          userId: true,
          user: { select: { email: true, name: true } },
        },
      });

      for (const supplier of suppliersNeedingReset) {
        // Audit log: password rotation required
        await writeAuditLog({
          organizationId: org.id,
          action: "supplier_account.password_rotation_required",
          resourceType: "OrganizationMembership",
          resourceId: supplier.userId,
          actorUserId: null,
          metadata: {
            supplierEmail: supplier.user.email,
            daysOverdue: org.supplierPasswordRotationDays,
          },
        });
      }

      // Find suppliers with warning (password expires in 7 days)
      const suppliersWithWarning = await prisma.organizationMembership.findMany({
        where: {
          organizationId: org.id,
          role: "supplier",
          terminatedAt: null,
          user: {
            account: {
              passwordChangedAt: {
                gte: rotationThreshold,
                lt: warningThreshold,
              },
            },
          },
        },
        select: {
          userId: true,
          user: { select: { email: true, name: true } },
        },
      });

      for (const supplier of suppliersWithWarning) {
        const daysUntilExpiry = Math.ceil(
          (rotationThreshold.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        await enqueueNotification({
          type: "supplier_password_expiring",
          recipientUserId: supplier.userId,
          orgId: org.id,
          resourceId: supplier.userId,
          metadata: {
            daysUntilExpiry,
            supplierEmail: supplier.user.email,
          },
        });
      }
    }

    // ── Account Expiry Check ─────────────────────────────────────────────────
    if (org.supplierAccountExpiryDays && org.supplierAccountExpiryDays > 0) {
      const expiryThreshold = subDays(now, org.supplierAccountExpiryDays);
      const warningThreshold = subDays(now, org.supplierAccountExpiryDays - 14);

      // Find suppliers with no login in expiry period
      const suppliersToExpire = await prisma.organizationMembership.findMany({
        where: {
          organizationId: org.id,
          role: "supplier",
          terminatedAt: null,
          user: {
            sessions: {
              none: {
                createdAt: {
                  gte: expiryThreshold,
                },
              },
            },
          },
        },
        select: {
          userId: true,
          user: { select: { email: true, name: true } },
        },
      });

      for (const supplier of suppliersToExpire) {
        // Terminate account
        await prisma.organizationMembership.update({
          where: {
            userId_organizationId: {
              userId: supplier.userId,
              organizationId: org.id,
            },
          },
          data: {
            terminatedAt: now,
          },
        });

        // Audit log: account auto-terminated
        await writeAuditLog({
          organizationId: org.id,
          action: "supplier_account.auto_terminated",
          resourceType: "OrganizationMembership",
          resourceId: supplier.userId,
          actorUserId: null,
          metadata: {
            supplierEmail: supplier.user.email,
            reason: "inactivity",
            inactiveDays: org.supplierAccountExpiryDays,
          },
        });

        // Send notification: account terminated
        await enqueueNotification({
          type: "supplier_account_terminated",
          recipientUserId: supplier.userId,
          orgId: org.id,
          resourceId: supplier.userId,
          metadata: {
            supplierEmail: supplier.user.email,
            reason: "inactivity",
          },
        });
      }

      // Find suppliers with warning (account expires in 14 days)
      const suppliersWithExpiryWarning = await prisma.organizationMembership.findMany({
        where: {
          organizationId: org.id,
          role: "supplier",
          terminatedAt: null,
          user: {
            sessions: {
              some: {
                createdAt: {
                  gte: warningThreshold,
                  lt: expiryThreshold,
                },
              },
            },
          },
        },
        select: {
          userId: true,
          user: { select: { email: true, name: true } },
        },
      });

      for (const supplier of suppliersWithExpiryWarning) {
        const daysUntilExpiry = Math.ceil(
          (expiryThreshold.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Notify admin only (not supplier) — recipient will be org owner or admin users
        // For simplicity, enqueue a notification to org admins
        const orgAdmins = await prisma.organizationMembership.findMany({
          where: {
            organizationId: org.id,
            role: "admin",
            terminatedAt: null,
          },
          select: { userId: true },
        });

        for (const admin of orgAdmins) {
          await enqueueNotification({
            type: "supplier_account_expiring",
            recipientUserId: admin.userId,
            orgId: org.id,
            resourceId: supplier.userId,
            metadata: {
              daysUntilExpiry,
              supplierEmail: supplier.user.email,
            },
          });
        }
      }
    }

    console.log(`[account-policies] finished org ${org.id}`);
  }
}
