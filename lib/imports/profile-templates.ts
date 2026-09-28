// Starting points for ERP export profiles. Each lists header names commonly
// seen in that system's ledger line exports; they are only candidates,
// resolved against the file's real headers by resolveColumns(), and the
// person confirms the mapping before the profile is saved. None of these has
// been checked against a live customer export: saved layouts, versions and
// language settings rename columns. No rules ship with a template because
// every organisation's chart of accounts differs.

import type { ProfileColumnKey, SourceSystem } from "./profiles";

export type ProfileTemplate = {
  sourceSystem: SourceSystem;
  label: string;
  /** Which report or export the headers come from, shown on the form. */
  exportHint: string;
  columns: Partial<Record<ProfileColumnKey, string[]>>;
};

export const PROFILE_TEMPLATES: ProfileTemplate[] = [
  {
    sourceSystem: "sap",
    label: "SAP",
    exportHint: "G/L or vendor line items (FBL3N / FBL1N) exported to spreadsheet. SAP number format follows the user's settings; switch to 1.234,56 if needed.",
    columns: {
      date: ["Posting Date", "Pstng Date", "Document Date", "Doc. Date"],
      account: ["G/L Account", "G/L Acct", "G/L", "Account"],
      costCode: ["Cost Center", "Cost Ctr", "WBS Element", "WBS element"],
      netAmount: ["Amount in Local Currency", "Amount in local cur.", "Amt in loc.cur.", "Amount in LC", "Amount"],
      currency: ["Local Currency", "LCurr", "Currency", "Crcy"],
      quantity: ["Quantity", "Qty"],
      unit: ["Base Unit of Measure", "BUn", "Unit of Measure", "Unit"],
      description: ["Text", "Item Text"],
      supplier: ["Vendor Name", "Supplier Name", "Name 1", "Vendor", "Supplier"],
      facility: ["Plant", "Plant Name"],
      reference: ["Document Number", "DocumentNo", "Reference"],
    },
  },
  {
    sourceSystem: "causeway",
    label: "Causeway Financials",
    exportHint: "Purchase ledger or nominal transactions report exported to CSV or Excel.",
    columns: {
      date: ["Posting Date", "Transaction Date", "Invoice Date", "Date"],
      account: ["Nominal Code", "Nominal Account", "Account Code", "GL Code"],
      costCode: ["Cost Code", "Cost Centre", "Cost Center"],
      netAmount: ["Net Amount", "Net Value", "Net", "Amount"],
      currency: ["Currency"],
      quantity: ["Quantity", "Qty"],
      unit: ["Unit", "UOM"],
      description: ["Description", "Narrative", "Details"],
      supplier: ["Supplier Name", "Supplier", "Supplier Account"],
      facility: ["Contract Name", "Contract", "Project", "Site"],
      reference: ["Invoice Number", "Reference", "Document Number"],
    },
  },
  {
    sourceSystem: "coins",
    label: "COINS",
    exportHint: "Job cost or purchase ledger transactions exported to CSV or Excel.",
    columns: {
      date: ["Transaction Date", "Posting Date", "Date"],
      account: ["Nominal Code", "Nominal", "Account"],
      costCode: ["Cost Code", "Cost Header"],
      netAmount: ["Net Value", "Net Amount", "Value", "Amount"],
      currency: ["Currency"],
      quantity: ["Quantity", "Qty"],
      unit: ["Unit", "UOM"],
      description: ["Description", "Narrative", "Details"],
      supplier: ["Supplier Name", "Supplier"],
      facility: ["Job Name", "Job", "Contract"],
      reference: ["Reference", "Invoice Number", "Document"],
    },
  },
  {
    sourceSystem: "sage",
    label: "Sage 50 / Sage 200",
    exportHint: "Nominal activity, audit trail or purchase transactions report exported to CSV or Excel.",
    columns: {
      date: ["Date", "Transaction Date", "Posting Date"],
      account: ["N/C", "Nominal Code", "Nominal Account"],
      costCode: ["Dept", "Department", "Cost Centre"],
      netAmount: ["Net", "Net Amount", "Goods Value", "Net Value"],
      currency: ["Currency"],
      quantity: ["Quantity", "Qty"],
      unit: ["Unit"],
      description: ["Details", "Narrative", "Description"],
      supplier: ["Supplier Name", "Account Name", "A/C", "Supplier"],
      reference: ["Ref", "Reference", "Inv Ref"],
    },
  },
  {
    sourceSystem: "generic",
    label: "Other ledger export",
    exportHint: "Any CSV or Excel export with a date, an account or cost code, and a net amount or quantity per line.",
    columns: {
      date: ["Date", "Posting Date", "Transaction Date", "Invoice Date"],
      account: ["Account", "Account Code", "Nominal Code", "GL Code", "Ledger Code"],
      costCode: ["Cost Code", "Cost Centre", "Cost Center", "Department"],
      netAmount: ["Net Amount", "Net", "Amount", "Value"],
      currency: ["Currency", "CCY"],
      quantity: ["Quantity", "Qty"],
      unit: ["Unit", "UOM"],
      description: ["Description", "Narrative", "Details", "Memo"],
      supplier: ["Supplier", "Supplier Name", "Vendor"],
      facility: ["Site", "Facility", "Project", "Job"],
      reference: ["Reference", "Invoice Number", "Document Number"],
    },
  },
];

export const templateFor = (s: SourceSystem) => PROFILE_TEMPLATES.find((t) => t.sourceSystem === s) ?? PROFILE_TEMPLATES[PROFILE_TEMPLATES.length - 1];
