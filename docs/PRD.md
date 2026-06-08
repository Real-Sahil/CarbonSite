# CarbonSite Product Requirements Document (PRD)

## 1. Product Summary

CarbonSite is a web application that helps organizations measure, understand, reduce, and report their greenhouse gas (GHG) emissions. The product centralizes activity data collection, carbon factor calculations, target tracking, reduction planning, and audit-ready reporting in one workflow.

This PRD assumes CarbonSite is intended for small-to-mid-market companies that need a practical sustainability operating system without the complexity or cost of enterprise environmental, social, and governance (ESG) platforms. If CarbonSite has a different intended audience, the scope should be adjusted before implementation begins.

## 2. Problem Statement

Organizations increasingly need credible carbon accounting for customer requests, investor diligence, internal sustainability goals, procurement requirements, and regulatory reporting. Many teams currently manage emissions data in spreadsheets, which creates fragmented data ownership, inconsistent emission factors, poor audit trails, and limited insight into reduction opportunities.

CarbonSite should solve this by providing a guided, traceable, and collaborative platform for collecting carbon-relevant activity data, calculating emissions, monitoring progress, and exporting reports.

## 3. Goals and Objectives

### 3.1 Business Goals

- Reduce the time required for a company to create an initial carbon inventory.
- Improve confidence in carbon calculations by using versioned methodology and emission factors.
- Enable recurring emissions tracking across months, quarters, and years.
- Support conversion from trial users to paid accounts through clear value in the first onboarding session.
- Create a foundation for future premium modules such as supplier engagement, scenario planning, and compliance-specific exports.

### 3.2 Product Goals

- Provide guided data intake for Scope 1, Scope 2, and selected Scope 3 emissions categories.
- Convert activity data into carbon dioxide equivalent (CO2e) with transparent calculation details.
- Show dashboards for total emissions, emissions by scope, emissions by source, and progress against targets.
- Allow teams to create reduction initiatives and estimate expected impact.
- Produce exportable reports suitable for internal leadership, customers, and auditors.

### 3.3 Non-Goals for Initial Release

- Carbon offset purchasing marketplace.
- Automated regulatory filing submission.
- Full life-cycle assessment for every product SKU.
- Real-time IoT metering integrations.
- Assurance or certification services performed by CarbonSite.

## 4. Target Users and Personas

### 4.1 Sustainability Manager

- Owns the annual carbon inventory and reduction roadmap.
- Needs reliable calculations, clear data gaps, and report exports.
- Values audit trails, methodological transparency, and collaboration workflows.

### 4.2 Finance or Operations Lead

- Provides utility, fuel, travel, logistics, and procurement data.
- Needs low-friction data upload and clear validation errors.
- Values minimal manual rework and clear ownership boundaries.

### 4.3 Executive Sponsor

- Reviews company emissions performance and approves reduction initiatives.
- Needs simple dashboards, trend lines, and target progress.
- Values confidence, strategic clarity, and board-ready reporting.

### 4.4 External Consultant or Auditor

- Reviews calculation logic, evidence files, and source data.
- Needs read-only workspace access and exportable calculation trails.
- Values data lineage, version history, and permissions.

## 5. User Journeys

### 5.1 First Carbon Inventory

1. User creates an organization workspace.
2. User selects reporting year, organizational boundaries, facilities, and operational regions.
3. User imports electricity, natural gas, vehicle fuel, business travel, and purchased goods activity data.
4. CarbonSite validates units, dates, required fields, and duplicate records.
5. CarbonSite calculates emissions using selected factor libraries and methodology versions.
6. User reviews dashboard, resolves flagged data gaps, and exports the inventory report.

### 5.2 Monthly Emissions Tracking

1. User opens the current reporting period.
2. User uploads monthly utility bills, fleet fuel records, and travel exports.
3. CarbonSite calculates month-over-month changes.
4. User reviews anomalies and assigns unresolved records to teammates.
5. User publishes the month-end emissions snapshot.

### 5.3 Reduction Planning

1. User identifies a high-emission source from the dashboard.
2. User creates a reduction initiative such as renewable energy procurement, fleet electrification, or reduced air travel.
3. User enters expected implementation date, cost, owner, and estimated activity reduction.
4. CarbonSite estimates expected CO2e reduction and tracks initiative status.
5. Executive sponsor reviews planned impact against company targets.

## 6. Functional Requirements

### 6.1 Account and Organization Management

- Users can register, sign in, sign out, and reset passwords.
- Users can create or join an organization workspace.
- Organizations can configure name, industry, headquarters country, reporting currency, fiscal year, and default units.
- Organizations can define facilities, business units, and reporting locations.

### 6.2 Role-Based Access Control

- Admins can manage users, billing, organization settings, and all data.
- Editors can upload data, edit records, create initiatives, and generate reports.
- Reviewers can comment, approve records, and export reports.
- Viewers can access dashboards and published reports without editing rights.
- External auditors can access read-only evidence, calculation details, and exports for assigned reporting periods.

### 6.3 Activity Data Collection

- Users can manually enter activity records.
- Users can upload CSV or XLSX files using category-specific templates.
- Users can map uploaded columns to CarbonSite fields.
- Users can attach supporting evidence such as invoices, utility bills, travel exports, and supplier declarations.
- Users can save import mappings for repeated uploads from the same source.

### 6.4 Emissions Categories

Initial release should support:

- Scope 1 stationary combustion.
- Scope 1 mobile combustion.
- Scope 1 fugitive emissions from refrigerants.
- Scope 2 purchased electricity using location-based calculations.
- Scope 2 purchased electricity using market-based calculations when renewable energy certificates or contractual instruments are provided.
- Scope 3 business travel.
- Scope 3 employee commuting.
- Scope 3 purchased goods and services using spend-based factors.
- Scope 3 upstream transportation and distribution using distance- or spend-based factors.

### 6.5 Calculation Engine

- System calculates CO2e from activity amount, activity unit, emission factor, factor unit, gas breakdown, global warming potential, and reporting period.
- System stores calculation input, factor version, methodology version, and calculation output for every record.
- System supports recalculation when records or factor versions change.
- System warns users before recalculating previously published reports.
- System shows a human-readable calculation explanation for each emissions record.

### 6.6 Data Quality and Validation

- System validates required fields, accepted units, date ranges, factor compatibility, and duplicate uploads.
- System flags records with missing evidence, unsupported units, extreme outliers, or unresolved assumptions.
- Users can mark assumptions with notes and reviewers.
- Users can approve, reject, or request changes on data records.

### 6.7 Dashboards and Analytics

- Dashboard shows total emissions for selected period.
- Dashboard shows emissions by scope, category, facility, business unit, region, and supplier where available.
- Dashboard supports trend comparisons across months, quarters, and years.
- Dashboard displays data completeness, unresolved validation issues, and review status.
- Dashboard allows filters by reporting period, organizational boundary, geography, and category.

### 6.8 Targets and Initiatives

- Users can create emissions targets with baseline year, target year, target type, and reduction amount.
- Users can create reduction initiatives with owner, status, cost, expected impact, implementation date, and notes.
- System estimates target progress using actual emissions and planned reductions.
- System displays initiative impact by scope and category.

### 6.9 Reporting and Exports

- Users can generate a carbon inventory report for a selected reporting period.
- Reports include organization profile, methodology summary, emissions totals, category breakdowns, data quality notes, assumptions, and calculation appendices.
- Users can export reports as PDF and CSV.
- Users can export raw activity data and calculation results for audit review.
- Reports are versioned when published.

### 6.10 Notifications and Collaboration

- Users can assign data requests or review tasks to teammates.
- System sends email notifications for assigned tasks, failed imports, review requests, and report publication.
- Users can comment on activity records, reports, and initiatives.
- System maintains an audit log of material data and configuration changes.

## 7. Non-Functional Requirements

### 7.1 Performance

- Dashboard initial load should complete within 3 seconds for organizations with up to 100,000 activity records.
- CSV imports up to 25,000 rows should process asynchronously and complete within 5 minutes under normal load.
- Report export generation should complete within 2 minutes for typical reporting periods.

### 7.2 Reliability

- Application should target 99.9% monthly uptime after production launch.
- Background jobs must be retryable and idempotent where practical.
- Failed imports and exports must surface actionable errors to users.

### 7.3 Security and Privacy

- All user traffic must use HTTPS.
- Passwords must be hashed using a modern password hashing algorithm.
- Sensitive evidence files must be stored encrypted at rest.
- Authorization checks must be enforced server-side for every organization-scoped resource.
- Audit logs must capture actor, action, timestamp, resource type, resource ID, and relevant before/after metadata.

### 7.4 Compliance and Auditability

- Calculation methodologies and factor versions must be traceable.
- Published reports must preserve point-in-time calculation outputs.
- The system should support common GHG Protocol terminology and reporting structure.
- Data retention policies should be configurable by organization tier in future releases.

### 7.5 Accessibility

- User-facing web interfaces should meet WCAG 2.1 AA standards where practical.
- Charts must provide textual summaries and accessible labels.
- Forms must include keyboard navigation, labels, validation messages, and focus states.

## 8. Key Screens

- Marketing landing page.
- Authentication pages.
- Organization onboarding wizard.
- Workspace dashboard.
- Activity data import center.
- Activity record detail page.
- Emissions category detail page.
- Targets and initiatives page.
- Report builder and report detail page.
- User and role management page.
- Settings and methodology configuration page.

## 9. Metrics and Success Criteria

- Time to first calculated inventory is less than 60 minutes for a guided sample organization.
- At least 80% of imports complete without engineering support.
- At least 90% of calculated records include traceable factor and methodology metadata.
- Trial users create at least one report or dashboard snapshot within the first 7 days.
- Monthly active organizations retain at least 70% after three reporting cycles.

## 10. Release Scope

### 10.1 Minimum Viable Product

- Authentication and organization workspace.
- Facility and business unit setup.
- CSV import for priority emissions categories.
- Calculation engine with factor versioning.
- Dashboard with totals and category breakdowns.
- Basic data validation and review states.
- PDF and CSV report exports.
- Role-based access control.

### 10.2 Post-MVP Enhancements

- Supplier data request portal.
- Advanced Scope 3 category coverage.
- Accounting, travel, utility, and procurement integrations.
- Scenario modeling and marginal abatement cost curves.
- Carbon offset marketplace or registry integration.
- Compliance-specific report templates.
- AI-assisted anomaly detection and reduction recommendations.

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Emission factor data is incomplete or outdated. | Incorrect or low-confidence calculations. | Use versioned factor libraries, expose assumptions, and support manual factor overrides with approval. |
| Users upload inconsistent data. | Poor inventory quality and support burden. | Provide templates, validation rules, saved mappings, and clear error messages. |
| Scope 3 complexity expands MVP too far. | Delayed launch. | Limit MVP to high-demand categories and clearly mark estimation methods. |
| Users expect certified assurance. | Misaligned expectations. | Position CarbonSite as software for preparation and audit support, not as a certification body. |
| Evidence files contain sensitive business data. | Security and privacy concerns. | Enforce encryption, organization isolation, access controls, and audit logging. |

## 12. Open Questions

- Which exact industries should MVP prioritize?
- Which emission factor datasets are licensed and approved for production use?
- Should CarbonSite support both calendar year and fiscal year reporting in MVP?
- Is billing required in the first production release?
- What report format is most important: internal executive report, customer disclosure, or auditor package?
- Should the system include sample data for onboarding demonstrations?
