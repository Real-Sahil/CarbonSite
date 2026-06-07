import { z } from "zod";

// ─── OrgRole enum (mirrors Prisma) ──────────────────────────────────────────

export const orgRoleSchema = z.enum([
  "admin",
  "editor",
  "reviewer",
  "viewer",
  "auditor",
  "field_worker",
]);

// ─── Organization ────────────────────────────────────────────────────────────

export const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  industry: z.string().optional(),
  hqCountry: z.string().optional(),
});

export const updateOrgSchema = createOrgSchema.partial();

// ─── Facility ────────────────────────────────────────────────────────────────

export const createFacilitySchema = z.object({
  name: z.string().min(1).max(100),
  country: z.string().optional(),
  region: z.string().optional(),
});

export const updateFacilitySchema = createFacilitySchema.partial();

// ─── BusinessUnit ────────────────────────────────────────────────────────────

export const createBusinessUnitSchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateBusinessUnitSchema = createBusinessUnitSchema.partial();

// ─── ReportingPeriod ─────────────────────────────────────────────────────────

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createReportingPeriodSchema = z.object({
  type: z.enum(["month", "quarter", "year", "custom"]),
  startDate: z.string().regex(isoDateRegex, "Must be YYYY-MM-DD"),
  endDate: z.string().regex(isoDateRegex, "Must be YYYY-MM-DD"),
  label: z.string().min(1).max(100),
});

export const updateReportingPeriodSchema = createReportingPeriodSchema
  .partial()
  .extend({
    status: z.enum(["draft", "published", "locked"]).optional(),
  });

// ─── InviteLink ──────────────────────────────────────────────────────────────

export const createInviteLinkSchema = z.object({
  role: orgRoleSchema.default("field_worker"),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
});

// ─── Member management ───────────────────────────────────────────────────────

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: orgRoleSchema,
});

export const updateMemberRoleSchema = z.object({
  role: orgRoleSchema,
});

// ─── Presign upload ──────────────────────────────────────────────────────────

export const presignUploadSchema = z.object({
  key: z.string().min(1),
  contentType: z.string().min(1),
});
