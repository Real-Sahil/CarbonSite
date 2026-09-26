import type { CatalogueFramework, CatalogueRequirement } from "./types";

// HIPAA Security, Breach Notification and Privacy Rules (45 CFR Parts 160 and
// 164). Section references, standard and implementation specification names
// and their Required/Addressable status follow the eCFR text as of 23
// September 2026 (22 addressable specifications, so the 2025 proposed Security
// Rule changes were not in force). Guidance is MetricOra's own summary.

const ecfr = (section: string, para?: string) =>
  `https://www.ecfr.gov/current/title-45/section-${section}${para ? `#p-${section}${para}` : ""}`;

type Spec = [code: string, title: string, kind: "required" | "addressable", guidance: string];
type Standard = { code: string; section: string; para: string; title: string; guidance: string; specs?: Spec[]; hints?: string[] };

const SECURITY: Array<{ code: string; title: string; standards: Standard[] }> = [
  {
    code: "164.308",
    title: "Administrative safeguards",
    standards: [
      {
        code: "164.308(a)(1)",
        section: "164.308",
        para: "(a)(1)",
        title: "Security management process",
        guidance: "Policies and procedures to prevent, detect, contain and correct security violations.",
        specs: [
          ["164.308(a)(1)(ii)(A)", "Risk analysis", "required", "An accurate and thorough assessment of risks and vulnerabilities to the confidentiality, integrity and availability of electronic protected health information (ePHI)."],
          ["164.308(a)(1)(ii)(B)", "Risk management", "required", "Security measures that reduce the risks found to a reasonable and appropriate level."],
          ["164.308(a)(1)(ii)(C)", "Sanction policy", "required", "Sanctions against workforce members who fail to comply with security policies."],
          ["164.308(a)(1)(ii)(D)", "Information system activity review", "required", "Regular review of audit logs, access reports and security incident tracking."],
        ],
      },
      { code: "164.308(a)(2)", section: "164.308", para: "(a)(2)", title: "Assigned security responsibility", guidance: "Name the security official responsible for the security policies and procedures.", hints: ["Security officer appointment"] },
      {
        code: "164.308(a)(3)",
        section: "164.308",
        para: "(a)(3)",
        title: "Workforce security",
        guidance: "Make sure workforce members have appropriate access to ePHI and prevent those who should not from getting it.",
        specs: [
          ["164.308(a)(3)(ii)(A)", "Authorization and/or supervision", "addressable", "Authorise or supervise workforce members who work with ePHI."],
          ["164.308(a)(3)(ii)(B)", "Workforce clearance procedure", "addressable", "Decide whether each person's access is appropriate."],
          ["164.308(a)(3)(ii)(C)", "Termination procedures", "addressable", "Remove access when employment or engagement ends."],
        ],
      },
      {
        code: "164.308(a)(4)",
        section: "164.308",
        para: "(a)(4)",
        title: "Information access management",
        guidance: "Authorise access to ePHI consistently with the Privacy Rule.",
        specs: [
          ["164.308(a)(4)(ii)(A)", "Isolating health care clearinghouse functions", "required", "A clearinghouse that is part of a larger organisation protects its ePHI from the rest of it."],
          ["164.308(a)(4)(ii)(B)", "Access authorization", "addressable", "Policies for granting access to workstations, programs and processes."],
          ["164.308(a)(4)(ii)(C)", "Access establishment and modification", "addressable", "Establish, document, review and modify each user's access."],
        ],
      },
      {
        code: "164.308(a)(5)",
        section: "164.308",
        para: "(a)(5)",
        title: "Security awareness and training",
        guidance: "A security awareness and training programme for the whole workforce, including management.",
        specs: [
          ["164.308(a)(5)(ii)(A)", "Security reminders", "addressable", "Periodic security updates to staff."],
          ["164.308(a)(5)(ii)(B)", "Protection from malicious software", "addressable", "Guard against, detect and report malicious software."],
          ["164.308(a)(5)(ii)(C)", "Log-in monitoring", "addressable", "Monitor log-in attempts and report discrepancies."],
          ["164.308(a)(5)(ii)(D)", "Password management", "addressable", "Create, change and safeguard passwords."],
        ],
      },
      {
        code: "164.308(a)(6)",
        section: "164.308",
        para: "(a)(6)",
        title: "Security incident procedures",
        guidance: "Policies to address security incidents.",
        specs: [["164.308(a)(6)(ii)", "Response and reporting", "required", "Identify and respond to suspected or known incidents, mitigate harmful effects, and document incidents and outcomes."]],
      },
      {
        code: "164.308(a)(7)",
        section: "164.308",
        para: "(a)(7)",
        title: "Contingency plan",
        guidance: "Respond to emergencies that damage systems containing ePHI.",
        specs: [
          ["164.308(a)(7)(ii)(A)", "Data backup plan", "required", "Create and keep retrievable exact copies of ePHI."],
          ["164.308(a)(7)(ii)(B)", "Disaster recovery plan", "required", "Procedures to restore any loss of data."],
          ["164.308(a)(7)(ii)(C)", "Emergency mode operation plan", "required", "Keep critical business processes running and protect ePHI during an emergency."],
          ["164.308(a)(7)(ii)(D)", "Testing and revision procedures", "addressable", "Test and revise contingency plans periodically."],
          ["164.308(a)(7)(ii)(E)", "Applications and data criticality analysis", "addressable", "Assess how critical specific applications and data are."],
        ],
      },
      { code: "164.308(a)(8)", section: "164.308", para: "(a)(8)", title: "Evaluation", guidance: "Periodic technical and non-technical evaluation of how well security policies meet the rule, including after environmental or operational changes.", hints: ["Annual security evaluation report"] },
      {
        code: "164.308(b)(1)",
        section: "164.308",
        para: "(b)(1)",
        title: "Business associate contracts and other arrangements",
        guidance: "Obtain satisfactory assurances from business associates that they will safeguard ePHI.",
        specs: [["164.308(b)(3)", "Written contract or other arrangement", "required", "Document the assurances in a contract that meets 164.314(a)."]],
      },
    ],
  },
  {
    code: "164.310",
    title: "Physical safeguards",
    standards: [
      {
        code: "164.310(a)(1)",
        section: "164.310",
        para: "(a)(1)",
        title: "Facility access controls",
        guidance: "Limit physical access to information systems and the facilities they are in.",
        specs: [
          ["164.310(a)(2)(i)", "Contingency operations", "addressable", "Allow facility access to restore data in an emergency."],
          ["164.310(a)(2)(ii)", "Facility security plan", "addressable", "Safeguard the facility and equipment from unauthorised access, tampering and theft."],
          ["164.310(a)(2)(iii)", "Access control and validation procedures", "addressable", "Control and validate people's access based on role, including visitors."],
          ["164.310(a)(2)(iv)", "Maintenance records", "addressable", "Document repairs and changes to physical security components."],
        ],
      },
      { code: "164.310(b)", section: "164.310", para: "(b)", title: "Workstation use", guidance: "Specify the proper functions and physical surroundings of workstations that access ePHI." },
      { code: "164.310(c)", section: "164.310", para: "(c)", title: "Workstation security", guidance: "Physical safeguards restricting workstation access to authorised users." },
      {
        code: "164.310(d)(1)",
        section: "164.310",
        para: "(d)(1)",
        title: "Device and media controls",
        guidance: "Control the receipt and removal of hardware and media containing ePHI.",
        specs: [
          ["164.310(d)(2)(i)", "Disposal", "required", "Securely dispose of ePHI and the hardware or media holding it."],
          ["164.310(d)(2)(ii)", "Media re-use", "required", "Remove ePHI before media is reused."],
          ["164.310(d)(2)(iii)", "Accountability", "addressable", "Record movements of hardware and media and who is responsible."],
          ["164.310(d)(2)(iv)", "Data backup and storage", "addressable", "Create a retrievable copy of ePHI before moving equipment."],
        ],
      },
    ],
  },
  {
    code: "164.312",
    title: "Technical safeguards",
    standards: [
      {
        code: "164.312(a)(1)",
        section: "164.312",
        para: "(a)(1)",
        title: "Access control",
        guidance: "Technical controls allowing only authorised people and software to access ePHI.",
        specs: [
          ["164.312(a)(2)(i)", "Unique user identification", "required", "Assign each user a unique identifier."],
          ["164.312(a)(2)(ii)", "Emergency access procedure", "required", "Obtain necessary ePHI during an emergency."],
          ["164.312(a)(2)(iii)", "Automatic logoff", "addressable", "End sessions after a period of inactivity."],
          ["164.312(a)(2)(iv)", "Encryption and decryption", "addressable", "Encrypt and decrypt ePHI."],
        ],
      },
      { code: "164.312(b)", section: "164.312", para: "(b)", title: "Audit controls", guidance: "Record and examine activity in systems that contain or use ePHI.", hints: ["Audit logging", "Log review records"] },
      {
        code: "164.312(c)(1)",
        section: "164.312",
        para: "(c)(1)",
        title: "Integrity",
        guidance: "Protect ePHI from improper alteration or destruction.",
        specs: [["164.312(c)(2)", "Mechanism to authenticate electronic protected health information", "addressable", "Corroborate that ePHI has not been altered or destroyed improperly."]],
      },
      { code: "164.312(d)", section: "164.312", para: "(d)", title: "Person or entity authentication", guidance: "Verify that people and systems seeking access are who they claim to be.", hints: ["MFA configuration"] },
      {
        code: "164.312(e)(1)",
        section: "164.312",
        para: "(e)(1)",
        title: "Transmission security",
        guidance: "Guard against unauthorised access to ePHI sent over networks.",
        specs: [
          ["164.312(e)(2)(i)", "Integrity controls", "addressable", "Ensure transmitted ePHI is not improperly modified without detection."],
          ["164.312(e)(2)(ii)", "Encryption", "addressable", "Encrypt ePHI in transit whenever appropriate."],
        ],
      },
    ],
  },
  {
    code: "164.314 and 164.316",
    title: "Organizational requirements; policies, procedures and documentation",
    standards: [
      { code: "164.314(a)", section: "164.314", para: "(a)", title: "Business associate contracts or other arrangements", guidance: "Business associate contracts contain the required security terms, including reporting of security incidents and breaches." },
      { code: "164.314(b)", section: "164.314", para: "(b)", title: "Requirements for group health plans", guidance: "Group health plan documents require the plan sponsor to safeguard ePHI (applies to group health plans only)." },
      { code: "164.316(a)", section: "164.316", para: "(a)", title: "Policies and procedures", guidance: "Implement reasonable and appropriate policies and procedures to comply with the Security Rule." },
      {
        code: "164.316(b)(1)",
        section: "164.316",
        para: "(b)(1)",
        title: "Documentation",
        guidance: "Keep written records of policies, procedures, actions and assessments.",
        specs: [
          ["164.316(b)(2)(i)", "Time limit", "required", "Retain documentation for six years from creation or when last in effect, whichever is later."],
          ["164.316(b)(2)(ii)", "Availability", "required", "Make documentation available to those responsible for implementing it."],
          ["164.316(b)(2)(iii)", "Updates", "required", "Review documentation periodically and update it after changes."],
        ],
      },
    ],
  },
];

const BREACH: Array<[string, string, string]> = [
  ["164.404", "Notification to individuals", "Notify affected individuals of a breach of unsecured PHI without unreasonable delay and within 60 days of discovery."],
  ["164.406", "Notification to the media", "For a breach affecting more than 500 residents of a State or jurisdiction, notify prominent media outlets there."],
  ["164.408", "Notification to the Secretary", "Notify HHS: within 60 days for 500 or more individuals; otherwise log and report within 60 days after the end of the calendar year."],
  ["164.410", "Notification by a business associate", "Business associates notify the covered entity of a breach without unreasonable delay and within 60 days of discovery."],
  ["164.414", "Burden of proof", "Be able to show that all required notifications were made, or that an incident was not a breach (a documented risk assessment)."],
];

const PRIVACY: Array<[string, string, string]> = [
  ["164.502", "Uses and disclosures of protected health information: General rules", "Use and disclose PHI only as the Privacy Rule permits or requires, applying the minimum necessary standard."],
  ["164.504(e)", "Business associate contracts", "Contracts with business associates contain the Privacy Rule's required terms."],
  ["164.508", "Uses and disclosures for which an authorization is required", "Obtain valid written authorisation for uses and disclosures not otherwise permitted, such as most marketing."],
  ["164.520", "Notice of privacy practices for protected health information", "Provide and post a notice of privacy practices describing uses, disclosures and individuals' rights."],
  ["164.522", "Rights to request privacy protection for protected health information", "Handle requests for restrictions and confidential communications."],
  ["164.524", "Access of individuals to protected health information", "Give individuals access to and copies of their PHI, generally within 30 days."],
  ["164.526", "Amendment of protected health information", "Handle requests to amend PHI."],
  ["164.528", "Accounting of disclosures of protected health information", "Provide an accounting of certain disclosures on request."],
  ["164.530", "Administrative requirements", "Privacy official, workforce training, safeguards, complaints process, sanctions, mitigation, no retaliation, policies and documentation."],
];

function build(): CatalogueRequirement[] {
  const reqs: CatalogueRequirement[] = [{ code: "Security Rule", title: "Security Rule (45 CFR 164 Subpart C)" }];
  for (const part of SECURITY) {
    reqs.push({ code: part.code, parent: "Security Rule", title: part.title });
    for (const s of part.standards) {
      reqs.push({ code: s.code, parent: part.code, title: s.title, guidance: s.specs?.length ? undefined : s.guidance, evidenceHints: s.hints, url: ecfr(s.section, s.para) });
      for (const [code, title, kind, guidance] of s.specs ?? []) {
        reqs.push({
          code,
          parent: s.code,
          title: `${title} (${kind === "required" ? "Required" : "Addressable"})`,
          guidance: kind === "addressable" ? `${guidance} Addressable: implement it, or document why it is not reasonable and appropriate and what you do instead.` : guidance,
          tags: [`spec:${kind}`],
          url: ecfr(s.section),
        });
      }
    }
  }
  reqs.push({ code: "Breach Notification Rule", title: "Breach Notification Rule (45 CFR 164 Subpart D)" });
  for (const [code, title, guidance] of BREACH) reqs.push({ code, parent: "Breach Notification Rule", title, guidance, url: ecfr(code) });
  reqs.push({ code: "Privacy Rule", title: "Privacy Rule (45 CFR 164 Subpart E)" });
  for (const [code, title, guidance] of PRIVACY) reqs.push({ code, parent: "Privacy Rule", title, guidance, url: ecfr(code.replace(/\(.*$/, "")) });
  return reqs;
}

export const hipaa: CatalogueFramework = {
  slug: "hipaa",
  name: "HIPAA Security, Privacy and Breach Notification Rules",
  shortName: "HIPAA",
  edition: "45 CFR Parts 160 and 164 (eCFR, 23 September 2026)",
  publisher: "US Department of Health and Human Services",
  family: "healthcare",
  jurisdiction: "United States",
  summary: "US rules for covered entities and business associates handling protected health information: administrative, physical and technical safeguards, breach notification and privacy duties.",
  sourceUrl: "https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164",
  contentBasis: "references",
  contentNote:
    "Section references and the names of standards and implementation specifications as they appear in the eCFR, with MetricOra's own summary, which is not legal advice. Each requirement links to the eCFR text, which governs.",
  certifiable: false,
  tagLabels: { "spec:required": "Required specifications", "spec:addressable": "Addressable specifications" },
  requirements: build(),
};
