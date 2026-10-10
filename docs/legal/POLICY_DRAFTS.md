# Policy drafts for solicitor review

Status: **draft, not published.** Nothing here is live on the marketing site or in `SECURITY.md` until a UK solicitor has reviewed it and the owner has approved the wording. Placeholders in `[square brackets]` need a real value first. This is a drafting aid, not legal advice.

Each section says what it replaces or adds, so the reviewer can see the change against the live pages.

---

## 1. AI use statement (new page: `/ai`, linked from Privacy and the footer)

**What AI does in MetricOra.** MetricOra uses large language models in three places, and only when an organisation's administrator has switched on AI assistance under Settings → AI assistance:

- Drafting report wording (executive summary, key findings) that the reporting team then reviews and edits.
- Explaining what changed between two periods in plain English.
- Suggesting a category for an accounting line, where no rule matched. (Current build: the category suggestion is deterministic, not model-based. Confirm before publishing this bullet.)

**What is sent.** The model receives the figures for the period being written about, and the document text needed for the task. It does not receive the organisation's name, individual people's names or contact details. Requests go to Groq (USA) first and to Mistral AI (EU) as a fallback. Neither provider is permitted to train on the data sent. [Confirm each provider's current data-processing terms before publishing.]

**What the model does not do.** The model never supplies a figure. Any number in generated text must match a number MetricOra supplied, or the draft is rejected. Generated wording is labelled "AI-assisted" in the report and on screen.

**What you must check.** AI wording can be wrong or incomplete. A person must review and approve any AI-assisted text before it is published or sent to a third party. MetricOra does not make decisions about regulatory compliance, and the model is not a source of regulatory advice.

**Turning it off.** Assistance is off by default. An administrator can switch it off at any time, and the calls stop immediately.

---

## 2. Calculation disclaimer (replaces Terms section 4)

**Current text problem.** The live Terms list SustainMetrics among the factor sources and refer to DEFRA 2025 only. The repository does not load SustainMetrics, and the current DEFRA library is 2026.1. **Correct this before the next Terms release** whatever else is decided.

**Proposed text:**

4. **Emission factors and calculations**

4.1 MetricOra calculates emissions from the activity data you enter or import, using emission factors from the libraries shown on each report (currently DEFRA, EPA, ADEME, Australian NGA, Environment and Climate Change Canada, Umweltbundesamt, SEAI, EPA USEEIO and Defra UK spend multipliers, as listed in the calculation trail). Each figure states the library, methodology version and factor used.

4.2 Calculations follow the methodology and versioned rules stated in the product. They are estimates based on published factors. They are not a measurement of your actual emissions, and they carry uncertainty.

4.3 MetricOra is a record-keeping and calculation tool. It is **not**:
- an assurance, audit or verification service;
- a regulatory filing service, and it does not submit anything to a government body;
- a determination that you comply with any law, including the Streamlined Energy and Carbon Reporting regulations, the Companies Act, the EU Corporate Sustainability Reporting Directive, California SB 253 or SB 261, or any other reporting rule; or
- professional environmental, accounting, legal or waste-management advice.

4.4 You are responsible for the data you enter, for checking each figure before you rely on or publish it, and for deciding whether a report meets your obligations. Where the platform shows that evidence is missing or that a record was not checked, that is a prompt for you to act, not a statement that the record is wrong or right.

4.5 Factor libraries, methodologies and third-party data (including postcode, address, company and public register lookups) are provided as published by their owners. We do not warrant that they are complete or current, and we may change them as sources change. Where a figure depends on a factor or a register result that has changed, we will say so in the change log.

4.6 Waste, permit, carrier and company checks show what a public register returned at the time of the check. They do not confirm that a carrier, operator or permit is lawful, and you must check the details yourself.

---

## 3. Vulnerability disclosure and safe harbour (add to `SECURITY.md`)

**Reporting a vulnerability.** Please report security issues to **[security contact email, to be confirmed]**. Include the affected URL or feature, steps to reproduce, and the impact you believe it has. Do not include real customer data in a report; use a test organisation you control.

**Our commitments.** We will acknowledge a report within **[2 working days]**, keep you informed of progress, and credit you if you wish. We will tell you when a fix is released.

**Good-faith research.** We will not take legal action against, and will not ask law enforcement to act against, anyone who:
- tests only accounts and organisations they own or have written permission to test;
- avoids privacy violations, data destruction and service disruption, and stops and reports as soon as they access another person's data;
- does not use automated scanning at a rate that affects other users (for example, no more than [N] requests per second); and
- gives us a reasonable chance to fix the issue before publishing details.

This is not permission to test our production service beyond the above. Denial-of-service testing, social engineering of staff and physical attacks are out of scope.

**Scope.** The web application, the public API and the field app. Third-party services (Vercel, Supabase, Resend, Stripe and the public registers) are out of scope; report them to their owners.

---

## 4. Data retention schedule (replaces the current table in Privacy section 4)

The current table is incomplete and in places vague ("5 years, anonymised after Phase 5" is a roadmap note, not a retention rule). Proposed schedule, with the items marked **confirm** needing the owner's decision:

| Data | Retention | Basis | Deleted or anonymised by |
|---|---|---|---|
| Account details | Life of the account, then 30 days after closure | Contract | Account closure request, or the scheduled job [confirm the job exists] |
| Activity records and calculations | 7 years after the period ends | Customer's reporting and audit needs; set in Terms | Customer deletion or closure; the retention job [confirm] |
| Evidence files (bills, tickets, photographs) | Same as the record they support | As above | As above |
| Audit log | [5 years], then the personal fields are removed and the hash chain is kept | Security and accountability | Scheduled anonymisation [confirm it is built; it is not yet] |
| Backups | Daily dumps 35 days; monthly dumps [12 months, confirm] | Recovery | Automatic pruning in `backup.yml` |
| Sessions | 7 days (web) | Security | Expiry |
| Field-worker names and PINs | Life of the invitation and assignment, then removed | Contract | Removal on unassignment [confirm] |
| Health and safety data (incidents, toolbox talk attendance) | [Confirm retention period with the customer's legal basis; often 3 years or longer under HSE rules] | Legal obligation or legitimate interest | Customer-controlled; see the DPA addendum |
| Support emails and marketing contact | [12 months] / until withdrawal | Legitimate interest / consent | [Confirm] |

Also state what happens to data after a DSAR erasure request: the data is deleted from live systems and from backups when those backups expire, and the audit record that the request was made is kept.

---

## 5. Special category and sensitive data (DPA addendum)

**Why this matters.** The product can hold personal data about people's health and safety. Examples: names of toolbox-talk attendees with signatures, incident reports that describe injuries, RIDDOR reports, and hazard reports that name individuals. Some of this is special category data under UK GDPR Article 9 (health). Attendance records can also reveal health information.

**Proposed addendum text:**

1. The Customer decides what it records in these registers and is responsible for having a lawful basis and any condition under Article 9 that applies, for example the employment and health and safety condition under the Data Protection Act 2018, Schedule 1.
2. The Customer must not record more detail than the purpose requires. Incident and hazard entries should describe the event, not diagnose anyone.
3. MetricOra stores this data encrypted in transit and at rest, restricts it to the roles the Customer sets, and records access and changes in the audit log.
4. On the Customer's instruction, MetricOra will delete or export these records, including from backups as they expire.
5. Notices and photographs must not include people who have not agreed to appear. The product states this at the point of entry.

**Confirm with a solicitor:** whether a separate DPIA is needed for the field app, and whether the Customer or MetricOra is the controller for the health and safety registers.

---

## 6. Process notes for the owner

- **Changing the Terms** means bumping `TERMS_VERSION` in `lib/legal/terms.ts`. Every account is then sent to `/accept-terms` once. Do this for any change customers would reasonably care about, not for typos.
- **Insurance and liability cap.** The Terms already cap liability (section 6). Confirm the cap amount and whether it covers the customer's own losses from the Terms' carve-outs, with your insurance broker. Professional indemnity and cyber cover are commercial decisions, not drafting ones.
- **Before publishing:** solicitor review of sections 1 to 5; the owner approves the placeholders; then edit `app/(marketing)/terms`, `privacy`, `dpa` and add `/ai` and the security disclosure text to `SECURITY.md`.
