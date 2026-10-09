export type Note = { id: string; layout: string; html: string; truth: Record<string, string | number>; distort: boolean };
let seed = 777331;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n: number) => String(n).padStart(2, "0");
const L = "ABCDEFGHJKLMNOPRSTUVWXYZ";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CARRIERS = ["Kestrel Haulage Ltd", "Ridgeway Skip Hire Limited", "J. Patel & Sons", "NorthSouth Aggregates Ltd", "Eco-Link Waste Solutions", "Dunmore Transport Services Ltd"];
const EWC = ["17 09 04", "17 05 04", "17 01 01", "20 01 01", "17 04 07", "17 02 03", "15 01 01", "17 03 02", "17 05 03*"];
const veh = () => `${L[int(0, 23)]}${L[int(0, 23)]}${int(10, 25)} ${L[int(0, 23)]}${L[int(0, 23)]}${L[int(0, 23)]}`;

export function build(n = 30): Note[] {
  const out: Note[] = [];
  for (let i = 0; i < n; i++) {
    const layout = ["form-grid", "transfer-of", "docket", "iso-dates", "old-reg", "tons"][i % 6];
    const carrier = pick(CARRIERS);
    const d = int(1, 28), m = int(1, 12), y = 2026;
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    const t = Math.round((rnd() * 20 + 0.5) * 100) / 100;
    const ewc = pick(EWC);
    const ref = pick([`WTN/${int(1000, 9999)}`, `${int(10000, 99999)}`, `DK${int(100000, 999999)}`, `2026-${int(1000, 9999)}`]);
    const reg = layout === "old-reg" ? `CB/${L[int(0, 23)]}${L[int(0, 23)]}${int(1000, 9999)}${L[int(0, 23)]}${L[int(0, 23)]}` : `CBDU${int(100000, 999999)}`;
    const v = veh();
    const noise = `<p>VAT Reg No: ${int(100, 999)} ${int(1000, 9999)} ${int(10, 99)} &nbsp; Company No: 0${int(1000000, 9999999)}</p><p>Tel 0${int(1000, 1999)} ${int(100000, 999999)} &middot; Fax 0${int(1000, 1999)} ${int(100000, 999999)}</p>`;
    let body = "";
    let weight = `${t.toFixed(2)} tonnes`;
    let date = `${pad(d)}/${pad(m)}/${y}`;
    if (layout === "form-grid") {
      body = `<h2>Waste Transfer Note</h2><table cellpadding="8" style="width:100%;border-collapse:collapse" border="1">
<tr><td>Note number<br/><b>${ref}</b></td><td>Date of transfer<br/><b>${date}</b></td></tr>
<tr><td>Carrier<br/><b>${carrier}</b></td><td>Registration number<br/><b>${reg}</b></td></tr>
<tr><td>Waste code<br/><b>${ewc}</b></td><td>Quantity<br/><b>${weight}</b></td></tr>
<tr><td>Vehicle<br/><b>${v}</b></td><td>Notes<br/>None</td></tr></table>${noise}`;
    } else if (layout === "transfer-of") {
      weight = `${t.toFixed(2)} t`;
      body = `<h2>Duty of Care Waste Transfer Note</h2><p>Note No. ${ref}</p><p>Date of transfer: ${date}</p><p>Registered carrier: ${carrier}</p><p>Upper tier registration: ${reg}</p>
<p>European Waste Catalogue code: ${ewc}</p><p>Quantity (tonnes): ${t.toFixed(2)}</p><p>Vehicle registration number: ${v}</p>${noise}`;
    } else if (layout === "docket") {
      date = `${pad(d)}/${pad(m)}/${String(y).slice(2)}`;
      weight = `${Math.round(t * 1000)} kg`;
      body = `<h1>${carrier}</h1>${noise}<h3>DELIVERY DOCKET</h3><p>Docket No. ${ref}</p><p>Date: ${date}</p><p>Waste: Mixed inert &mdash; EWC ${ewc}</p><p>Weight: ${weight}</p><p>Wagon ${v} &middot; Carrier licence ${reg}</p><p>Permit EPR/AB${int(1000, 9999)}CD</p>`;
    } else if (layout === "iso-dates") {
      date = iso;
      body = `<h2>WASTE TRANSFER NOTE</h2><p>Reference: ${ref}</p><p>Collected on ${date}</p><p>Carrier: ${carrier}</p><p>Carrier registration number: ${reg}</p><p>EWC: ${ewc}</p><p>Gross weight ${(t + 9).toFixed(2)} t, tare ${(9).toFixed(2)} t, net weight ${t.toFixed(2)} t</p><p>Vehicle: ${v}</p>${noise}`;
    } else if (layout === "old-reg") {
      date = `${d}-${MON[m - 1]}-${y}`;
      body = `<h2>Waste Transfer Note</h2><p>Transfer note ref: ${ref}</p><p>Date: ${date}</p><p>Carrier: ${carrier}</p><p>Waste carrier registration: ${reg}</p><p>List of Waste code: ${ewc}</p><p>Net weight: ${weight}</p><p>Vehicle: ${v}</p>${noise}`;
    } else {
      weight = `${t.toFixed(1)} tons`;
      body = `<h2>Transfer Note</h2><p>Ticket no: ${ref}</p><p>Date: ${date}</p><p>Carrier: ${carrier}</p><p>Waste carrier licence no: ${reg}</p><p>EWC code ${ewc}</p><p>Load weight ${weight}</p><p>Truck ${v}</p>${noise}`;
    }
    const tonnes = layout === "tons" ? Math.round(t * 10) / 10 : t;
    out.push({ id: `b${String(i + 1).padStart(2, "0")}-${layout}`, layout, html: `<html><body style="font-family:Georgia;padding:30px;font-size:15px">${body}</body></html>`, truth: { reference: ref.toUpperCase(), carrier, carrierRegistration: reg, ewc, tonnes, date: iso, vehicle: v.replace(" ", "") }, distort: false });
  }
  return out;
}
