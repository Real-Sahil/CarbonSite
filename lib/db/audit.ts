import { Prisma } from "@prisma/client";
import { prisma } from "./index";

export type AuditAction =
  | "auth.sign_in"
  | "auth.sign_out"
  | "auth.mfa_enabled"
  | "auth.mfa_disabled"
  | "auth.sso_login"
  | "org.created"
  | "org.updated"
  | "org.pilot_flag_changed"
  | "org.member.invite"
  | "org.member.invite_accepted"
  | "org.member.added"
  | "org.member.role_change"
  | "org.member.remove"
  | "org.member.account_deleted"
  | "business_unit.created"
  | "business_unit.updated"
  | "business_unit.deleted"
  | "facility.created"
  | "facility.updated"
  | "facility.deleted"
  | "reporting_period.created"
  | "reporting_period.updated"
  | "comment.created"
  | "evidence.uploaded"
  | "evidence.extracted"
  | "evidence.inbox_rejected"
  | "evidence.inbox_enabled"
  | "evidence.inbox_dismissed"
  | "evidence.attached"
  | "evidence.download_requested"
  | "evidence.downloaded"
  | "evidence.removed"
  | "import.created"
  | "import.committed"
  | "import.failed"
  | "import.error_export_downloaded"
  | "import.template_downloaded"
  | "record.created"
  | "record.updated"
  | "record.deleted"
  | "org.ai_assist_changed"
  | "commuting.imported"
  | "commuting.import_deleted"
  | "commuting.survey_created"
  | "commuting.survey_updated"
  | "energy_instrument.created"
  | "energy_instrument.deleted"
  | "record.reviewed"
  | "record.bulk_imported"
  | "factor.library_imported"
  | "factor.organization_imported"
  | "material_library.imported"
  | "calculation.run_triggered"
  | "calculation.triggered"
  | "calculation.run_completed"
  | "calculation.run_cancelled"
  | "calculation.schedule_created"
  | "calculation.schedule_updated"
  | "calculation.schedule_disabled"
  | "snapshot.published"
  | "snapshot.assured"
  | "snapshot.assurance_retracted"
  | "report.generation_triggered"
  | "report.published"
  | "report.downloaded"
  | "report.deleted"
  | "target.created"
  | "target.deleted"
  | "initiative.created"
  | "initiative.updated"
  | "initiative.deleted"
  | "legal_entity.created"
  | "legal_entity.updated"
  | "legal_entity.deleted"
  | "consolidation_approach.changed"
  | "base_year.created"
  | "base_year.activated"
  | "base_year.locked"
  | "base_year.superseded"
  | "structural_change.recorded"
  | "structural_change.deleted"
  | "base_year.recalculation_assessed"
  | "base_year.recalculation_approved"
  | "base_year.recalculation_rejected"
  | "restatement.recorded"
  | "restatement.disclosed"
  | "permit.created"
  | "permit.updated"
  | "permit.deleted"
  | "permit.condition_created"
  | "permit.condition_updated"
  | "legal_register.entry_created"
  | "legal_register.entry_updated"
  | "legal_register.entry_deleted"
  | "incident.reported"
  | "incident.updated"
  | "incident.closed"
  | "incident.regulator_notified"
  | "corrective_action.created"
  | "corrective_action.updated"
  | "corrective_action.verified"
  | "aspect.created"
  | "aspect.updated"
  | "aspect.deleted"
  | "biodiversity.assessment_created"
  | "biodiversity.assessment_updated"
  | "biodiversity.assessment_submitted"
  | "biodiversity.assessment_approved"
  | "biodiversity.parcel_created"
  | "biodiversity.parcel_updated"
  | "biodiversity.parcel_deleted"
  | "biodiversity.plan_created"
  | "biodiversity.monitoring_scheduled"
  | "biodiversity.monitoring_completed"
  | "species_record.created"
  | "species_record.updated"
  | "assurance.engagement_created"
  | "assurance.pack_downloaded"
  | "assurance.engagement_updated"
  | "assurance.engagement_signed"
  | "assurance.evidence_request_created"
  | "assurance.evidence_request_updated"
  | "assurance.sample_created"
  | "assurance.sample_tested"
  | "assurance.finding_raised"
  | "assurance.finding_management_response"
  | "assurance.finding_resolved"
  | "compliance.datapoint_status_recorded"
  | "framework.datapoint_narrative_updated"
  | "field_submission.submitted"
  | "field_submission.reviewed"
  | "field_submission.approved"
  | "field_submission.rejected"
  | "field_submission.needs_info"
  | "field_submission.resubmitted"
  | "field_submission.assigned"
  | "snapshot.approved"
  | "snapshot.changes_requested"
  | "field_worker.assignment_created"
  | "field_worker.assignment_deleted"
  | "field_worker.site_assigned"
  | "field_worker.site_unassigned"
  | "contract.created"
  | "contract.updated"
  | "contract.deleted"
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "project.member.added"
  | "project.member.removed"
  | "project.member.role_change"
  | "site.created"
  | "site.updated"
  | "site.deleted"
  | "branding.upserted"
  | "branding.logo_uploaded"
  | "social_value_record.created"
  | "social_value_record.deleted"
  | "social_value_target.upserted"
  | "social_value_target.deleted"
  | "audit.export_downloaded"
  | "audit.data_export_requested"
  | "webhook.created"
  | "webhook.deleted"
  | "embodied_carbon.record_created"
  | "embodied_carbon.not_recorded"
  | "pas2080.plan_updated"
  | "pas2080.opportunity_created"
  | "pas2080.opportunity_updated"
  | "pas2080.opportunity_deleted"
  | "plant.telematics_ingested"
  | "plant.asset_created"
  | "plant.asset_updated"
  | "embodied_carbon.record_deleted"
  | "api_key.created"
  | "api_key.deleted"
  | "notification.sent"
  | "record.version_snapshot"
  | "supplier_invite.created"
  | "supplier_invite.revoked"
  | "supplier_invite.accepted"
  | "supplier_account.created"
  | "supplier_account.created_bulk"
  | "supplier_account.categories_updated"
  | "supplier_account.password_reset"
  | "supplier_account.reactivated"
  | "supplier_account.terminated"
  | "supplier_tag.created"
  | "supplier_tag.deleted"
  | "supplier_data.submitted"
  | "supplier_data_request.sent"
  | "supplier_data_request.submitted"
  | "supplier_data_request.resent"
  | "supplier_portal.dashboard_accessed"
  | "epd.submitted"
  | "integration.connected"
  | "integration.disconnected"
  | "iot_device.registered"
  | "iot_device.updated"
  | "iot_device.deactivated"
  | "iot_credential.created"
  | "iot_credential.revoked"
  | "meter_reading.processed"
  | "meter_reading.duplicate_detected"
  | "bulk.categorize_queued"
  | "bulk.review_queued"
  | "job.failed"
  | "onboarding.step_completed"
  | "organization.account_policies_updated"
  | "compliance.csrd_assessed"
  | "sbti.pathway_created"
  | "billing.payment_method_added"
  | "billing.payment_method_deleted"
  | "billing.payment_method_set_default"
  | "billing.subscription_started"
  | "billing.subscription_synced"
  | "billing.subscription_cancel_requested"
  | "billing.subscription_ended"
  | "billing.payment_failed"
  | "billing.payment_action_required"
  | "billing.trial_will_end"
  | "billing.portal_opened"
  | "dsar.erasure_rejected"
  | "dsar.erasure_completed"
  | "dsar.export_completed"
  | "dsar.sla_approaching"
  | "security.alert_repeated_failed_logins"
  | "security.alert_privilege_escalation"
  | "security.alert_mass_export"
  | "security.alert_bulk_data_mutation"
  | "security.alert_bulk_submission_review"
  | "security.alert_suspicious_location_jump"
  | "causal_analysis.run_triggered"
  | "supplier_report.accepted"
  | "supplier_report.rejected"
  | "pilot.kit_generated"
  | "contract.created"
  | "contract.updated"
  | "contract.deleted"
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "site.created"
  | "site.updated"
  | "site.deleted"
  | "carbon_budget.set"
  | "carbon_budget.updated"
  | "carbon_budget.phase_updated"
  | "carbon_budget.phase_deleted"
  | "carbon_budget.forecast_alert"
  | "carbon_price.created"
  | "carbon_price.deleted"
  | "transition_plan.updated"
  | "carbon_reduction_plan.created"
  | "carbon_reduction_plan.updated"
  | "carbon_reduction_plan.generated"
  | "transition_plan.approved"
  | "subcontractor_submission.requested"
  | "subcontractor_submission.submitted"
  | "subcontractor_submission.verified"
  | "subcontractor_submission.rejected"
  | "whole_life_carbon.assessment_set"
  | "completeness.requirement_set"
  | "completeness.requirement_deleted"
  | "calculation.schedule_triggered"
  | "calculation.schedule_manually_triggered"
  | "report.signature_request_created"
  | "report.signature_signed"
  | "report.signature_declined"
  | "report.signature_expired"
  | "field_submission.review_claimed"
  | "field_submission.review_claim_released"
  | "settings.data_retention_updated"
  | "snapshot.share_link_created"
  | "snapshot.share_link_revoked"
  | "permit.expiry_alert_sent"
  | "permit.condition_due_alert_sent"
  | "tcfd.scenario_created"
  | "tcfd.scenario_updated"
  | "tcfd.scenario_deleted"
  | "tcfd.risk_created"
  | "tcfd.risk_updated"
  | "tcfd.risk_deleted"
  | "hs_incident.reported"
  | "hs_incident.updated"
  | "hs_incident.closed"
  | "hs_incident.riddor_notified"
  | "hs_incident_report.created"
  | "hs_incident_report.updated"
  | "hs_incident_report.submitted_for_review"
  | "hs_incident_report.approved"
  | "hs_incident_report.issued"
  | "hs_incident_report.signed_off"
  | "hs_incident_report.superseded"
  | "hs_incident_report.revised"
  | "hs_incident_report.deleted"
  | "environmental_incident.created"
  | "environmental_incident.updated"
  | "environmental_incident.submitted_for_review"
  | "environmental_incident.approved"
  | "environmental_incident.issued"
  | "environmental_incident.signed_off"
  | "environmental_incident.superseded"
  | "environmental_incident.revised"
  | "environmental_incident.deleted"
  | "environmental_permit.created"
  | "environmental_permit.updated"
  | "environmental_permit.submitted_for_review"
  | "environmental_permit.approved"
  | "environmental_permit.issued"
  | "environmental_permit.signed_off"
  | "environmental_permit.superseded"
  | "environmental_permit.revised"
  | "environmental_permit.deleted"
  | "assurance_engagement.created"
  | "assurance_engagement.updated"
  | "assurance_engagement.submitted_for_review"
  | "assurance_engagement.approved"
  | "assurance_engagement.issued"
  | "assurance_engagement.signed_off"
  | "assurance_engagement.superseded"
  | "assurance_engagement.revised"
  | "assurance_engagement.deleted"
  | "biodiversity_assessment.created"
  | "biodiversity_assessment.updated"
  | "biodiversity_assessment.submitted_for_review"
  | "biodiversity_assessment.approved"
  | "biodiversity_assessment.issued"
  | "biodiversity_assessment.signed_off"
  | "biodiversity_assessment.superseded"
  | "biodiversity_assessment.revised"
  | "biodiversity_assessment.deleted"
  | "method_statement.created"
  | "method_statement.updated"
  | "method_statement.submitted_for_review"
  | "method_statement.approved"
  | "method_statement.issued"
  | "method_statement.signed_off"
  | "method_statement.superseded"
  | "method_statement.revised"
  | "method_statement.deleted"
  | "worker_session.started"
  | "worker_session.ended"
  | "worker_session.overdue_alert"
  | "programme.created"
  | "programme.updated"
  | "programme.deleted"
  | "enforcement_notice.created"
  | "enforcement_notice.updated"
  | "enforcement_notice.complied"
  | "enforcement_notice.appealed"
  | "discharge_reading.recorded"
  | "discharge_reading.exceedance_flagged"
  | "supplier_profile.upserted"
  | "materiality.assessment_created"
  | "materiality.assessment_updated"
  | "materiality.assessment_published"
  | "materiality.topic_created"
  | "materiality.topic_updated"
  | "tnfd.scenario_created"
  | "tnfd.scenario_updated"
  | "tnfd.scenario_deleted"
  | "evidence.access_logged"
  | "sv_framework.create"
  | "sv_framework.update"
  | "sv_framework.delete"
  | "sv_commitment.create"
  | "sv_commitment.update"
  | "sv_commitment.delete"
  | "sv_activity.create"
  | "sv_activity.update"
  | "sv_activity.delete"
  | "sv_activity.approved"
  | "sv_activity.rejected"
  | "sv_activity.ai_extract"
  | "carbon_signal.ingested"
  | "impact_alert.created"
  | "impact_alert.resolved"
  | "geographic_impact.recorded"
  | "geographic_impact.deleted"
  | "external_credential.created"
  | "external_credential.updated"
  | "external_credential.deleted"
  | "external_credential.validated";

export async function writeAuditLog(params: {
  organizationId: string;
  actorUserId?: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  metadata?: Prisma.InputJsonObject;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const { createHash } = await import("crypto");

  // Get the previous log to chain the hash
  const previousLog = await prisma.auditLog.findFirst({
    where: { organizationId: params.organizationId },
    orderBy: { createdAt: "desc" },
    select: { hash: true },
  });

  const now = new Date();
  const previousHash = previousLog?.hash ?? null;
  const actorUserId = params.actorUserId ?? "";
  const metadata = params.metadata ?? {};

  // Compute hash chain: hash(previousHash | orgId | actor | action | resourceType | resourceId | metadata | createdAt)
  const hashInput = [
    previousHash || "",
    params.organizationId,
    actorUserId,
    params.action,
    params.resourceType,
    params.resourceId,
    JSON.stringify(metadata),
    now.toISOString(),
  ].join("|");

  const hash = createHash("sha256").update(hashInput).digest("hex");

  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: metadata as Prisma.InputJsonObject,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      previousHash,
      hash,
    },
  });
}

export async function verifyAuditChain(organizationId: string): Promise<null | 0> {
  const { createHash } = await import("crypto");

  const logs = await prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });

  if (logs.length === 0) return null;

  // Check if there are any pre-chain rows (no hash) mixed with hashed rows
  const hasUnhashedRows = logs.some(log => !log.hash);
  const hasHashedRows = logs.some(log => log.hash);

  if (hasUnhashedRows && !hasHashedRows) {
    // All rows are pre-chain (no hash yet), skip verification
    return null;
  }

  if (hasUnhashedRows && hasHashedRows) {
    // Mixed pre-chain and hashed rows means we're at the transition point
    // Skip verification for legacy data
    return null;
  }

  // Verify hash chain integrity for all hashed rows
  let previousHash: string | null = null;
  for (const log of logs) {
    if (!log.hash) {
      // Skip unhashed (pre-chain) rows
      continue;
    }

    const computedHash: string = createHash("sha256")
      .update(
        [
          previousHash || "",
          organizationId,
          log.actorUserId || "",
          log.action,
          log.resourceType,
          log.resourceId || "",
          JSON.stringify(log.metadata || {}),
          log.createdAt.toISOString(),
        ].join("|"),
      )
      .digest("hex");

    if (computedHash !== log.hash) {
      // Tampered row detected
      return 0;
    }

    previousHash = log.hash;
  }

  // Chain is intact
  return null;
}
