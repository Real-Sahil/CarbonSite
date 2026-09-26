import type { CatalogueFramework, CatalogueRequirement } from "./types";

// CCPA (as amended by the CPRA), PIPEDA and the NIS2 Directive. Section and
// article references and titles follow the official texts (California
// Legislative Information, Justice Laws Website, EUR-Lex) checked on 26
// September 2026; guidance is MetricOra's own summary and links to the text.

const NOTE =
  "Official section or article references with MetricOra's own summary of each obligation, which is not legal advice. Each requirement links to the official text, which governs.";

const ccpaUrl = (s: string) => `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=${s}`;

const CCPA_SECTIONS: Array<[string, string, string, string[]?]> = [
  ["1798.100", "General duties of businesses that collect personal information", "Give notice at or before collection (categories, purposes, whether sold or shared, retention), collect only what is reasonably necessary and proportionate, and put required terms in contracts with third parties, service providers and contractors.", ["Notice at collection", "Retention periods by category", "Contract terms"]],
  ["1798.105", "Consumers' right to delete personal information", "Delete personal information on a verified request, and direct service providers and contractors to delete it, unless an exception applies.", ["Deletion procedure"]],
  ["1798.106", "Consumers' right to correct inaccurate personal information", "Correct inaccurate personal information on a verified request using commercially reasonable efforts."],
  ["1798.110", "Consumers' right to know what personal information is being collected; right to access personal information", "Disclose the categories and specific pieces of personal information collected, sources, purposes and recipients on a verified request.", ["Access request procedure"]],
  ["1798.115", "Consumers' right to know what personal information is sold or shared and to whom", "Disclose the categories sold or shared and the categories of third parties, on request."],
  ["1798.120", "Consumers' right to opt out of sale or sharing of personal information", "Stop selling or sharing (for cross-context behavioural advertising) when a consumer opts out; opt-in is needed for consumers under 16.", ["Do Not Sell or Share mechanism"]],
  ["1798.121", "Consumers' right to limit use and disclosure of sensitive personal information", "Limit use of sensitive personal information to permitted purposes when a consumer asks.", ["Limit the Use of My Sensitive Personal Information link or alternative"]],
  ["1798.125", "Consumers' right of no retaliation following opt out or exercise of other rights", "Do not deny goods, charge different prices or reduce service because someone exercised their rights; financial incentives need notice and opt-in."],
  ["1798.130", "Notice, disclosure, correction, and deletion requirements", "Provide at least two methods for requests (including a toll-free number unless online-only), respond within 45 days, verify identity and train staff who handle requests.", ["Request intake methods", "Response log", "Staff training"]],
  ["1798.135", "Methods of limiting sale, sharing, and use of personal information and use of sensitive personal information", "Provide the required opt-out links or honour opt-out preference signals such as Global Privacy Control.", ["Opt-out links", "Global Privacy Control handling"]],
  ["1798.150", "Personal information security breaches", "Consumers may sue over breaches caused by failure to maintain reasonable security procedures and practices, so implement and document them.", ["Information security programme"]],
  ["1798.185", "Regulations", "The California Privacy Protection Agency's regulations add detailed rules, including risk assessments, cybersecurity audits and automated decision-making technology, with phased compliance dates. Check the current regulations.", ["Risk assessments", "Cybersecurity audit plan"]],
];

export const ccpa: CatalogueFramework = {
  slug: "ccpa-cpra",
  name: "California Consumer Privacy Act",
  shortName: "CCPA",
  edition: "As amended by the California Privacy Rights Act (Civil Code 1798.100 onwards)",
  publisher: "State of California",
  family: "privacy",
  jurisdiction: "California, United States",
  summary: "California's consumer privacy law for businesses above its revenue or data-volume thresholds: notice, rights to know, delete, correct and opt out, limits on sensitive data, and reasonable security.",
  sourceUrl: "https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=CIV&division=3.&title=1.81.5.&part=4.",
  contentBasis: "references",
  contentNote: NOTE,
  certifiable: false,
  requirements: CCPA_SECTIONS.map(([code, title, guidance, hints]): CatalogueRequirement => ({ code, title, guidance, evidenceHints: hints, url: ccpaUrl(code) })),
};

const PIPEDA_URL = "https://laws-lois.justice.gc.ca/eng/acts/P-8.6/FullText.html";

export const pipeda: CatalogueFramework = {
  slug: "pipeda",
  name: "Personal Information Protection and Electronic Documents Act",
  shortName: "PIPEDA",
  edition: "S.C. 2000, c. 5, with Schedule 1 principles",
  publisher: "Parliament of Canada",
  family: "privacy",
  jurisdiction: "Canada (federal)",
  summary: "Canada's federal private-sector privacy law: the ten fair information principles of Schedule 1 and mandatory reporting of breaches of security safeguards.",
  sourceUrl: PIPEDA_URL,
  contentBasis: "references",
  contentNote: NOTE,
  certifiable: false,
  requirements: [
    { code: "Sch. 1", title: "Schedule 1: Principles" },
    ...(
      [
        ["4.1", "Principle 1: Accountability", "Designate someone accountable for compliance and protect information transferred to third parties by contract."],
        ["4.2", "Principle 2: Identifying Purposes", "Identify the purposes for collection at or before the time of collection."],
        ["4.3", "Principle 3: Consent", "Obtain meaningful consent for collection, use and disclosure, except where the Act says otherwise."],
        ["4.4", "Principle 4: Limiting Collection", "Collect only what is necessary for the identified purposes, by fair and lawful means."],
        ["4.5", "Principle 5: Limiting Use, Disclosure, and Retention", "Use and disclose only for the identified purposes and keep information only as long as needed."],
        ["4.6", "Principle 6: Accuracy", "Keep information as accurate, complete and up to date as the purposes require."],
        ["4.7", "Principle 7: Safeguards", "Protect personal information with security safeguards appropriate to its sensitivity."],
        ["4.8", "Principle 8: Openness", "Make information about your privacy policies and practices readily available."],
        ["4.9", "Principle 9: Individual Access", "Give individuals access to their information on request and let them challenge its accuracy."],
        ["4.10", "Principle 10: Challenging Compliance", "Let individuals challenge your compliance through a complaint procedure."],
      ] as const
    ).map(([code, title, guidance]): CatalogueRequirement => ({ code, parent: "Sch. 1", title, guidance, url: PIPEDA_URL })),
    { code: "Breaches", title: "Breaches of security safeguards" },
    { code: "s. 10.1", parent: "Breaches", title: "Report to Commissioner and notify individuals", guidance: "Report breaches that create a real risk of significant harm to the Privacy Commissioner and notify affected individuals as soon as feasible.", evidenceHints: ["Breach response procedure"], url: PIPEDA_URL },
    { code: "s. 10.3", parent: "Breaches", title: "Records of breaches", guidance: "Keep a record of every breach of security safeguards (the regulations require 24 months) and provide it to the Commissioner on request.", evidenceHints: ["Breach register"], url: PIPEDA_URL },
  ],
};

const nis2Url = (a: string) => `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32022L2555#art_${a}`;

export const nis2: CatalogueFramework = {
  slug: "nis2",
  name: "NIS2 Directive",
  shortName: "NIS2",
  edition: "Directive (EU) 2022/2555",
  publisher: "European Union",
  family: "cyber",
  jurisdiction: "European Union (through each member state's law)",
  summary: "EU cybersecurity law for essential and important entities in listed sectors: management accountability, risk-management measures, incident reporting and supply chain security. Applies through each member state's transposing law.",
  sourceUrl: "https://eur-lex.europa.eu/eli/dir/2022/2555/oj",
  contentBasis: "references",
  contentNote: `${NOTE} The obligations reach you through the national law of each member state you operate in, which may add detail.`,
  certifiable: false,
  requirements: [
    { code: "Art. 20", title: "Governance", guidance: "Management bodies approve the cybersecurity risk-management measures, oversee them, can be held liable, and follow training.", evidenceHints: ["Board approval of measures", "Management training records"], url: nis2Url("20") },
    { code: "Art. 21", title: "Cybersecurity risk-management measures" },
    ...(
      [
        ["21(2)(a)", "Policies on risk analysis and information system security"],
        ["21(2)(b)", "Incident handling"],
        ["21(2)(c)", "Business continuity, such as backup management and disaster recovery, and crisis management"],
        ["21(2)(d)", "Supply chain security"],
        ["21(2)(e)", "Security in network and information systems acquisition, development and maintenance, including vulnerability handling and disclosure"],
        ["21(2)(f)", "Policies and procedures to assess the effectiveness of cybersecurity risk-management measures"],
        ["21(2)(g)", "Basic cyber hygiene practices and cybersecurity training"],
        ["21(2)(h)", "Policies and procedures regarding the use of cryptography and, where appropriate, encryption"],
        ["21(2)(i)", "Human resources security, access control policies and asset management"],
        ["21(2)(j)", "Multi-factor or continuous authentication, secured voice, video and text communications and secured emergency communications"],
      ] as const
    ).map(([code, title]): CatalogueRequirement => ({
      code: `Art. ${code}`,
      parent: "Art. 21",
      title,
      guidance: "One of the minimum measures every entity takes, proportionate to its size, risk exposure and the likely impact of incidents. Record how you meet it.",
      url: nis2Url("21"),
    })),
    {
      code: "Art. 23",
      title: "Reporting obligations",
      guidance: "Report significant incidents to the CSIRT or competent authority: an early warning within 24 hours, an incident notification within 72 hours and a final report within one month; inform service recipients where appropriate.",
      evidenceHints: ["Incident reporting procedure with the national contact point"],
      url: nis2Url("23"),
    },
    { code: "Art. 24", title: "Use of European cybersecurity certification schemes", guidance: "Member states may require certified ICT products, services or processes; check your national requirements.", url: nis2Url("24") },
  ],
};
