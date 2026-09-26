import type { CatalogueFramework, CatalogueRequirement } from "./types";

// EU GDPR (Regulation (EU) 2016/679) and the UK GDPR (the retained version as
// amended, most recently by the Data (Use and Access) Act 2025). Article
// numbers and titles are the official ones, checked against the Official
// Journal text and legislation.gov.uk on 26 September 2026; the guidance is
// MetricOra's own summary and every requirement links to the official article.

type Article = {
  n: string;
  title: string;
  /** UK title where the UK GDPR words it differently. */
  ukTitle?: string;
  guidance: string;
  hints?: string[];
  /** Only in one of the two texts. */
  only?: "eu" | "uk";
};

const CHAPTERS: Array<{ code: string; title: string; articles: Article[] }> = [
  {
    code: "Ch. II",
    title: "Principles",
    articles: [
      {
        n: "5",
        title: "Principles relating to processing of personal data",
        guidance:
          "Process personal data lawfully, fairly and transparently; for specified purposes; limited to what is needed; accurate; kept no longer than necessary; secure. You must be able to show you comply (accountability).",
        hints: ["Data protection policy", "Retention schedule", "Record of processing"],
      },
      {
        n: "6",
        title: "Lawfulness of processing",
        guidance: "Identify and record a lawful basis for each processing purpose (consent, contract, legal obligation, vital interests, public task or legitimate interests).",
        hints: ["Lawful basis recorded against each purpose", "Legitimate interests assessments"],
      },
      { n: "7", title: "Conditions for consent", guidance: "Where you rely on consent, it must be freely given, specific, informed and unambiguous, recorded, and as easy to withdraw as to give.", hints: ["Consent records", "Withdrawal mechanism"] },
      {
        n: "8",
        title: "Conditions applicable to child's consent in relation to information society services",
        guidance: "Online services offered directly to children need parental consent below the national age threshold (13 in the UK).",
      },
      {
        n: "8A",
        title: "Purpose limitation: further processing",
        guidance: "Sets out when using personal data for a new purpose is compatible with the original one. Assess and record compatibility before reusing data.",
        only: "uk",
      },
      { n: "9", title: "Processing of special categories of personal data", guidance: "Health, biometric, ethnicity and other special category data needs a lawful basis and an Article 9 condition (plus, in the UK, a DPA 2018 Schedule 1 condition and often an appropriate policy document).", hints: ["Special category conditions recorded", "Appropriate policy document"] },
      { n: "10", title: "Processing of personal data relating to criminal convictions and offences", guidance: "Criminal record data (for example from DBS checks) needs official authority or a legal basis in national law.", hints: ["Criminal offence data conditions"] },
      { n: "11", title: "Processing which does not require identification", guidance: "You do not have to keep or collect extra data just to identify people for GDPR purposes." },
    ],
  },
  {
    code: "Ch. III",
    title: "Rights of the data subject",
    articles: [
      { n: "12", title: "Transparent information, communication and modalities for the exercise of the rights of the data subject", guidance: "Communicate clearly, handle rights requests free of charge and within one month (extendable by two months for complex requests).", hints: ["Rights request procedure", "Request log with response times"] },
      { n: "13", title: "Information to be provided where personal data are collected from the data subject", guidance: "Give a privacy notice when you collect data: who you are, purposes, lawful bases, recipients, transfers, retention and rights.", hints: ["Privacy notices (staff, customers, website)"] },
      { n: "14", title: "Information to be provided where personal data have not been obtained from the data subject", guidance: "When you obtain data from elsewhere, tell people within a month, unless an exemption applies.", hints: ["Privacy notice covering indirect collection"] },
      { n: "15", title: "Right of access by the data subject", guidance: "Provide people with a copy of their data and supporting information on request (a subject access request).", hints: ["SAR procedure", "SAR log"] },
      { n: "16", title: "Right to rectification", guidance: "Correct inaccurate data and complete incomplete data on request." },
      { n: "17", title: "Right to erasure (‘right to be forgotten’)", guidance: "Delete data on request where the grounds apply, for example it is no longer needed or consent is withdrawn.", hints: ["Erasure procedure"] },
      { n: "18", title: "Right to restriction of processing", guidance: "Pause processing while accuracy or an objection is being checked, or where the person asks you to keep data you would otherwise delete." },
      { n: "19", title: "Notification obligation regarding rectification or erasure of personal data or restriction of processing", guidance: "Tell each recipient about corrections, erasures and restrictions unless impossible or disproportionate." },
      { n: "20", title: "Right to data portability", guidance: "Where processing is by consent or contract and automated, provide data in a structured, machine-readable format." },
      { n: "21", title: "Right to object", guidance: "Stop processing based on legitimate interests or public task when someone objects, unless you have compelling grounds; always stop for direct marketing." },
      { n: "22", title: "Automated individual decision-making, including profiling", guidance: "Solely automated decisions with legal or similarly significant effects are restricted and need safeguards, including human review.", only: "eu" },
      {
        n: "22A to 22D",
        title: "Automated processing and significant decisions",
        guidance:
          "The Data (Use and Access) Act 2025 replaced Article 22 with Articles 22A to 22D: significant decisions based solely on automated processing are allowed with safeguards (information, a way to make representations, human intervention and contest), with tighter limits for special category data. Check the provisions in force on legislation.gov.uk.",
        only: "uk",
      },
    ],
  },
  {
    code: "Ch. IV",
    title: "Controller and processor",
    articles: [
      { n: "24", title: "Responsibility of the controller", guidance: "Put appropriate technical and organisational measures and policies in place, and be able to demonstrate compliance.", hints: ["Data protection policy", "Governance roles"] },
      { n: "25", title: "Data protection by design and by default", guidance: "Build data protection into systems and processes from the start, and collect and show only what is needed by default.", hints: ["Privacy by design checklist in change process"] },
      { n: "26", title: "Joint controllers", guidance: "Where you decide purposes and means jointly with another organisation, agree responsibilities in an arrangement.", hints: ["Joint controller agreements"] },
      {
        n: "27",
        title: "Representatives of controllers or processors not established in the Union",
        ukTitle: "Representatives of controllers or processors not established in the United Kingdom",
        guidance: "Organisations outside the jurisdiction that offer goods or services to, or monitor, people inside it usually need to appoint a local representative.",
      },
      { n: "28", title: "Processor", guidance: "Use only processors with sufficient guarantees, under a written contract with the mandatory terms (instructions, confidentiality, security, sub-processors, assistance, deletion, audits).", hints: ["Data processing agreements", "Supplier due diligence"] },
      { n: "29", title: "Processing under the authority of the controller or processor", guidance: "People and processors act only on documented instructions." },
      { n: "30", title: "Records of processing activities", guidance: "Keep a record of processing: purposes, categories of people and data, recipients, transfers, retention and security measures.", hints: ["Record of processing activities (ROPA)"] },
      { n: "31", title: "Cooperation with the supervisory authority", ukTitle: "Cooperation with the Commissioner", guidance: "Cooperate with the regulator (the ICO in the UK) on request." },
      { n: "32", title: "Security of processing", guidance: "Apply security appropriate to the risk: for example encryption, confidentiality, integrity, availability, resilience, restoring access after incidents and regular testing.", hints: ["Information security policy", "Access controls", "Backup and restore tests", "Penetration tests"] },
      {
        n: "33",
        title: "Notification of a personal data breach to the supervisory authority",
        ukTitle: "Notification of a personal data breach to the Commissioner",
        guidance: "Report a breach likely to risk people's rights to the regulator within 72 hours of becoming aware, and document every breach whether reported or not.",
        hints: ["Breach procedure", "Breach log"],
      },
      { n: "34", title: "Communication of a personal data breach to the data subject", guidance: "Tell affected people without undue delay when a breach is likely to result in a high risk to them.", hints: ["Breach communication templates"] },
      { n: "35", title: "Data protection impact assessment", guidance: "Carry out a DPIA before processing likely to result in high risk, such as large-scale monitoring or new technology.", hints: ["DPIA screening", "Completed DPIAs"] },
      { n: "36", title: "Prior consultation", guidance: "Consult the regulator before processing where a DPIA shows high risk you cannot mitigate." },
      { n: "37", title: "Designation of the data protection officer", guidance: "Appoint a DPO if you are a public authority, or your core activities involve large-scale monitoring or special category data. Record the decision either way.", hints: ["DPO appointment or reasoning why not required"] },
      { n: "38", title: "Position of the data protection officer", guidance: "The DPO is involved early, resourced, independent and reports to the highest management level." },
      { n: "39", title: "Tasks of the data protection officer", guidance: "The DPO informs and advises, monitors compliance, advises on DPIAs and is the contact point for the regulator." },
    ],
  },
  {
    code: "Ch. V",
    title: "Transfers of personal data to third countries or international organisations",
    articles: [
      {
        n: "44 to 49",
        title: "International transfers",
        guidance:
          "Transfer personal data outside the jurisdiction only on an adequacy decision (UK: adequacy regulations), with appropriate safeguards such as standard contractual clauses (UK: the IDTA or Addendum) or binding corporate rules, or under a specific derogation. Map transfers and assess them.",
        hints: ["Transfer register", "Transfer risk assessments", "Signed SCCs / IDTA"],
      },
    ],
  },
];

const UK_EXTRA: CatalogueRequirement[] = [
  { code: "UK", title: "UK-specific obligations" },
  {
    code: "Fee",
    parent: "UK",
    title: "Data protection fee",
    guidance: "Controllers processing personal data must pay the annual data protection fee to the ICO unless exempt, under the Data Protection (Charges and Information) Regulations 2018.",
    evidenceHints: ["ICO registration certificate and renewal date"],
    url: "https://www.legislation.gov.uk/uksi/2018/480/contents",
  },
];

function build(jurisdiction: "eu" | "uk"): CatalogueRequirement[] {
  const url = (n: string) => {
    const first = n.split(/ to |-/)[0];
    return jurisdiction === "uk"
      ? `https://www.legislation.gov.uk/eur/2016/679/article/${first}`
      : `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679#art_${first}`;
  };
  const reqs: CatalogueRequirement[] = [];
  for (const ch of CHAPTERS) {
    reqs.push({ code: ch.code, title: ch.title });
    for (const a of ch.articles) {
      if (a.only && a.only !== jurisdiction) continue;
      reqs.push({
        code: `Art. ${a.n}`,
        parent: ch.code,
        title: jurisdiction === "uk" && a.ukTitle ? a.ukTitle : a.title,
        guidance: a.guidance,
        evidenceHints: a.hints,
        url: url(a.n),
        sharedKey: a.only ? undefined : `gdpr:${a.n}`,
      });
    }
  }
  return jurisdiction === "uk" ? [...reqs, ...UK_EXTRA] : reqs;
}

const NOTE =
  "Official article numbers and titles with MetricOra's own summary of each obligation, which is not legal advice. Each requirement links to the official text, which governs.";

export const euGdpr: CatalogueFramework = {
  slug: "eu-gdpr-2016",
  name: "EU General Data Protection Regulation",
  shortName: "EU GDPR",
  edition: "Regulation (EU) 2016/679",
  publisher: "European Union",
  family: "privacy",
  jurisdiction: "European Union and EEA",
  summary: "The EU's data protection law: principles, lawful bases, individuals' rights, controller and processor duties, breach reporting and international transfers.",
  sourceUrl: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
  contentBasis: "references",
  contentNote: NOTE,
  certifiable: false,
  requirements: build("eu"),
};

export const ukGdpr: CatalogueFramework = {
  slug: "uk-gdpr",
  name: "UK GDPR and Data Protection Act 2018",
  shortName: "UK GDPR",
  edition: "As amended by the Data (Use and Access) Act 2025",
  publisher: "UK Parliament",
  family: "privacy",
  jurisdiction: "United Kingdom",
  summary: "The UK's data protection law, regulated by the ICO: the UK GDPR as amended, read with the Data Protection Act 2018, plus the ICO data protection fee.",
  sourceUrl: "https://www.legislation.gov.uk/eur/2016/679/contents",
  contentBasis: "references",
  contentNote: NOTE,
  certifiable: false,
  requirements: build("uk"),
};
