# Graph Report - /home/user/CarbonSite  (2026-08-08)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2403 nodes · 4238 edges · 160 communities (122 shown, 38 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 76 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `111cda44`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- rateLimitRequest
- reports/worker.ts
- dispatch.ts
- session.ts
- endpoints.dart
- capture_screen.dart
- storage/index.ts
- dashboard_screen.dart
- ocr_extractor.dart
- CLAUDE.md — Project Overview and Architecture Guide
- social-value-actions.tsx
- writeAuditLog
- requireOrgMember
- compilerOptions
- submissions_screen.dart
- calculations/page.tsx
- app_database.dart
- field-submissions/route.ts
- cn
- dependencies
- audit/page.tsx
- barcode_scan_screen.dart
- targets/page.tsx
- pin_setup_screen.dart
- setup-actions.tsx
- home_screen.dart
- dashboard/page.tsx
- sync_service.dart
- requirePlatformMember
- report-frameworks.ts
- field-app/page.tsx
- main.dart
- client.dart
- router.dart
- palette.ts
- fcm_handler.dart
- submission_detail_screen.dart
- hero-section.tsx
- Flutter Mobile Dependencies (pubspec.yaml)
- invite_screen.dart
- pin_lock_screen.dart
- members/page.tsx
- app_theme.dart
- components.json
- validator.ts
- AuthError
- records/page.tsx
- submissions-table.tsx
- CarbonSite Brand Identity
- [submissionId]/review/route.ts
- submissions/[id]/page.tsx
- import.ts
- presignDownload
- imports/page.tsx
- Reporting & Standards Engine
- New Data Models Required (Contract, Project, Site, TenantBranding, etc.)
- package:flutter/material.dart
- [runId]/page.tsx
- embodied-carbon/page.tsx
- embodied-carbon/engine.ts
- devDependencies
- scripts
- middleware.ts
- [contractId]/page.tsx
- route-distance.ts
- verify.ts
- apply-vercel-env.ts
- snapshot-diff-modal.tsx
- contracts/page.tsx
- [token]/page.tsx
- Remediation Plan (Sprint 0-6)
- [projectId]/page.tsx
- AppDelegate
- Technical Debt Register (25 items)
- tasks/page.tsx
- package.json
- [webhookId]/route.ts
- (marketing)/layout.tsx
- upload-policy.ts
- client_test.dart
- Primary Evidence-to-Report Workflow
- [projectId]/route.ts
- members/route.ts
- app/layout.tsx
- Reporting Gaps (SECR/CSRD/PPN06-21 missing)
- comment-actions.tsx
- [contractId]/route.ts
- projects/route.ts
- product/page.tsx
- resources/page.tsx
- security/page.tsx
- Field Evidence Capture SVG Diagram
- health/route.ts
- validator.test.ts
- branding-actions.tsx
- CI Workflow (ci.yml)
- Route Distance and Evidence Review Map SVG
- onboarding-checklist.tsx
- boss.ts
- carbon-flow.tsx
- fcm.ts
- targets.ts
- RunnerTests
- field_worker.test.ts
- tenant_isolation.test.ts
- vercel.json
- sitemap.ts
- Fluid Enterprise Platform (target brand)
- MainActivity
- Job Processing Modes (inline vs worker)
- Post-Release Smoke Test Checklist
- SceneDelegate
- animated-counter.tsx
- standards-marquee.tsx
- next.config.ts
- seed.ts
- evidence-download-actions.tsx
- AppDatabase
- Pending: iOS build unsigned only
- headroom-init.sh
- RBAC Access Control (invite flow, role management)
- eslint.config.mjs
- postcss.config.mjs
- verify-env.ts
- ../api/endpoints.dart
- Neon Branch Workflow (neon_workflow.yml)
- Production DB Workflow (production-db.yml)
- Web Data Ingress Flow
- RBAC: 6 Current Roles
- Persona: Sustainability Manager
- Incident Triage (Ops Runbook)
- Security Response Procedure
- Roadmap Phase 1: Canonical Production Baseline
- Production Principles
- UX Standard (calm, operational, data-first)
- Local Web Setup Guide
- Production Environment Variables
- UI/UX Design Direction (serious ops software)
- package:carbonsite_mobile/core/offline/offline_submission_queue.dart
- package:share_plus/share_plus.dart
- VALID_CATEGORY_CODES
- [periodId]/route.ts

## God Nodes (most connected - your core abstractions)
1. `requireOrgMember()` - 250 edges
2. `writeAuditLog()` - 139 edges
3. `rateLimitRequest()` - 85 edges
4. `rateLimitKey()` - 77 edges
5. `handleRouteError()` - 47 edges
6. `cn()` - 27 edges
7. `CLAUDE.md — Project Overview and Architecture Guide` - 26 edges
8. `AuthError` - 26 edges
9. `brandStyles()` - 25 edges
10. `brandLogoHtml()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `National TOMS Framework` --semantically_similar_to--> `Social Value Engine (National TOMS)`  [INFERRED] [semantically similar]
  audit/repository-audit.md → docs/FLUID-PRD.md
- `RecordDetailPage()` --calls--> `requireOrgMember()`  [INFERRED]
  app/(app)/orgs/[orgId]/records/[id]/page.tsx → lib/auth/session.ts
- `Calculation & Reporting Pipeline` --semantically_similar_to--> `Carbon Accounting Engine Pipeline (6 Steps)`  [INFERRED] [semantically similar]
  audit/repository-audit.md → docs/FLUID-PRD.md
- `RBAC: 15 Target Roles (Fluid Enterprise)` --semantically_similar_to--> `RBAC: 15 Roles Across 3 Scopes`  [INFERRED] [semantically similar]
  audit/repository-audit.md → docs/FLUID-PRD.md
- `AppLayout()` --calls--> `getSession()`  [INFERRED]
  app/(app)/layout.tsx → lib/auth/session.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CarbonSite UI Design Skills (taste-skill, emil-design-eng, ui-ux-pro-max) form a unified frontend quality system** — skills_taste_skill, skills_emil_design_eng, skills_ui_ux_pro_max [INFERRED 0.95]
- **CI Pipeline covers web (lint/typecheck/test/build) and mobile (Flutter APK) in unified GitHub Actions workflow** — github_workflows_ci_web_job, github_workflows_ci_android_job, claude_md_flutter_mobile [EXTRACTED 1.00]
- **Neon PR preview database flow: create branch on PR open, run migrations+seed, delete on PR close** — workflows_neon_create_branch, workflows_neon_delete_branch, claude_md_neon_postgres [EXTRACTED 1.00]
- **Field Worker Offline Capture and Sync Flow** — mobile_pubspec_google_mlkit, mobile_pubspec_drift, mobile_pubspec_connectivity_plus, audit_repository_audit_data_flow_mobile_capture [EXTRACTED 1.00]
- **Evidence → OCR → Carbon Calculation Pipeline** — docs_fluid_prd_evidence_management, docs_fluid_prd_ocr_extraction_schema, docs_fluid_prd_carbon_engine_pipeline, audit_repository_audit_calculation_reporting_pipeline [EXTRACTED 1.00]
- **MVP to Enterprise Transformation Critical Gaps** — audit_repository_audit_schema_gaps, audit_repository_audit_social_value_engine_gap, audit_repository_audit_white_label_gap, audit_repository_audit_multi_tenancy_gaps [EXTRACTED 1.00]
- **CarbonSite Visual Brand and Marketing Assets** — public_carbonsite_logo_svg, public_favicon_svg, public_carbonsite_audit_pack_svg, public_carbonsite_field_capture_svg, public_carbonsite_route_evidence_svg, public_carbonsite_site_operations_svg [INFERRED 0.95]
- **Mobile App Icon Assets (Android + iOS)** — mobile_android_ic_launcher_hdpi, mobile_ios_appicon_1024, mobile_ios_launchimage [EXTRACTED 1.00]
- **Field Worker UX Concepts (Capture, Submit, Route Evidence)** — concept_field_capture_flow, concept_ocr_document_scan, concept_submit_button, concept_route_evidence, concept_route_map [INFERRED 0.85]
- **Reporting and Audit Concepts** — concept_audit_package, concept_report_document, concept_verified_checkmark, concept_site_operations_dashboard, concept_emissions_table [INFERRED 0.85]

## Communities (160 total, 38 thin omitted)

### Community 0 - "rateLimitRequest"
Cohesion: 0.04
Nodes (88): GET(), PUT(), DELETE(), PATCH(), resolveBusinessUnit(), GET(), POST(), POST() (+80 more)

### Community 1 - "reports/worker.ts"
Cohesion: 0.05
Nodes (81): CbamGoodsItem, CbamInstallation, CbamMaterial, CbamReportData, CONSTRUCTION_CBAM_CN_CODES, esc(), fmtDate(), fmtN() (+73 more)

### Community 2 - "dispatch.ts"
Cohesion: 0.05
Nodes (61): { GET, POST }, authClient, CalculationResult, computeCo2e(), GasValues, GWP, computeRecordEmission(), RecordCalculationInput (+53 more)

### Community 3 - "session.ts"
Cohesion: 0.05
Nodes (62): Params, POST(), Params, POST(), Params, PATCH(), DELETE(), PATCH() (+54 more)

### Community 4 - "endpoints.dart"
Cohesion: 0.03
Nodes (66): client.dart, double?, int?, acceptInvite, AcceptInviteResponse, body, checksum, client (+58 more)

### Community 5 - "capture_screen.dart"
Cohesion: 0.03
Nodes (61): barcode_scan_screen.dart, bool get, IconData, ImageSource, _applyExtracted, _autoFilled, build, _buildReviewForm (+53 more)

### Community 6 - "storage/index.ts"
Cohesion: 0.07
Nodes (42): BodySchema, POST(), GET(), PUT(), GET(), GET(), POST(), DELETE() (+34 more)

### Community 7 - "dashboard_screen.dart"
Cohesion: 0.04
Nodes (55): approvedCount, awaitingSyncCount, color, compute, createState, _DashboardStats, _error, _firstName (+47 more)

### Community 8 - "ocr_extractor.dart"
Cohesion: 0.04
Nodes (53): DocumentType, _companySuffix, date, DocumentType, ewcCode, _ewcLabelled, _ewcSeparated, _exactMatch (+45 more)

### Community 9 - "CLAUDE.md — Project Overview and Architecture Guide"
Cohesion: 0.06
Nodes (51): CLAUDE.md — Project Overview and Architecture Guide, AuditLog (append-only, writeAuditLog()), Better Auth (Postgres sessions + JWT), Calculation Engine (lib/calculation/), CarbonSite Platform, Cloudflare R2 Object Storage, DashboardAggregate Pre-computed Totals Pattern, Emission Factor Sources (DEFRA 2025, EPA 2025, SustainMetrics) (+43 more)

### Community 10 - "social-value-actions.tsx"
Cohesion: 0.07
Nodes (30): ImportBatchActionsProps, ImportBatchEvidenceActionsProps, InviteMemberFormProps, ROLES, ROLES, RecordActionsProps, ContractOption, CreateSocialValueRecordForm() (+22 more)

### Community 11 - "writeAuditLog"
Cohesion: 0.06
Nodes (37): POST(), bulkReviewRecordsSchema, Params, PATCH(), escapeCsvField(), GET(), Params, CreateSchema (+29 more)

### Community 12 - "requireOrgMember"
Cohesion: 0.06
Nodes (36): GET(), Params, POST(), GET(), Params, PATCH(), DELETE(), GET() (+28 more)

### Community 13 - "compilerOptions"
Cohesion: 0.05
Nodes (41): mobile, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node, node_modules, tests (+33 more)

### Community 14 - "submissions_screen.dart"
Cohesion: 0.05
Nodes (40): ../../core/storage/app_database.dart, ../../core/widgets/offline_banner.dart, build, DraftSubmission, FieldSubmission, _handleTap, appDatabaseProvider, localDraftsProvider (+32 more)

### Community 15 - "calculations/page.tsx"
Cohesion: 0.07
Nodes (26): CancelRunButton(), CancelRunButtonProps, CalculationsPage(), CalculationsPageProps, formatDuration(), formatTimestamp(), statusConfig(), RetryCalculationButton() (+18 more)

### Community 16 - "app_database.dart"
Cohesion: 0.05
Nodes (38): DateTimeColumn get, int get, IntColumn get, attemptCount, createdAt, db, dbValue, deleteDraft (+30 more)

### Community 17 - "field-submissions/route.ts"
Cohesion: 0.19
Nodes (12): GET(), notifyReviewersOfSubmission(), Params, POST(), GET(), Params, PATCH(), calculateGpsDistanceKm() (+4 more)

### Community 18 - "cn"
Cohesion: 0.08
Nodes (25): cn(), TABS, Avatar, AvatarFallback, AvatarImage, DialogContent, DialogDescription, DialogFooter() (+17 more)

### Community 19 - "dependencies"
Cohesion: 0.06
Nodes (34): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, better-auth, class-variance-authority, clsx, firebase-admin, @hookform/resolvers (+26 more)

### Community 20 - "audit/page.tsx"
Cohesion: 0.09
Nodes (22): @DataClassName, AuditPage(), AuditPageProps, buildAuditWhere(), validDate(), DraftSubmissions, EDIT_ROLES, formatGbp() (+14 more)

### Community 21 - "barcode_scan_screen.dart"
Cohesion: 0.07
Nodes (30): BarcodeScanScreen, _BarcodeScanScreenState, build, _controller, createState, _detected, dispose, _onDetect (+22 more)

### Community 22 - "targets/page.tsx"
Cohesion: 0.12
Nodes (20): RecordDetailPage(), RecordDetailPageProps, REVIEW_LABELS, TargetsPage(), TargetsPageProps, DeleteInitiativeButton(), DeleteTargetButton(), CreateInitiativeForm() (+12 more)

### Community 23 - "pin_setup_screen.dart"
Cohesion: 0.06
Nodes (30): Color, build, _buildInviteEntry, _checkingSession, color, _continueWithInvite, createState, _currentInput (+22 more)

### Community 24 - "setup-actions.tsx"
Cohesion: 0.08
Nodes (16): OperationsSettingsPage(), OperationsSettingsPageProps, BusinessUnit, CURRENCY_OPTIONS, Facility, FactorLibrary, INDUSTRY_OPTIONS, labelise() (+8 more)

### Community 25 - "home_screen.dart"
Cohesion: 0.07
Nodes (29): ../auth/pin_lock_screen.dart, ColorScheme, build, _buildBody, _chipStyle, colorScheme, createState, _error (+21 more)

### Community 26 - "dashboard/page.tsx"
Cohesion: 0.09
Nodes (16): CalculationControls(), CalculationControlsProps, RunResult, RunStatus, CalculationRunsLive(), Props, Run, DashboardPage() (+8 more)

### Community 27 - "sync_service.dart"
Cohesion: 0.07
Nodes (28): dart:io, dart:math, any, _baseDelay, connectivity, _connectivitySub, _db, _describeDioError (+20 more)

### Community 28 - "requirePlatformMember"
Cohesion: 0.10
Nodes (20): GET(), POST(), Params, POST(), GET(), PATCH(), PatchOrgSchema, VALID_PLANS (+12 more)

### Community 29 - "report-frameworks.ts"
Cohesion: 0.12
Nodes (23): Params, POST(), validateReportSchema, csrdChecks, FRAMEWORK_VALIDATIONS, FrameworkCheck, FrameworkCheckResult, FrameworkValidation (+15 more)

### Community 30 - "field-app/page.tsx"
Cohesion: 0.10
Nodes (15): metadata, PAIN_POINTS, SCOPE_CATS, metadata, CAPTURE_STEPS, metadata, OCR_FIELDS, AnimateIn() (+7 more)

### Community 31 - "main.dart"
Cohesion: 0.11
Nodes (23): ConsumerState, ConsumerStatefulWidget, core/notifications/fcm_handler.dart, core/router/router.dart, core/theme/app_theme.dart, DashboardScreen, _DashboardScreenState, build (+15 more)

### Community 32 - "client.dart"
Cohesion: 0.08
Nodes (23): dart:async, Dio?, List, baseUrl, _client, _configuredBaseUrl, createApiClient, currentToken (+15 more)

### Community 33 - "router.dart"
Cohesion: 0.09
Nodes (21): ../api/client.dart, ../../features/auth/invite_screen.dart, ../../features/auth/pin_lock_screen.dart, ../../features/auth/pin_setup_screen.dart, ../../features/capture/capture_screen.dart, ../../features/dashboard/dashboard_screen.dart, ../../features/reports/reports_screen.dart, ../../features/submissions/home_screen.dart (+13 more)

### Community 34 - "palette.ts"
Cohesion: 0.13
Nodes (17): CategoryBar(), CategoryBarDatum, CategoryBarProps, ScopeDonut(), ScopeDonutDatum, ScopeDonutProps, SERIES, TrendLineDatum (+9 more)

### Community 35 - "fcm_handler.dart"
Cohesion: 0.09
Nodes (21): @pragma, dart:convert, addForegroundHandler, consumePendingNavigation, deregister, FcmHandler, _firebaseMessagingBackgroundHandler, _handleForeground (+13 more)

### Community 36 - "submission_detail_screen.dart"
Cohesion: 0.10
Nodes (21): ../../core/widgets/status_chip.dart, FieldSubmissionDetail, _buildCo2eCard, _buildEvidenceSection, _buildHeader, _buildReviewNote, createState, _detail (+13 more)

### Community 37 - "hero-section.tsx"
Cohesion: 0.11
Nodes (12): TRUST_ITEMS, CAPABILITIES, HOW_IT_WORKS, STATS, HeroSection(), LIVE_EVENTS, NAV_LINKS, WORDS (+4 more)

### Community 38 - "Flutter Mobile Dependencies (pubspec.yaml)"
Cohesion: 0.11
Nodes (21): Android Build Job (CI), Fix: build_runner for drift codegen, Fix: Gradle JVM OOM (-Xmx4G), Fix: JDK 17 for AGP 9.0.1, Fix: minSdk=23 for ML Kit + flutter_secure_storage, Fix: ML Kit OCR manifest metadata, Mobile Field Capture Flow, Field Submission Review & Approval Flow (+13 more)

### Community 39 - "invite_screen.dart"
Cohesion: 0.10
Nodes (20): ../../core/api/endpoints.dart, FormState, build, createState, dispose, _emailController, _errorMessage, _formKey (+12 more)

### Community 40 - "pin_lock_screen.dart"
Cohesion: 0.11
Nodes (19): ../../core/api/client.dart, build, createState, _error, _failedAttempts, _input, _key, _Keypad (+11 more)

### Community 41 - "members/page.tsx"
Cohesion: 0.12
Nodes (15): AssignmentRow, FieldWorkerAssignments(), FieldWorkerAssignmentsProps, SiteOption, WorkerOption, ActiveInviteLink, InviteLinkGenerator(), InviteLinkGeneratorProps (+7 more)

### Community 42 - "app_theme.dart"
Cohesion: 0.11
Nodes (18): static const Color, approvedBg, approvedFg, AppTheme, light, pendingBg, pendingFg, rejectedBg (+10 more)

### Community 43 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 44 - "validator.ts"
Cohesion: 0.12
Nodes (9): ParsedRow, ParseResult, parseSpreadsheet(), ALIAS_INDEX, FIELD_MAPPINGS, FieldMapping, SCOPE2_METHODS, ValidatedRow (+1 more)

### Community 45 - "AuthError"
Cohesion: 0.14
Nodes (13): buildBrandingCssVars(), OrgLayout(), OrgLayoutProps, CORE_ROLES, EXTENDED_VIEW_ROLES, getInitials(), NavGroup, NavItem (+5 more)

### Community 46 - "records/page.tsx"
Cohesion: 0.15
Nodes (10): BulkRecordActions(), BulkRecordActionsProps, DraftGroup, RecordsPage(), RecordsPageProps, REVIEW_LABELS, RecordEvidenceActions(), RecordEvidenceActionsProps (+2 more)

### Community 47 - "submissions-table.tsx"
Cohesion: 0.16
Nodes (13): STATUS_FILTERS, SubmissionsPage(), SubmissionsPageProps, BULK_ELIGIBLE, DOC_TYPE_LABELS, OrgMember, STATUS_CLASSES, STATUS_LABELS (+5 more)

### Community 48 - "CarbonSite Brand Identity"
Cohesion: 0.16
Nodes (16): Audit Package and Evidence Trail, CarbonSite Brand Identity, Construction Vehicle / Truck Illustration, Emissions Data Table Rows, CarbonSite Logo Mark — Green Triangle with Base Bar, Mobile App Icon — White Plant/Stamp on Green Background, Report / Published Document Panel, Construction Site Operations Emissions Dashboard (+8 more)

### Community 49 - "[submissionId]/review/route.ts"
Cohesion: 0.24
Nodes (12): bulkReviewSchema, Params, PATCH(), Params, PATCH(), ApprovableSubmission, approvalBlocker(), ApprovalIssue (+4 more)

### Community 50 - "submissions/[id]/page.tsx"
Cohesion: 0.15
Nodes (11): DISTANCE_SOURCE_LABELS, FormField, SubmissionEditActions(), SubmissionEditActionsProps, DOC_TYPE_LABELS, STATUS_CLASSES, STATUS_LABELS, SubmissionDetailPage() (+3 more)

### Community 51 - "import.ts"
Cohesion: 0.17
Nodes (11): FACTOR_VALUE_HEADERS, FactorCategory, FactorImportValidation, normalizeCell(), nullableText(), parseDecimal(), ParsedFactorRow, parseFactorWorkbook() (+3 more)

### Community 52 - "presignDownload"
Cohesion: 0.20
Nodes (9): ALLOWED, POST(), GET(), Params, GET(), GET(), BrandingPage(), BrandingPageProps (+1 more)

### Community 53 - "imports/page.tsx"
Cohesion: 0.16
Nodes (9): DeleteImportButton(), DeleteImportButtonProps, CreateImportForm(), CreateImportFormProps, Phase, TEMPLATE_KEYS, ImportsPage(), ImportsPageProps (+1 more)

### Community 54 - "Reporting & Standards Engine"
Cohesion: 0.14
Nodes (14): Calculation & Reporting Pipeline, Dashboard Dependency Map, Carbon Accounting Engine Pipeline (6 Steps), Geospatial & Transport Engine, Performance Requirements, PostGIS Spatial Requirements, Report Invariant: Report Total = Dashboard Total, Report Template: BREEAM Evidence Package (+6 more)

### Community 55 - "New Data Models Required (Contract, Project, Site, TenantBranding, etc.)"
Cohesion: 0.18
Nodes (14): RBAC: 15 Target Roles (Fluid Enterprise), Schema Gaps for Enterprise, Zero White-Label Capability (Gap), Contract Prisma Model, New Data Models Required (Contract, Project, Site, TenantBranding, etc.), Persona: Client Viewer (External, per contract), Platform Hierarchy (Platform→Tenant→BU→Contract→Project→Site), PlatformMembership Prisma Model (+6 more)

### Community 56 - "package:flutter/material.dart"
Cohesion: 0.16
Nodes (12): ConsumerWidget, features/sync/sync_service.dart, build, compact, status, _style, SubmissionStatusChip, isOnlineProvider (+4 more)

### Community 57 - "[runId]/page.tsx"
Cohesion: 0.19
Nodes (9): CalculationRunPage(), CalculationRunPageProps, formatTimestamp(), formatTonnes(), STATUS_CLASSES, STATUS_LABELS, Badge(), BadgeProps (+1 more)

### Community 58 - "embodied-carbon/page.tsx"
Cohesion: 0.18
Nodes (10): ALL_STAGES, EmbodiedCarbonForm(), Material, Period, Project, Props, Stage, EmbodiedCarbonPage() (+2 more)

### Community 59 - "embodied-carbon/engine.ts"
Cohesion: 0.19
Nodes (11): calculateEmbodiedCarbon(), EmbodiedCarbonInput, EmbodiedCarbonResult, LifecycleStage, MaterialGwpFactors, normaliseQuantity(), sumEmbodiedCarbon(), CONCRETE_FACTORS (+3 more)

### Community 60 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, eslint, eslint-config-next, prisma, tailwindcss, @tailwindcss/postcss, tsx, @types/node (+5 more)

### Community 61 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, dev, lint, postinstall, prisma, start, test (+5 more)

### Community 62 - "middleware.ts"
Cohesion: 0.23
Nodes (10): extractBearerToken(), POST(), POLICIES, rateLimit(), sweep(), clientIp(), config, extractSubdomain() (+2 more)

### Community 63 - "[contractId]/page.tsx"
Cohesion: 0.24
Nodes (8): ContractDetailPage(), contractStatusBadge(), EDIT_ROLES, formatCurrency(), formatDate(), formatTco2e(), projectStatusBadge(), Props

### Community 64 - "route-distance.ts"
Cohesion: 0.35
Nodes (9): calculateRoadRoute(), displayUkPostcode(), getOrCreatePostcodeGeocode(), getOrCreateRouteDistance(), hashRoute(), isLikelyUkPostcode(), normalizeUkPostcode(), RouteDistanceError (+1 more)

### Community 65 - "verify.ts"
Cohesion: 0.24
Nodes (10): baseEnv, BASE_REQUIRED, EnvironmentMode, EnvironmentVerification, EnvSource, hasMinimumSecretEntropy(), hasValue(), isHttpsUrl() (+2 more)

### Community 66 - "apply-vercel-env.ts"
Cohesion: 0.24
Nodes (9): entries, fail(), findExistingEnv(), main(), target, unresolved, upsertEnv(), VercelEnvTarget (+1 more)

### Community 67 - "snapshot-diff-modal.tsx"
Cohesion: 0.25
Nodes (8): PublishSnapshotButtonProps, DeltaCell(), DiffData, formatDeltaPercent(), formatTonnes(), ScopeDiff, SnapshotDiffModal(), SnapshotDiffModalProps

### Community 68 - "contracts/page.tsx"
Cohesion: 0.25
Nodes (8): ContractCo2eRow, ContractsPage(), contractStatusBadge(), EDIT_ROLES, formatCurrency(), formatDate(), formatTco2e(), Props

### Community 69 - "[token]/page.tsx"
Cohesion: 0.24
Nodes (7): InviteAcceptanceForm(), InviteState, MobileAppInvite(), MobileAppInviteProps, InvitePage(), InvitePageProps, isMobileUserAgent()

### Community 70 - "Remediation Plan (Sprint 0-6)"
Cohesion: 0.20
Nodes (11): Multi-Tenancy Gaps, OCR Architecture (Current + Gaps), Gap: No AI Waste Classification (EWC), Gap: No Web-Side OCR Pipeline, Remediation Plan (Sprint 0-6), SEC-01: No Cross-Tenant Regression Tests (P0), SEC-04: In-Memory Rate Limiting (not distributed), Security Gaps (cross-tenant, CSP, OSRM, rate-limit) (+3 more)

### Community 71 - "[projectId]/page.tsx"
Cohesion: 0.25
Nodes (7): EDIT_ROLES, formatDate(), ProjectDetailPage(), projectStatusBadge(), Props, CreateSiteForm(), DeleteSiteButton()

### Community 72 - "AppDelegate"
Cohesion: 0.20
Nodes (7): Any, Bool, FlutterAppDelegate, FlutterImplicitEngineBridge, FlutterImplicitEngineDelegate, AppDelegate, UIApplication

### Community 73 - "Technical Debt Register (25 items)"
Cohesion: 0.20
Nodes (10): Fluid Competitive Moat (field OCR + TOMS + PPN06-21 + white-label), DEFRA Carbon Engine Review, Gap: Only 38 Emission Factors Seeded, Gap: OSRM Public API (Data Leakage), Gap: Transport Postcodes to CO2e Not Automatic, National TOMS Framework, Social Value Engine: Not Implemented, Technical Debt Register (25 items) (+2 more)

### Community 74 - "tasks/page.tsx"
Cohesion: 0.33
Nodes (7): formatAge(), Props, STATUS_ORDER, statusBadge(), targetLink(), TasksPage(), typeLabel()

### Community 75 - "package.json"
Cohesion: 0.22
Nodes (8): engines, node, name, packageManager, prisma, seed, private, version

### Community 76 - "[webhookId]/route.ts"
Cohesion: 0.43
Nodes (7): ALLOWED_EVENTS, DELETE(), GET(), getWebhookOrThrow(), PATCH(), redactSecret(), updateWebhookSchema

### Community 77 - "(marketing)/layout.tsx"
Cohesion: 0.32
Nodes (4): NAV_LINKS, SiteNav(), COLS, SiteFooter()

### Community 78 - "upload-policy.ts"
Cohesion: 0.39
Nodes (6): ALLOWED_MIME_TYPE_SET, EVIDENCE_ACCEPT_ATTRIBUTE, EVIDENCE_ALLOWED_MIME_TYPES, isAllowedEvidenceMimeType(), isAllowedEvidenceSize(), normalizeMimeType()

### Community 79 - "client_test.dart"
Cohesion: 0.29
Nodes (5): main, main, package:carbonsite_mobile/core/api/client.dart, package:carbonsite_mobile/features/capture/ocr_extractor.dart, package:flutter_test/flutter_test.dart

### Community 80 - "Primary Evidence-to-Report Workflow"
Cohesion: 0.33
Nodes (7): Evidence First Principle, Evidence Management System, OCR Extraction Schema (OcrExtractionResult), OCR Learning Feedback Loop, OCR Confidence Review Workflow (green/amber/red), Primary Evidence-to-Report Workflow, Social Value Engine (National TOMS)

### Community 81 - "[projectId]/route.ts"
Cohesion: 0.47
Nodes (5): DELETE(), GET(), PATCH(), resolveProject(), updateProjectSchema

### Community 82 - "members/route.ts"
Cohesion: 0.40
Nodes (4): GET(), POST(), sendTransactionalEmail(), inviteMemberSchema

### Community 83 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): inter, metadata, MotionProvider()

### Community 84 - "Reporting Gaps (SECR/CSRD/PPN06-21 missing)"
Cohesion: 0.40
Nodes (6): Reporting Gaps (SECR/CSRD/PPN06-21 missing), Report Generation Workflow, NHS Evergreen Level 1 Submission, Persona: Auditor (External), PPN 06/21 Carbon Reduction Plan Compliance, Roadmap Phase 6: Dashboards, Reporting, Audit

### Community 85 - "comment-actions.tsx"
Cohesion: 0.40
Nodes (3): CommentActionsProps, Textarea, TextareaProps

### Community 86 - "[contractId]/route.ts"
Cohesion: 0.47
Nodes (5): DELETE(), GET(), PATCH(), resolveContract(), updateContractSchema

### Community 87 - "projects/route.ts"
Cohesion: 0.60
Nodes (4): GET(), POST(), resolveContract(), createProjectSchema

### Community 88 - "product/page.tsx"
Cohesion: 0.40
Nodes (3): metadata, ROLES, STAGES

### Community 89 - "resources/page.tsx"
Cohesion: 0.40
Nodes (3): EXT_LINKS, GUIDES, metadata

### Community 90 - "security/page.tsx"
Cohesion: 0.40
Nodes (3): CONTROLS, metadata, SEVERITY_STYLES

### Community 91 - "Field Evidence Capture SVG Diagram"
Cohesion: 0.50
Nodes (5): Mobile Field Evidence Capture Flow, Mobile Phone UI Frame, On-Device OCR Document Scanning, Submit Action Button, Field Evidence Capture SVG Diagram

### Community 92 - "health/route.ts"
Cohesion: 0.80
Nodes (4): checkAuthSchema(), checkDatabase(), formatError(), GET()

### Community 93 - "validator.test.ts"
Cohesion: 0.40
Nodes (3): BU_INDEX, CATEGORY_INDEX, FACILITY_INDEX

### Community 94 - "branding-actions.tsx"
Cohesion: 0.50
Nodes (3): FONT_OPTIONS, UpsertBrandingForm(), UpsertBrandingFormProps

### Community 95 - "CI Workflow (ci.yml)"
Cohesion: 0.50
Nodes (4): CI Workflow (ci.yml), Pending: No Content Security Policy, Pending: No integration tests in CI, Pending: No security scanning (CodeQL)

### Community 97 - "Route Distance and Evidence Review Map SVG"
Cohesion: 0.67
Nodes (4): Dark-Theme Data Summary Panel, Postcode Route Distance Evidence Review, Route Map with Start and End Points, Route Distance and Evidence Review Map SVG

### Community 99 - "boss.ts"
Cohesion: 0.67
Nodes (3): ensureBossStarted(), getBoss(), globalForBoss

### Community 101 - "fcm.ts"
Cohesion: 0.67
Nodes (3): getMessaging(), PushPayload, sendPushToUser()

### Community 106 - "vercel.json"
Cohesion: 0.50
Nodes (3): buildCommand, devCommand, framework

### Community 109 - "Fluid Enterprise Platform (target brand)"
Cohesion: 0.67
Nodes (3): CarbonSite MVP (current brand), Fluid Enterprise Platform (target brand), MVP vs Enterprise Gap Analysis

### Community 111 - "Job Processing Modes (inline vs worker)"
Cohesion: 0.67
Nodes (3): Failed Job Recovery (imports, calculations, reports), Job Processing Modes (inline vs worker), Worker Runtime Deployment (pg-boss)

### Community 112 - "Post-Release Smoke Test Checklist"
Cohesion: 1.00
Nodes (3): Post-Release Smoke Test Checklist, Production Health Check (GET /api/health), Vercel Release Runbook

### Community 159 - "[periodId]/route.ts"
Cohesion: 0.60
Nodes (4): GET(), PATCH(), resolvePeriod(), updateReportingPeriodSchema

## Knowledge Gaps
- **1005 isolated node(s):** `AuditPageProps`, `CalculationRunPageProps`, `STATUS_LABELS`, `STATUS_CLASSES`, `Props` (+1000 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Table` connect `audit/page.tsx` to `[runId]/page.tsx`, `targets/page.tsx`, `[projectId]/page.tsx`?**
  _High betweenness centrality (0.238) - this node is a cross-community bridge._
- **Why does `DraftSubmissions` connect `audit/page.tsx` to `app_database.dart`?**
  _High betweenness centrality (0.238) - this node is a cross-community bridge._
- **Why does `requireOrgMember()` connect `requireOrgMember` to `rateLimitRequest`, `session.ts`, `storage/index.ts`, `writeAuditLog`, `calculations/page.tsx`, `field-submissions/route.ts`, `audit/page.tsx`, `targets/page.tsx`, `setup-actions.tsx`, `dashboard/page.tsx`, `report-frameworks.ts`, `[periodId]/route.ts`, `members/page.tsx`, `AuthError`, `records/page.tsx`, `submissions-table.tsx`, `[submissionId]/review/route.ts`, `submissions/[id]/page.tsx`, `presignDownload`, `imports/page.tsx`, `[runId]/page.tsx`, `embodied-carbon/page.tsx`, `[contractId]/page.tsx`, `contracts/page.tsx`, `[projectId]/page.tsx`, `tasks/page.tsx`, `[webhookId]/route.ts`, `[projectId]/route.ts`, `members/route.ts`, `[contractId]/route.ts`, `projects/route.ts`?**
  _High betweenness centrality (0.200) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `requireOrgMember()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`requireOrgMember()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `writeAuditLog()` (e.g. with `PATCH()` and `DELETE()`) actually correct?**
  _`writeAuditLog()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `handleRouteError()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`handleRouteError()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AuditPageProps`, `CalculationRunPageProps`, `STATUS_LABELS` to the rest of the system?**
  _1005 weakly-connected nodes found - possible documentation gaps or missing edges._