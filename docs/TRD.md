# CarbonSite Technical Requirements Document (TRD)

## 1. Technical Overview

CarbonSite should be implemented as a secure, multi-tenant web application that supports emissions data ingestion, calculation, review, analytics, and reporting. The architecture must preserve calculation traceability, support asynchronous imports and exports, and isolate each organization's data.

This TRD is technology-agnostic where possible because the repository does not currently contain an implementation stack. Recommended stack choices are included to provide a concrete implementation path.

## 2. Recommended Architecture

### 2.1 Application Components

- Web frontend for dashboards, forms, imports, reporting, and administration.
- Backend API for authentication, authorization, organization-scoped CRUD operations, imports, calculations, and exports.
- Relational database for core transactional data and auditability.
- Object storage for evidence files, generated reports, and import source files.
- Background worker system for imports, recalculations, notifications, and report generation.
- Cache or queue service for background job coordination and performance-sensitive reads.

### 2.2 Recommended Technology Stack

| Layer | Recommendation | Rationale |
| --- | --- | --- |
| Frontend | Next.js with React and TypeScript | Strong ecosystem for web apps, routing, server rendering, and type safety. |
| UI | Tailwind CSS plus accessible component primitives | Fast delivery while preserving accessible interactions. |
| Backend | Next.js API routes, NestJS, or Fastify with TypeScript | Shared language and strong typing across the stack. |
| Database | PostgreSQL | Relational integrity, reporting queries, JSON support, and mature indexing. |
| ORM | Prisma or Drizzle | Type-safe schema access and migrations. |
| Queue | BullMQ with Redis, or managed queue equivalent | Asynchronous imports, report exports, retries, and scheduling. |
| Object Storage | S3-compatible storage | Durable storage for uploaded evidence and generated artifacts. |
| Authentication | Managed auth provider or server-side auth library | Reduces security risk and accelerates implementation. |
| Observability | OpenTelemetry, structured logs, error tracking, and uptime monitoring | Production diagnostics and audit support. |

## 3. System Context

### 3.1 External Actors

- Organization users access the web application.
- External auditors access read-only reports and evidence.
- Email service sends notifications.
- Object storage stores files and generated reports.
- Optional future integrations provide accounting, travel, utility, procurement, and supplier data.

### 3.2 Logical Data Flow

1. User uploads activity data or enters records manually.
2. API stores the source file, creates an import job, and records import metadata.
3. Worker parses rows, validates schema, normalizes units, and creates staged records.
4. User resolves validation errors and approves import.
5. Calculation worker applies emission factors and creates immutable calculation records.
6. Dashboard queries aggregate calculation outputs.
7. Report generator creates PDF and CSV exports from published calculation snapshots.

## 4. Domain Model

### 4.1 Core Entities

- `User`: Individual account with identity and profile information.
- `Organization`: Tenant boundary for company data.
- `OrganizationMembership`: User-to-organization relationship with role.
- `Facility`: Physical or operational reporting location.
- `BusinessUnit`: Internal grouping for reporting and ownership.
- `ReportingPeriod`: Month, quarter, year, or custom period for inventory tracking.
- `EmissionCategory`: Scope and category taxonomy.
- `ActivityRecord`: User-provided source activity data.
- `EvidenceFile`: Supporting document linked to records, imports, or reports.
- `EmissionFactor`: Factor used to convert activity into emissions.
- `FactorLibrary`: Versioned collection of emission factors.
- `CalculationRun`: Batch execution metadata for calculations.
- `EmissionCalculation`: Output and trace for one calculated activity record.
- `ImportBatch`: Uploaded file, mapping, parsing status, and validation summary.
- `ReviewTask`: Assignment and approval state for data records or reports.
- `ReductionTarget`: Baseline and desired emissions outcome.
- `ReductionInitiative`: Planned or active emissions reduction project.
- `Report`: Published inventory, snapshot, or audit package.
- `AuditLog`: Append-only event record for material actions.

### 4.2 Required Entity Relationships

- A user can belong to multiple organizations.
- An organization owns facilities, business units, reporting periods, records, reports, and targets.
- An activity record belongs to one organization and one emission category.
- An activity record may reference a facility, business unit, supplier, import batch, and evidence files.
- An emission calculation references exactly one activity record, one emission factor, one calculation run, and one methodology version.
- A report references a reporting period and a point-in-time set of calculation outputs.

## 5. Data Requirements

### 5.1 Activity Record Fields

Each activity record should support:

- Organization ID.
- Reporting period ID.
- Emission category ID.
- Activity date or date range.
- Activity amount.
- Activity unit.
- Source description.
- Facility ID where applicable.
- Business unit ID where applicable.
- Supplier name where applicable.
- Country and region where applicable.
- Spend amount and currency where applicable.
- Distance and distance unit where applicable.
- Fuel, energy, refrigerant, or transport mode where applicable.
- Evidence status.
- Review status.
- Assumption notes.

### 5.2 Emission Factor Fields

Each emission factor should support:

- Factor library ID and version.
- Source name and source URL or citation.
- Effective start and end dates.
- Geography.
- Category and activity type.
- Input unit.
- CO2, CH4, N2O, and CO2e values where available.
- Global warming potential version.
- Uncertainty rating where available.
- License and usage notes.

### 5.3 Calculation Output Fields

Each calculation should persist:

- Activity record ID.
- Calculation run ID.
- Factor ID and factor version.
- Methodology version.
- Normalized activity amount and unit.
- Gas-specific emissions where available.
- Total CO2e.
- Calculation formula representation.
- Warnings and assumptions.
- Created timestamp.

## 6. API Requirements

### 6.1 API Design Principles

- Use organization-scoped routes or explicit organization context for all tenant resources.
- Validate all input at API boundaries using schema validation.
- Return consistent error objects with machine-readable codes and human-readable messages.
- Paginate list endpoints by default.
- Support idempotency keys for imports, report generation, and recalculation requests.

### 6.2 Representative Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/orgs` | Create organization. |
| `GET` | `/api/orgs/:orgId/dashboard` | Get dashboard summary metrics. |
| `POST` | `/api/orgs/:orgId/imports` | Create import batch and upload source file metadata. |
| `POST` | `/api/orgs/:orgId/imports/:importId/commit` | Commit validated staged records. |
| `GET` | `/api/orgs/:orgId/activity-records` | List activity records with filters. |
| `POST` | `/api/orgs/:orgId/activity-records` | Create manual activity record. |
| `PATCH` | `/api/orgs/:orgId/activity-records/:recordId` | Update activity record. |
| `POST` | `/api/orgs/:orgId/calculation-runs` | Trigger calculation or recalculation. |
| `GET` | `/api/orgs/:orgId/reports/:reportId` | Fetch report metadata and status. |
| `POST` | `/api/orgs/:orgId/reports` | Generate report. |
| `POST` | `/api/orgs/:orgId/targets` | Create reduction target. |
| `POST` | `/api/orgs/:orgId/initiatives` | Create reduction initiative. |

## 7. Calculation Engine Requirements

### 7.1 Calculation Formula

The baseline formula is:

```text
CO2e = normalized_activity_amount * emission_factor_value
```

For gas-specific factors:

```text
CO2e = CO2 + (CH4 * CH4_GWP) + (N2O * N2O_GWP) + other_gases_as_applicable
```

The engine must store enough data to explain how each result was calculated, including the original amount, normalized amount, unit conversions, selected factor, factor version, and methodology version.

### 7.2 Unit Normalization

- Maintain a canonical unit registry.
- Convert compatible units before factor application.
- Reject incompatible units with actionable validation errors.
- Store both original and normalized units.
- Version unit conversion rules when they affect published calculations.

### 7.3 Factor Selection

Factor selection should consider:

- Emission category.
- Activity type.
- Geography.
- Reporting period date.
- Unit compatibility.
- Market-based versus location-based Scope 2 method.
- Organization-specific overrides.

If multiple factors match, the engine should select the highest-priority match based on configured precedence and record the selection reason.

### 7.4 Recalculation

- Draft records can be recalculated automatically after edits.
- Published report calculations must remain immutable.
- Recalculation of a published period should create a new calculation run and report version.
- Users must see a diff between previous and recalculated totals before publishing a replacement report.

## 8. Import Pipeline Requirements

### 8.1 Import States

- `uploaded`: Source file received.
- `parsing`: Worker is extracting rows.
- `mapped`: Columns mapped to CarbonSite fields.
- `validating`: Records are being checked.
- `needs_attention`: Import has blocking validation errors.
- `ready_to_commit`: Import passed validation or only has accepted warnings.
- `committed`: Records were created.
- `failed`: Import could not be processed.

### 8.2 Validation Types

- Schema validation.
- Required field validation.
- Unit compatibility validation.
- Date range validation.
- Duplicate detection.
- Outlier detection.
- Factor availability validation.
- Evidence requirement validation.

### 8.3 Error Handling

- Import errors must identify row number, field name, error code, and suggested correction.
- Users should be able to download an error CSV.
- Partial commits should be avoided for MVP unless explicitly designed with transaction boundaries.

## 9. Reporting Requirements

### 9.1 Report Generation

- Report generation runs asynchronously.
- The report job reads from a published calculation snapshot.
- Generated PDFs and CSVs are stored in object storage.
- Report metadata stores file checksums, generation status, version, author, and publication timestamp.

### 9.2 Report Contents

- Organization profile.
- Reporting boundary and period.
- Methodology and factor library summary.
- Emissions totals by scope and category.
- Location-based and market-based Scope 2 totals where available.
- Data completeness and unresolved assumptions.
- Reduction targets and initiative summary.
- Calculation appendix or export link.

## 10. Security Requirements

### 10.1 Authentication

- Use secure session cookies or short-lived access tokens with refresh protection.
- Enforce email verification for production accounts.
- Support multi-factor authentication for admin users in a post-MVP phase.

### 10.2 Authorization

- Enforce organization membership on every organization-scoped query.
- Use role-based access control for create, update, delete, review, export, and admin actions.
- Prevent cross-tenant object storage access through signed URLs scoped by organization and resource.

### 10.3 Data Protection

- Encrypt data in transit with TLS.
- Encrypt object storage and database volumes at rest.
- Store only necessary personal data.
- Redact secrets and sensitive file URLs from logs.
- Implement secure deletion workflows for evidence files when retention policies permit deletion.

### 10.4 Audit Logging

Audit logs must be append-only and capture:

- Authentication events.
- Role changes.
- Data imports.
- Activity record creation, update, and deletion.
- Factor overrides.
- Calculation runs.
- Report publication.
- Evidence file access where required by customer tier.

## 11. Performance and Scaling Requirements

- Use database indexes for organization ID, reporting period ID, category ID, facility ID, status, and created timestamp.
- Pre-aggregate dashboard metrics by organization and reporting period after calculation runs.
- Use cursor pagination for large record lists.
- Process imports and reports in background workers.
- Stream large exports rather than loading all rows into memory.
- Apply request rate limits to authentication, imports, exports, and public share links.

## 12. Observability Requirements

- Emit structured logs with request ID, organization ID where safe, user ID where safe, route, status, duration, and error code.
- Track metrics for API latency, job duration, job failure rate, import row counts, report generation time, and calculation throughput.
- Capture frontend errors with release version and route context.
- Configure alerts for elevated error rates, failed job spikes, queue backlog, database saturation, and storage failures.

## 13. Testing Requirements

### 13.1 Automated Tests

- Unit tests for calculation formulas, unit conversions, factor selection, and validators.
- API tests for authentication, authorization, CRUD operations, imports, reports, and role boundaries.
- Integration tests for import-to-calculation-to-dashboard workflows.
- End-to-end tests for onboarding, CSV import, dashboard review, and report generation.
- Security regression tests for cross-tenant access attempts.

### 13.2 Test Data

- Include deterministic fixture factor libraries.
- Include sample activity data for electricity, natural gas, fuel, travel, and purchased goods.
- Include invalid import files that cover common validation failures.
- Avoid using real customer evidence files in non-production environments.

## 14. Deployment Requirements

### 14.1 Environments

- Local development.
- Preview environment per pull request.
- Shared staging environment.
- Production environment.

### 14.2 CI/CD

- Run linting, type checks, unit tests, and build checks on every pull request.
- Run database migration checks before deployment.
- Block production deployment if required tests fail.
- Use environment-specific secrets managed outside source control.

### 14.3 Database Migrations

- All schema changes must be managed through versioned migrations.
- Destructive migrations require explicit rollout plans and backups.
- Large backfills should run as controlled background jobs rather than request-time logic.

## 15. Data Migration and Seeding

- Seed default emission categories during initial setup.
- Seed sample factor library data for development and automated tests.
- Provide an admin-only factor library import mechanism for production factor updates.
- Maintain changelogs for factor library updates.

## 16. Accessibility and Frontend Technical Requirements

- Use semantic HTML and accessible form controls.
- Ensure charts expose summary tables or screen-reader-friendly alternatives.
- Maintain visible focus states.
- Use color palettes that meet contrast requirements.
- Validate forms both client-side for usability and server-side for correctness.

## 17. Future Integration Requirements

Future integrations should use a connector abstraction with:

- Provider configuration.
- OAuth or API credential storage.
- Sync schedules.
- Sync status and error history.
- Source-to-CarbonSite field mapping.
- Idempotent record upsert behavior.
- Revocation and credential rotation support.

Potential connectors include accounting systems, travel management platforms, utility data providers, procurement systems, cloud infrastructure billing exports, and supplier portals.

## 18. Implementation Milestones

### Milestone 1: Foundation

- Project scaffolding.
- Authentication.
- Organization and role model.
- Core database schema.
- Basic dashboard shell.

### Milestone 2: Data Intake

- Activity record CRUD.
- CSV templates and uploads.
- Import mapping and validation.
- Evidence file storage.

### Milestone 3: Calculations

- Factor library schema.
- Unit registry.
- Calculation engine.
- Calculation trace views.
- Recalculation workflow.

### Milestone 4: Analytics and Review

- Dashboard aggregates.
- Data quality flags.
- Review tasks and approvals.
- Audit log views.

### Milestone 5: Reporting

- Report builder.
- PDF and CSV exports.
- Published report versioning.
- Auditor read-only access.

## 19. Technical Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Carbon calculation logic becomes difficult to validate. | Low trust and high support burden. | Keep engine deterministic, heavily tested, and traceable at record level. |
| Large imports degrade web request performance. | Poor user experience and timeouts. | Process imports asynchronously and show progress states. |
| Multi-tenant access bugs expose customer data. | Severe security incident. | Centralize authorization checks, test cross-tenant access, and use organization-scoped queries. |
| Report outputs diverge from dashboard totals. | User confusion and audit issues. | Generate reports from immutable calculation snapshots used by dashboards. |
| Factor updates change historical numbers unexpectedly. | Loss of confidence in published reports. | Version factors and preserve published calculation outputs. |

## 20. Open Technical Decisions

- Final frontend and backend framework selection.
- Authentication provider versus self-managed authentication.
- Emission factor source licensing and update process.
- Object storage provider and signed URL strategy.
- PDF generation library and hosting requirements.
- Whether analytics aggregations should be SQL views, materialized tables, or event-driven projections.
- Whether customer-managed encryption keys are required for enterprise tiers.
