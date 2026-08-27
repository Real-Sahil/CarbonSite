import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { parseSupplierCsv, validateSupplierRows, formatTags, formatCategoryAssignments } from "@/lib/suppliers/csv-parser";
import * as crypto from "crypto";
import { createHash } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { code: "INVALID_REQUEST", message: "CSV file is required" },
        { status: 400 },
      );
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { code: "INVALID_REQUEST", message: "File must be a CSV file" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseSupplierCsv(buffer);
    const validation = validateSupplierRows(rows, orgId);

    if (validation.success.length === 0) {
      return NextResponse.json(
        {
          success: 0,
          failed: validation.failed.length,
          errors: validation.failed,
          message: "All rows failed validation",
        },
        { status: 400 },
      );
    }

    // Check for existing users by email to avoid duplicates
    const existingEmails = await prisma.user.findMany({
      where: {
        email: {
          in: validation.success.map((r) => r.email),
        },
      },
      select: { email: true },
    });
    const existingEmailSet = new Set(existingEmails.map((u) => u.email));

    const duplicateErrors = validation.success
      .filter((r) => existingEmailSet.has(r.email))
      .map((r) => ({
        rowNumber: r.rowNumber,
        data: r,
        errors: ["A user with this email already exists"],
      }));

    const rowsToCreate = validation.success.filter((r) => !existingEmailSet.has(r.email));

    if (rowsToCreate.length === 0) {
      return NextResponse.json(
        {
          success: 0,
          failed: validation.failed.length + duplicateErrors.length,
          errors: [...validation.failed, ...duplicateErrors],
          message: "No valid rows to import",
        },
        { status: 400 },
      );
    }

    // Get all tags and categories for this org
    const existingTags = await prisma.supplierTag.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
    });

    const tagMap = new Map(existingTags.map((t) => [t.name, t.id]));

    // Process each row in a transaction
    let successCount = 0;
    const errors = [...validation.failed, ...duplicateErrors];

    for (const row of rowsToCreate) {
      try {
        const plainPassword = crypto.randomBytes(9).toString("base64").substring(0, 12);
        const hashedPassword = createHash("sha256").update(plainPassword).digest("hex");

        await prisma.$transaction(async (tx) => {
          // Create user
          const user = await tx.user.create({
            data: {
              email: row.email,
              name: row.name,
              emailVerified: true,
            },
          });

          // Create account with password
          await tx.account.create({
            data: {
              userId: user.id,
              accountId: user.id,
              providerId: "credential",
              password: hashedPassword,
              passwordChangedAt: new Date(),
            },
          });

          // Create org membership
          await tx.organizationMembership.create({
            data: {
              organizationId: orgId,
              userId: user.id,
              role: "supplier",
            },
          });

          // Assign tags
          if (row.tags && row.tags.trim()) {
            const tagsToAssign = formatTags(row.tags);

            for (const tagName of tagsToAssign) {
              let tagId = tagMap.get(tagName);

              if (!tagId) {
                const newTag = await tx.supplierTag.create({
                  data: {
                    organizationId: orgId,
                    name: tagName,
                  },
                });
                tagId = newTag.id;
                tagMap.set(tagName, tagId);
              }

              await tx.supplierTagAssignment.create({
                data: {
                  tagId,
                  supplierId: user.id,
                },
              });
            }
          }

          // Assign categories
          if (row.categoryAssignments && row.categoryAssignments.trim()) {
            const categoriesToAssign = formatCategoryAssignments(row.categoryAssignments);

            for (const categoryCode of categoriesToAssign) {
              await tx.supplierCategoryAssignment.create({
                data: {
                  organizationId: orgId,
                  supplierId: user.id,
                  categoryCode,
                },
              });
            }
          }
        });

        successCount++;

        // Audit log
        await writeAuditLog({
          organizationId: orgId,
          actorUserId: session.user.id,
          action: "supplier_account.created_bulk",
          resourceType: "SupplierAccount",
          resourceId: row.email,
          metadata: {
            email: row.email,
            name: row.name,
            company: row.company,
            tags: formatTags(row.tags),
            categories: formatCategoryAssignments(row.categoryAssignments),
            bulkImport: true,
          },
        });
      } catch (err) {
        errors.push({
          rowNumber: row.rowNumber,
          data: row,
          errors: [err instanceof Error ? err.message : "Account creation failed"],
        });
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully created ${successCount} supplier account(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ""}`,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
