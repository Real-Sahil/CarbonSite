// Pre-qualification answer topics: the things construction pre-qualification
// questionnaires ask about, each answered once by the organisation and reused
// by every questionnaire that asks it (the Common Assessment Standard, a
// client's own PQQ, a framework application). Titles and guidance are
// MetricOra's own words; question sets map their question numbers to these
// keys without reproducing the question text.

export type SectionKey =
  | "identity"
  | "financial"
  | "corporate"
  | "health_safety"
  | "environmental"
  | "quality"
  | "building_safety"
  | "fir"
  | "information_security"
  | "information_management";

export const SECTIONS: Record<SectionKey, string> = {
  identity: "Company identity",
  financial: "Financial and insurance",
  corporate: "Corporate and professional standing",
  health_safety: "Health and safety",
  environmental: "Environmental",
  quality: "Quality",
  building_safety: "Building safety",
  fir: "Fairness, inclusion and respect",
  information_security: "Information security and data protection",
  information_management: "Information management (BIM)",
};

/** What drafts an answer from the organisation's records. */
export type DraftSource =
  | { kind: "policy"; match: RegExp; what: string }
  | { kind: "certificate"; frameworks: string[]; name: string }
  | { kind: "fn"; id: DraftFn };

export type DraftFn =
  | "identity_name"
  | "identity_registration"
  | "training"
  | "workforce_cards"
  | "incidents"
  | "subcontractor_evaluation"
  | "review_improve"
  | "risk_assessment"
  | "legal_compliance"
  | "carbon_reporting"
  | "carbon_reduction_plan"
  | "data_protection_records";

export type Topic = {
  key: string;
  section: SectionKey;
  title: string;
  /** A yes/no question, with detail or a document when yes. */
  yesNo?: boolean;
  /** Usually answered with a document (policy, certificate, statement). */
  document?: boolean;
  guidance?: string;
  draft?: DraftSource;
};

const policy = (match: RegExp, what: string): DraftSource => ({ kind: "policy", match, what });
const cert = (frameworks: string[], name: string): DraftSource => ({ kind: "certificate", frameworks, name });
const fn = (id: DraftFn): DraftSource => ({ kind: "fn", id });

export const TOPICS: Topic[] = [
  // Identity
  { key: "identity.legal_name", section: "identity", title: "Legal name", draft: fn("identity_name") },
  { key: "identity.trading_name", section: "identity", title: "Trading name" },
  { key: "identity.registered_office", section: "identity", title: "Registered office address" },
  { key: "identity.trading_address", section: "identity", title: "Trading address" },
  { key: "identity.uk_presence", section: "identity", title: "Registered and active in the UK", yesNo: true },
  { key: "identity.area_of_operation", section: "identity", title: "Geographical area of operation" },
  { key: "identity.contact", section: "identity", title: "Contact for pre-qualification enquiries" },
  { key: "identity.company_type", section: "identity", title: "Company type" },
  { key: "identity.company_number", section: "identity", title: "Companies House or equivalent registration number", draft: fn("identity_registration") },
  { key: "identity.vat_number", section: "identity", title: "VAT registration number" },
  { key: "identity.utr", section: "identity", title: "Unique tax reference" },
  { key: "identity.incorporation_date", section: "identity", title: "Date of incorporation" },
  { key: "identity.group", section: "identity", title: "Part of a group, and the parent company", yesNo: true },
  { key: "identity.directors", section: "identity", title: "Proprietors, partners, directors and company secretary" },
  { key: "identity.sme", section: "identity", title: "Micro, small or medium-sized enterprise" },
  { key: "identity.workforce", section: "identity", title: "Size of the workforce", guidance: "Directly employed, labour-only and agency workers, as the questionnaire asks." },
  { key: "identity.earn_and_learn", section: "identity", title: "Share of the workforce in earn-and-learn positions (apprentices, trainees)" },
  { key: "identity.social_enterprise", section: "identity", title: "Sheltered workshop, social enterprise or supported business", yesNo: true },
  { key: "identity.disadvantaged_workers", section: "identity", title: "Share of disabled or disadvantaged workers" },
  { key: "identity.trades", section: "identity", title: "Construction trades and work undertaken, with licences and accreditations" },
  { key: "identity.subcontracting", section: "identity", title: "Use of subcontractors", yesNo: true },
  { key: "identity.specialist_activities", section: "identity", title: "Specialist or regulated activities carried out (for example asbestos, demolition, gas, electrical)" },
  { key: "identity.building_safety_scope", section: "identity", title: "Work on buildings in scope of the Building Safety Act (including higher-risk buildings)", yesNo: true },
  { key: "identity.approved_lists", section: "identity", title: "Registration on official lists of approved suppliers", yesNo: true },

  // Financial and insurance
  { key: "financial.accounts", section: "financial", title: "Accounts for the last two years", document: true },
  { key: "financial.employers_liability", section: "financial", title: "Employers' liability insurance", yesNo: true, document: true, guidance: "Insurer, policy number, limit of indemnity and expiry date, with the certificate." },
  { key: "financial.public_liability", section: "financial", title: "Public liability insurance", yesNo: true, document: true },
  { key: "financial.professional_indemnity", section: "financial", title: "Professional indemnity insurance", yesNo: true, document: true },
  { key: "financial.product_liability", section: "financial", title: "Product liability insurance", yesNo: true, document: true },
  { key: "financial.contractors_all_risk", section: "financial", title: "Contractors' all risks insurance", yesNo: true, document: true },
  { key: "financial.fleet", section: "financial", title: "Fleet or motor insurance", yesNo: true, document: true },
  { key: "financial.broker", section: "financial", title: "Insurance broker" },
  { key: "financial.bank", section: "financial", title: "Principal bank" },

  // Corporate and professional standing
  { key: "corporate.payment_code", section: "corporate", title: "Payment code or standards signed up to (for example the Fair Payment Charter)", yesNo: true },
  { key: "corporate.payment_reporting", section: "corporate", title: "Payment practices reporting", yesNo: true },
  { key: "corporate.subcontractor_finance_checks", section: "corporate", title: "Financial checks on subcontractors", yesNo: true },
  { key: "corporate.convictions", section: "corporate", title: "Convictions, investigations or exclusion grounds (company, directors and connected persons)", yesNo: true, guidance: "Answer each exclusion ground the questionnaire lists; a yes needs details of self-cleaning." },
  { key: "corporate.debarment", section: "corporate", title: "On a government debarment list", yesNo: true },
  { key: "corporate.sanctions", section: "corporate", title: "Trade with sanctioned persons or countries", yesNo: true },
  { key: "corporate.governance_statement", section: "corporate", title: "Corporate governance statement", yesNo: true },
  { key: "corporate.regulatory_breaches", section: "corporate", title: "Breaches of tax, social security or regulatory obligations", yesNo: true },
  { key: "corporate.public_ownership", section: "corporate", title: "Ownership or control by a government body or public official", yesNo: true },
  { key: "corporate.anti_bribery", section: "corporate", title: "Anti-bribery and corruption policy", yesNo: true, document: true, draft: policy(/brib|corrupt/i, "anti-bribery and corruption policy") },
  { key: "corporate.anti_bribery_communication", section: "corporate", title: "How the anti-bribery policy is communicated" },
  { key: "corporate.fraud_prevention", section: "corporate", title: "Fraud prevention procedures (failure to prevent fraud)", yesNo: true, draft: policy(/fraud/i, "fraud prevention procedure") },
  { key: "corporate.tax_evasion", section: "corporate", title: "Procedures to prevent the facilitation of tax evasion", yesNo: true, draft: policy(/tax evasion|facilitation of tax/i, "procedure to prevent the facilitation of tax evasion") },
  { key: "corporate.tax_avoidance", section: "corporate", title: "Involvement in tax avoidance schemes", yesNo: true },
  { key: "corporate.right_to_work", section: "corporate", title: "Right to work checks on the workforce", yesNo: true },
  { key: "corporate.workforce_complaints", section: "corporate", title: "Allegations or complaints about the treatment of workers", yesNo: true },
  { key: "corporate.whistleblowing", section: "corporate", title: "Whistleblowing policy", yesNo: true, document: true, draft: policy(/whistle|speak(ing)? up/i, "whistleblowing policy") },
  { key: "corporate.whistleblowing_communication", section: "corporate", title: "How the whistleblowing policy is communicated" },
  { key: "corporate.citb", section: "corporate", title: "In scope of the CITB levy", yesNo: true },
  { key: "corporate.trade_bodies", section: "corporate", title: "Trade body membership", yesNo: true },
  { key: "corporate.trade_body_suspension", section: "corporate", title: "Suspended or expelled from a trade body", yesNo: true },
  { key: "corporate.esg_policy", section: "corporate", title: "Environmental, social and governance (ESG) or sustainability policy", yesNo: true, document: true, draft: policy(/\bESG\b|sustainab|responsible business|social value/i, "ESG or sustainability policy") },
  { key: "corporate.modern_slavery", section: "corporate", title: "Anti-slavery and human trafficking statement or policy", yesNo: true, document: true, draft: policy(/slavery|trafficking/i, "anti-slavery statement") },
  { key: "corporate.modern_slavery_communication", section: "corporate", title: "How the anti-slavery statement is communicated" },
  { key: "corporate.modern_slavery_supply_chain", section: "corporate", title: "Modern slavery awareness and checks in the supply chain", yesNo: true },
  { key: "corporate.minimum_wage", section: "corporate", title: "Pays at least the National Minimum or Living Wage, including agency workers", yesNo: true },
  { key: "corporate.real_living_wage", section: "corporate", title: "Pays the real Living Wage", yesNo: true },
  { key: "corporate.anti_bullying", section: "corporate", title: "Anti-bullying and harassment policy", yesNo: true, document: true, draft: policy(/bully|harass|dignity at work/i, "anti-bullying and harassment policy") },
  { key: "corporate.workforce_arrangements", section: "corporate", title: "Other workforce arrangements the questionnaire asks about" },
  { key: "corporate.gender_pay_gap", section: "corporate", title: "Gender pay gap reporting", yesNo: true },

  // Health and safety
  { key: "hs.ssip", section: "health_safety", title: "SSIP accreditation (valid certificate)", yesNo: true, document: true, guidance: "Scheme, certificate number and expiry. SSIP member schemes are listed at ssip.org.uk." },
  { key: "hs.iso45001", section: "health_safety", title: "ISO 45001 certification (or equivalent)", yesNo: true, document: true, draft: cert(["iso-45001-2018"], "ISO 45001") },
  { key: "hs.responsible_person", section: "health_safety", title: "Who is ultimately responsible for health and safety" },
  { key: "hs.policy", section: "health_safety", title: "Health and safety policy", yesNo: true, document: true, draft: policy(/health (and|&) safety|\bH ?& ?S\b|OH&S|safety policy/i, "health and safety policy") },
  { key: "hs.drugs_alcohol", section: "health_safety", title: "Drugs and alcohol policy", yesNo: true, document: true, draft: policy(/drug|alcohol|substance/i, "drugs and alcohol policy") },
  { key: "hs.behavioural_safety", section: "health_safety", title: "Behavioural safety programme", yesNo: true },
  { key: "hs.occupational_health", section: "health_safety", title: "Management of occupational health (dust, noise, vibration, health surveillance)", yesNo: true, draft: policy(/occupational health|health surveillance|dust|noise|vibration/i, "occupational health arrangements") },
  { key: "hs.fleet_scheme", section: "health_safety", title: "Fleet management scheme (for example FORS or CLOCS)", yesNo: true },
  { key: "hs.review_improve", section: "health_safety", title: "Checking, reviewing and improving health and safety performance", draft: fn("review_improve") },
  { key: "hs.risk_assessment", section: "health_safety", title: "Identifying hazards and producing risk assessments and method statements", draft: fn("risk_assessment") },
  { key: "hs.effectiveness", section: "health_safety", title: "Checking that health and safety measures work" },
  { key: "hs.competent_advice", section: "health_safety", title: "Access to competent health and safety advice" },
  { key: "hs.training", section: "health_safety", title: "Health and safety training and information for the workforce", draft: fn("training") },
  { key: "hs.skills", section: "health_safety", title: "Workforce skills, knowledge and qualifications for their work", draft: fn("training") },
  { key: "hs.subcontractors", section: "health_safety", title: "Checking that subcontractors apply health and safety measures", draft: fn("subcontractor_evaluation") },
  { key: "hs.workforce_involvement", section: "health_safety", title: "Involving the workforce in health and safety" },
  { key: "hs.card_scheme", section: "health_safety", title: "Workforce holds cards from a recognised scheme (CSCS or partner schemes)", yesNo: true, draft: fn("workforce_cards") },
  { key: "hs.accidents", section: "health_safety", title: "Recording and reviewing accidents, incidents and near misses", draft: fn("incidents") },
  { key: "hs.occupied_buildings", section: "health_safety", title: "Working in occupied buildings" },
  { key: "hs.cdm_roles", section: "health_safety", title: "CDM 2015 dutyholder roles taken on (client, principal designer, designer, principal contractor, contractor)" },
  { key: "hs.cdm_contractor", section: "health_safety", title: "CDM contractor duties: planning, coordination, welfare and site inductions" },
  { key: "hs.cdm_principal_contractor", section: "health_safety", title: "CDM principal contractor duties: construction phase plan, coordination and handover information" },
  { key: "hs.cdm_designer", section: "health_safety", title: "CDM designer duties: designing out risk, design changes and the health and safety file" },
  { key: "hs.cdm_principal_designer", section: "health_safety", title: "CDM principal designer duties: pre-construction information and coordinating designers" },

  // Environmental
  { key: "env.iso14001", section: "environmental", title: "ISO 14001 certification (or equivalent)", yesNo: true, document: true, draft: cert(["iso-14001-2026", "iso-14001-2015"], "ISO 14001") },
  { key: "env.policy", section: "environmental", title: "Environmental management policy", yesNo: true, document: true, draft: policy(/environment/i, "environmental policy") },
  { key: "env.procedures", section: "environmental", title: "Environmental management procedures and legal compliance", draft: fn("legal_compliance") },
  { key: "env.training", section: "environmental", title: "Environmental training and information for the workforce", draft: fn("training") },
  { key: "env.review_improve", section: "environmental", title: "Checking, reviewing and improving environmental performance", draft: fn("review_improve") },
  { key: "env.subcontractors", section: "environmental", title: "Subcontractors' environmental arrangements", draft: fn("subcontractor_evaluation") },
  { key: "env.competent_advice", section: "environmental", title: "Access to competent environmental advice" },
  { key: "env.waste_carrier", section: "environmental", title: "Waste carrier, broker or dealer registration", yesNo: true, document: true },
  { key: "env.carbon_reporting", section: "environmental", title: "Carbon emissions reporting (SECR or voluntary)", yesNo: true, draft: fn("carbon_reporting") },
  { key: "env.carbon_reduction_plan", section: "environmental", title: "Carbon Reduction Plan", yesNo: true, document: true, draft: fn("carbon_reduction_plan") },
  { key: "env.standards", section: "environmental", title: "Other environmental standards or schemes worked to" },

  // Quality
  { key: "quality.bs99001", section: "quality", title: "BS 99001 certification (or equivalent)", yesNo: true, document: true },
  { key: "quality.iso9001", section: "quality", title: "ISO 9001 certification (or equivalent)", yesNo: true, document: true, draft: cert(["iso-9001-2026", "iso-9001-2015"], "ISO 9001") },
  { key: "quality.responsible_person", section: "quality", title: "Who is ultimately responsible for quality" },
  { key: "quality.policy", section: "quality", title: "Quality management policy", yesNo: true, document: true, draft: policy(/quality/i, "quality policy") },
  { key: "quality.risk_policy", section: "quality", title: "Risk management policy", yesNo: true, document: true, draft: policy(/risk management/i, "risk management policy") },
  { key: "quality.procedures", section: "quality", title: "Quality management procedures, including design where relevant", draft: policy(/quality|inspection and test|ITP/i, "quality procedure") },
  { key: "quality.training", section: "quality", title: "Quality training and information for the workforce", draft: fn("training") },
  { key: "quality.review_improve", section: "quality", title: "Reviewing, correcting and improving quality", draft: fn("review_improve") },
  { key: "quality.supplier_selection", section: "quality", title: "Selecting and evaluating suppliers", draft: fn("subcontractor_evaluation") },
  { key: "quality.subcontractors", section: "quality", title: "Subcontractors applying quality arrangements", draft: fn("subcontractor_evaluation") },
  { key: "quality.products_compliance", section: "quality", title: "Products and systems specified or installed meet requirements (Construction Products Regulation, manufacturers' instructions)" },

  // Building safety
  { key: "bsa.competence", section: "building_safety", title: "Recording and managing competence (skills, knowledge, experience and behaviours)", draft: fn("training") },
  { key: "bsa.roles_understood", section: "building_safety", title: "Workforce and key subcontractors understand their Building Safety Act duties" },
  { key: "bsa.client_duties", section: "building_safety", title: "Making clients aware of their duties" },
  { key: "bsa.regulatory_updates", section: "building_safety", title: "Keeping up to date with building safety regulation" },
  { key: "bsa.subcontractor_competence", section: "building_safety", title: "Subcontractors evidence their workforce's competence", draft: fn("subcontractor_evaluation") },
  { key: "bsa.cooperation", section: "building_safety", title: "Cooperating with other dutyholders on compliance" },
  { key: "bsa.product_safety_notifications", section: "building_safety", title: "Notifying stakeholders of product safety issues" },
  { key: "bsa.dutyholder_roles", section: "building_safety", title: "Building Regulations dutyholder roles taken on" },
  { key: "bsa.compliance_management", section: "building_safety", title: "Planning, managing and monitoring work to comply with Building Regulations" },
  { key: "bsa.information", section: "building_safety", title: "Collecting, keeping and sharing building information (golden thread) and handover" },
  { key: "bsa.occurrence_reporting", section: "building_safety", title: "Mandatory occurrence reporting system" },

  // Fairness, inclusion and respect
  { key: "fir.policy", section: "fir", title: "Fairness, inclusion and respect or equality policy", yesNo: true, document: true, draft: policy(/equal|divers|inclusion|fairness|respect/i, "equality, diversity and inclusion policy") },
  { key: "fir.communication", section: "fir", title: "How the policy is communicated" },
  { key: "fir.embedding", section: "fir", title: "How fairness, inclusion and respect are embedded" },
  { key: "fir.tribunals", section: "fir", title: "Employment tribunal or discrimination findings in the last three years", yesNo: true },
  { key: "fir.recruitment", section: "fir", title: "Inclusive recruitment" },
  { key: "fir.subcontractors", section: "fir", title: "Subcontractors meet equality requirements" },

  // Information security and data protection
  { key: "infosec.cyber_essentials", section: "information_security", title: "Cyber Essentials or Cyber Essentials Plus certification", yesNo: true, document: true, draft: cert(["cyber-essentials"], "Cyber Essentials") },
  { key: "infosec.iso27001", section: "information_security", title: "ISO/IEC 27001 certification", yesNo: true, document: true, draft: cert(["iso-27001-2022"], "ISO/IEC 27001") },
  { key: "infosec.dpo", section: "information_security", title: "Data protection officer or person responsible for data protection" },
  { key: "infosec.cyber_policy", section: "information_security", title: "Cyber security or information security policy", yesNo: true, document: true, draft: policy(/cyber|information security|IT security|acceptable use/i, "information security policy") },
  { key: "infosec.data_protection_policy", section: "information_security", title: "Data protection policy and privacy notice", yesNo: true, document: true, draft: policy(/data protection|privacy|GDPR/i, "data protection policy") },
  { key: "infosec.subcontractor_data", section: "information_security", title: "Subcontractors' data protection and cyber security", yesNo: true },
  { key: "infosec.records_of_processing", section: "information_security", title: "Record of the personal data processed", yesNo: true, draft: fn("data_protection_records") },
  { key: "infosec.dpia", section: "information_security", title: "Data protection impact assessments", yesNo: true },
  { key: "infosec.breaches", section: "information_security", title: "Procedures for personal data breaches", yesNo: true },

  // Information management
  { key: "im.iso19650", section: "information_management", title: "ISO 19650 certification (or equivalent)", yesNo: true, document: true },
  { key: "im.policies", section: "information_management", title: "Information management policies and processes" },
  { key: "im.lead_appointed_party", section: "information_management", title: "Acting as lead appointed party" },
  { key: "im.team", section: "information_management", title: "Information management team and structure" },
  { key: "im.training", section: "information_management", title: "Information management training", draft: fn("training") },
  { key: "im.commitment", section: "information_management", title: "Commitment to the UK BIM Framework" },
  { key: "im.principles", section: "information_management", title: "How information management principles have been applied" },
];

const BY_KEY = new Map(TOPICS.map((t) => [t.key, t]));
export const getTopic = (key: string) => BY_KEY.get(key) ?? null;
export const isTopicKey = (key: string) => BY_KEY.has(key);
