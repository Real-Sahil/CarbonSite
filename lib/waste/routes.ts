// Disposal routes offered on the waste form and read by the waste page. Not in a client file: a server page cannot call into one.
export const DISPOSAL_ROUTES = [
  { value: "landfill_mixed",        label: "Landfill - Mixed waste",      hierarchy: "landfill" },
  { value: "landfill_food",         label: "Landfill - Food waste",        hierarchy: "landfill" },
  { value: "landfill_wood",         label: "Landfill - Wood",              hierarchy: "landfill" },
  { value: "landfill_plastic",      label: "Landfill - Plastic",           hierarchy: "landfill" },
  { value: "incineration_efw",      label: "Energy from Waste (EfW)",      hierarchy: "recovery" },
  { value: "recycling_paper",       label: "Recycling - Paper",            hierarchy: "recycle" },
  { value: "recycling_cardboard",   label: "Recycling - Cardboard",        hierarchy: "recycle" },
  { value: "recycling_plastic",     label: "Recycling - Plastic",          hierarchy: "recycle" },
  { value: "recycling_glass",       label: "Recycling - Glass",            hierarchy: "recycle" },
  { value: "recycling_metal",       label: "Recycling - Metal",            hierarchy: "recycle" },
  { value: "recycling_mixed",       label: "Recycling - Mixed",            hierarchy: "recycle" },
  { value: "composting_food",       label: "Composting - Food waste",      hierarchy: "recycle" },
  { value: "composting_garden",     label: "Composting - Garden waste",    hierarchy: "recycle" },
  { value: "anaerobic_digestion",   label: "Anaerobic Digestion",          hierarchy: "recycle" },
  { value: "hazardous_landfill",    label: "Hazardous waste - Landfill",   hierarchy: "landfill" },
];
export const routeLabel = (v: string) => DISPOSAL_ROUTES.find((r) => r.value === v)?.label ?? v;
