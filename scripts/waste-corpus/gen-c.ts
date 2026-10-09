export type Note = { id: string; layout: string; html: string; truth: Record<string, string | number | null>; distort: boolean };
let seed = 424242;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n: number) => String(n).padStart(2, "0");
const L = "ABCDEFGHJKLMNOPRSTUVWXYZ";
const CARRIERS = ["Bramley Waste Ltd", "Orchard Plant Hire Limited", "T. Okafor Haulage", "Severn Skips & Recycling", "Lakeside Aggregates plc"];
const EWC = ["17 09 04", "17 05 04", "17 01 01", "20 03 01", "17 04 05", "17 02 01", "17 05 03*"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const veh = () => `${L[int(0, 23)]}${L[int(0, 23)]}${int(10, 25)} ${L[int(0, 23)]}${L[int(0, 23)]}${L[int(0, 23)]}`;

export function build(): Note[] {
  const out: Note[] = [];
  for (let i = 0; i < 30; i++) {
    const layout = ["weekday-date", "thousands-kg", "capital-T", "tel-trap", "collected-by", "two-codes"][i % 6];
    const carrier = pick(CARRIERS);
    const d = int(1, 28), m = int(1, 12), y = 2026;
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    const t = Math.round((rnd() * 22 + 0.6) * 100) / 100;
    const ewc = pick(EWC);
    const ref = pick([`BW${int(10000, 99999)}`, `${int(100000, 999999)}`, `WTN-${int(1000, 9999)}`]);
    const reg = `CBDL${int(100000, 999999)}`;
    const v = veh();
    let body = "";
    let truthCarrier: string | null = carrier;
    let truthTonnes: number | null = t;
    if (layout === "weekday-date") {
      body = `<h2>Waste Transfer Note</h2><p>No: ${ref}</p><p>${pick(DAYS)} ${d} ${MONTHS[m - 1]} ${y}</p><p>Date of collection: ${d} ${MONTHS[m - 1]} ${y}</p><p>Carrier: ${carrier}</p><p>Carrier reg ${reg}</p><p>EWC ${ewc}</p><p>Net weight ${t.toFixed(2)} tonnes</p><p>Vehicle ${v}</p>`;
    } else if (layout === "thousands-kg") {
      truthTonnes = Math.round(t * 1000) / 1000;
      body = `<h2>WASTE TRANSFER NOTE</h2><p>Ref: ${ref}</p><p>Date: ${pad(d)}/${pad(m)}/${y}</p><p>Carrier: ${carrier}</p><p>Registration: ${reg}</p><p>EWC code: ${ewc}</p><p>Net weight: ${Math.round(t * 1000).toLocaleString("en-GB")} kg</p><p>Vehicle: ${v}</p>`;
    } else if (layout === "capital-T") {
      body = `<h2>Waste Transfer Note</h2><p>Note ref ${ref}</p><p>Date ${pad(d)}.${pad(m)}.${y}</p><p>Carrier: ${carrier}</p><p>Licence ${reg}</p><p>Waste code ${ewc}</p><p>Weight ${t.toFixed(1)} T</p><p>Vehicle ${v}</p>`;
      truthTonnes = Math.round(t * 10) / 10;
    } else if (layout === "tel-trap") {
      body = `<h2>Waste Transfer Note</h2><p>Ticket: Tel 0${int(1000, 1999)} ${int(100000, 999999)}</p><p>Transfer note number ${ref}</p><p>Date: ${pad(d)}/${pad(m)}/${y}</p><p>Carrier: ${carrier}</p><p>Reg ${reg}</p><p>EWC ${ewc}</p><p>Quantity: ${t.toFixed(2)} tonnes</p><p>Vehicle ${v}</p>`;
    } else if (layout === "collected-by") {
      truthCarrier = null; // "Collected by" is not labelled "Carrier": the reader must not guess a name.
      body = `<h2>Waste Transfer Note</h2><p>Ref: ${ref}</p><p>Date: ${pad(d)}/${pad(m)}/${y}</p><p>Collected by: ${carrier}</p><p>Registration ${reg}</p><p>EWC ${ewc}</p><p>Weight: ${t.toFixed(2)} tonnes</p><p>Vehicle ${v}</p>`;
    } else {
      const second = pick(EWC.filter((e) => e !== ewc));
      body = `<h2>Waste Transfer Note</h2><p>Ref: ${ref}</p><p>Date: ${pad(d)}/${pad(m)}/${y}</p><p>Carrier: ${carrier}</p><p>Registration ${reg}</p><p>EWC codes: ${ewc}, ${second}</p><p>Net weight ${t.toFixed(2)} tonnes</p><p>Vehicle ${v}</p>`;
    }
    out.push({ id: `c${String(i + 1).padStart(2, "0")}-${layout}`, layout, html: `<html><body style="font-family:Verdana;padding:30px;font-size:14px">${body}</body></html>`, truth: { reference: ref.toUpperCase(), carrier: truthCarrier, carrierRegistration: reg, ewc, tonnes: truthTonnes, date: iso, vehicle: v.replace(" ", "") }, distort: false });
  }
  // Documents that are not transfer notes: nothing should be read from them.
  const NOT = [
    `<h2>INVOICE</h2><p>Invoice No: INV-${int(10000, 99999)}</p><p>Date: 03/04/2026</p><p>Supplier: Brightside Stationery Ltd</p><p>Total due £1,240.50 (VAT £206.75)</p><p>Account ref 88${int(1000, 9999)}</p>`,
    `<h2>Electricity bill</h2><p>Account number 7${int(100000, 999999)}</p><p>Bill date 28 February 2026</p><p>You used 4,320 kWh</p><p>Amount to pay £812.44</p>`,
    `<h2>Delivery Note</h2><p>Delivery note no 55${int(1000, 9999)}</p><p>Date 11/05/2026</p><p>Quantity 24 pallets</p><p>Customer: Meridian Builders Ltd</p>`,
    `<h2>Meeting minutes</h2><p>Attendees: A. Smith, B. Jones</p><p>Date: 02/06/2026</p><p>Actions: review skip hire contract by 30 June</p>`,
    `<h2>Method statement</h2><p>Document ref MS-${int(100, 999)}</p><p>Revision 3 dated 14/01/2026</p><p>Hazard: working at height</p>`,
    `<h2>Quote</h2><p>Quote reference Q${int(1000, 9999)}</p><p>Skip hire 8 yd at £${int(100, 300)}.00</p><p>Valid until 30 September 2026</p>`,
  ];
  NOT.forEach((b, j) => out.push({ id: `x${j + 1}-not-a-note`, layout: "not-a-note", html: `<html><body style="font-family:Arial;padding:30px">${b}</body></html>`, truth: { reference: null, carrier: null, carrierRegistration: null, ewc: null, tonnes: null, date: null, vehicle: null }, distort: false }));
  return out;
}
