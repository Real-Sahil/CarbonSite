import type { QuestionSet } from "./types";

// Build UK Common Assessment Standard question set, version 5 (1 July 2025):
// https://builduk.org/wp-content/uploads/2025/07/Common-Assessment-Standard-Question-Set-Version-5.pdf
// PPN 03/24 makes it the preferred pre-qualification for public construction
// works. The question set is Build UK's copyright: this maps its question
// numbers to MetricOra's answer topics and never reproduces the questions.
// Work from the question set itself, or your Recognised Assessment Body's
// portal, when you submit. The data upkeep workflow watches for version 6.
const Q: Array<[number, string]> = [
  [1, "identity.legal_name"], [2, "identity.trading_name"], [3, "identity.registered_office"], [4, "identity.trading_address"],
  [5, "identity.uk_presence"], [6, "identity.area_of_operation"], [7, "identity.contact"], [8, "identity.company_type"],
  [9, "identity.company_number"], [10, "identity.vat_number"], [11, "identity.utr"], [12, "identity.incorporation_date"],
  [13, "identity.group"], [14, "identity.directors"], [15, "identity.sme"], [16, "identity.workforce"],
  [17, "identity.earn_and_learn"], [18, "identity.social_enterprise"], [19, "identity.disadvantaged_workers"], [20, "identity.trades"],
  [21, "identity.subcontracting"], [22, "identity.specialist_activities"], [23, "identity.building_safety_scope"], [24, "identity.building_safety_scope"],
  [25, "identity.approved_lists"], [26, "identity.approved_lists"],
  [27, "financial.accounts"], [28, "financial.employers_liability"], [29, "financial.public_liability"], [30, "financial.professional_indemnity"],
  [31, "financial.product_liability"], [32, "financial.contractors_all_risk"], [33, "financial.fleet"], [34, "financial.broker"], [35, "financial.bank"],
  [36, "corporate.payment_code"], [37, "corporate.payment_reporting"], [38, "corporate.subcontractor_finance_checks"],
  [39, "corporate.convictions"], [40, "corporate.convictions"], [41, "corporate.convictions"], [42, "corporate.debarment"],
  [43, "corporate.convictions"], [44, "corporate.convictions"], [45, "corporate.sanctions"], [46, "corporate.governance_statement"],
  [47, "corporate.regulatory_breaches"], [48, "corporate.public_ownership"], [49, "corporate.public_ownership"], [50, "corporate.anti_bribery"],
  [51, "corporate.anti_bribery_communication"], [52, "corporate.fraud_prevention"], [53, "corporate.tax_evasion"], [54, "corporate.tax_avoidance"],
  [55, "corporate.right_to_work"], [56, "corporate.workforce_complaints"], [57, "corporate.whistleblowing"], [58, "corporate.whistleblowing_communication"],
  [59, "corporate.citb"], [60, "corporate.trade_bodies"], [61, "corporate.trade_body_suspension"], [62, "corporate.esg_policy"],
  [63, "corporate.modern_slavery"], [64, "corporate.modern_slavery_communication"], [65, "corporate.modern_slavery_supply_chain"], [66, "corporate.minimum_wage"],
  [67, "corporate.real_living_wage"], [68, "corporate.anti_bullying"], [69, "corporate.workforce_arrangements"], [70, "corporate.gender_pay_gap"],
  [71, "hs.ssip"], [72, "hs.responsible_person"], [73, "hs.policy"], [74, "hs.drugs_alcohol"],
  [75, "hs.behavioural_safety"], [76, "hs.occupational_health"], [77, "hs.fleet_scheme"], [78, "hs.review_improve"],
  [79, "hs.risk_assessment"], [80, "hs.effectiveness"], [81, "hs.competent_advice"], [82, "hs.training"],
  [83, "hs.skills"], [84, "hs.subcontractors"], [85, "hs.workforce_involvement"], [86, "hs.card_scheme"],
  [87, "hs.accidents"], [88, "hs.occupied_buildings"], [89, "hs.cdm_roles"],
  [90, "hs.cdm_contractor"], [91, "hs.cdm_contractor"], [92, "hs.cdm_contractor"], [93, "hs.cdm_contractor"],
  [94, "hs.cdm_principal_contractor"], [95, "hs.cdm_principal_contractor"], [96, "hs.cdm_principal_contractor"], [97, "hs.cdm_principal_contractor"],
  [98, "hs.cdm_principal_contractor"], [99, "hs.cdm_principal_contractor"], [100, "hs.cdm_principal_contractor"],
  [101, "hs.cdm_designer"], [102, "hs.cdm_designer"], [103, "hs.cdm_designer"], [104, "hs.cdm_designer"], [105, "hs.cdm_designer"],
  [106, "hs.cdm_principal_designer"], [107, "hs.cdm_principal_designer"], [108, "hs.cdm_principal_designer"], [109, "hs.cdm_principal_designer"], [110, "hs.cdm_principal_designer"],
  [111, "env.iso14001"], [112, "env.policy"], [113, "env.procedures"], [114, "env.training"], [115, "env.review_improve"],
  [116, "env.subcontractors"], [117, "env.competent_advice"], [118, "env.waste_carrier"], [119, "env.carbon_reporting"], [120, "env.carbon_reduction_plan"], [121, "env.standards"],
  [122, "quality.bs99001"], [123, "quality.iso9001"], [124, "quality.responsible_person"], [125, "quality.policy"], [126, "quality.risk_policy"],
  [127, "quality.procedures"], [128, "quality.training"], [129, "quality.review_improve"], [130, "quality.supplier_selection"], [131, "quality.subcontractors"],
  [132, "quality.products_compliance"], [133, "quality.products_compliance"], [134, "quality.products_compliance"],
  [135, "bsa.competence"], [136, "bsa.roles_understood"], [137, "bsa.client_duties"], [138, "bsa.regulatory_updates"], [139, "bsa.subcontractor_competence"],
  [140, "bsa.cooperation"], [141, "bsa.product_safety_notifications"], [142, "bsa.dutyholder_roles"],
  [143, "bsa.compliance_management"], [144, "bsa.compliance_management"], [145, "bsa.compliance_management"], [146, "bsa.compliance_management"],
  [147, "bsa.compliance_management"], [148, "bsa.compliance_management"], [149, "bsa.compliance_management"], [150, "bsa.information"],
  [151, "bsa.information"], [152, "bsa.information"], [153, "bsa.occurrence_reporting"], [154, "bsa.occurrence_reporting"],
  [155, "fir.policy"], [156, "fir.communication"], [157, "fir.embedding"], [158, "fir.tribunals"], [159, "fir.recruitment"], [160, "fir.subcontractors"],
  [161, "infosec.cyber_essentials"], [162, "infosec.dpo"], [163, "infosec.cyber_policy"], [164, "infosec.data_protection_policy"],
  [165, "infosec.subcontractor_data"], [166, "infosec.subcontractor_data"], [167, "infosec.records_of_processing"], [168, "infosec.dpia"], [169, "infosec.breaches"],
  [170, "im.iso19650"], [171, "im.policies"], [172, "im.lead_appointed_party"], [173, "im.team"], [174, "im.training"], [175, "im.commitment"], [176, "im.principles"],
];

export const CAS_V5: QuestionSet = {
  id: "cas-v5",
  name: "Common Assessment Standard",
  issuer: "Build UK",
  version: "Version 5, 1 July 2025",
  sourceUrl: "https://builduk.org/information/common-assessment-standard/",
  note:
    "Question numbers map to your answers; the questions themselves are Build UK's and are not reproduced. Certified once a year by a Recognised Assessment Body: Achilles (BuildingConfidence Gold), Compliance Chain, Constructionline (Gold, Platinum), CQMS (Safety-Scheme Premium, Elite), SCCS (Build Assured CAS), Smas Worksafe (Worksafe, Worksafe Pro) or Veriforce CHAS (CHAS Elite). Some questions apply only to certain work (CDM roles, Building Safety Act dutyholders, BIM).",
  questions: Q.map(([n, topicKey]) => ({ ref: String(n), topicKey })),
};
