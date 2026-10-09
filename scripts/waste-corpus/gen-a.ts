// Builds a corpus of transfer notes in common UK layouts, with the answers known by construction.
export type Truth = { reference: string; carrier: string; carrierRegistration: string; ewc: string; tonnes: number; date: string; vehicle: string };
export type Note = { id: string; layout: string; html: string; truth: Truth; distort: boolean };

let seed = 20261009;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

const CARRIERS = ["Haul Ltd", "Greenway Waste Services Ltd", "R & J Skip Hire", "Midlands Aggregates Limited", "Thames Valley Recycling", "A1 Muck Away Ltd", "Brindley Environmental", "Castle Plant & Haulage"];
const EWC = ["17 09 04", "17 01 07", "17 05 04", "17 03 02", "20 03 01", "17 02 01", "17 04 05", "15 01 06", "17 05 03*", "17 06 05*"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const LETTERS = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
const reg = () => `${pick(["CBDU", "CBDL"])}${int(100000, 999999)}`;
const veh = () => `${LETTERS[int(0, 24)]}${LETTERS[int(0, 24)]}${int(10, 25)} ${LETTERS[int(0, 24)]}${LETTERS[int(0, 24)]}${LETTERS[int(0, 24)]}`;
const pad = (n: number) => String(n).padStart(2, "0");

function dateParts() {
  const d = int(1, 28), m = int(1, 12), y = 2026;
  return { d, m, y, iso: `${y}-${pad(m)}-${pad(d)}` };
}
const dateStyles = [
  (p: ReturnType<typeof dateParts>) => `${pad(p.d)}/${pad(p.m)}/${p.y}`,
  (p: ReturnType<typeof dateParts>) => `${pad(p.d)}.${pad(p.m)}.${String(p.y).slice(2)}`,
  (p: ReturnType<typeof dateParts>) => `${p.d} ${MONTHS[p.m - 1]} ${p.y}`,
  (p: ReturnType<typeof dateParts>) => `${p.d}${[1, 21].includes(p.d) ? "st" : [2, 22].includes(p.d) ? "nd" : [3, 23].includes(p.d) ? "rd" : "th"} ${MONTHS[p.m - 1].slice(0, 3)} ${p.y}`,
  (p: ReturnType<typeof dateParts>) => `${pad(p.d)}-${pad(p.m)}-${p.y}`,
];
const noise = () => [
  `Tel: 0${int(1000, 1999)} ${int(100000, 999999)}`,
  `Site: Unit ${int(1, 40)}, Brookside Road, Reading RG${int(1, 9)} ${int(1, 9)}${LETTERS[int(0, 24)]}${LETTERS[int(0, 24)]}`,
  `Skip size: ${pick([6, 8, 12, 16])} yd`,
  `Charge: £${int(60, 480)}.${pad(int(0, 99))} + VAT`,
  `Customer order no: PO-${int(10000, 99999)}`,
];

export function build(n = 40): Note[] {
  const out: Note[] = [];
  for (let i = 0; i < n; i++) {
    const layout = ["paragraph", "table", "weighbridge", "consignment", "letterhead"][i % 5];
    const carrier = pick(CARRIERS);
    const dp = dateParts();
    const dateStr = pick(dateStyles)(dp);
    const tonnes = Math.round((rnd() * 18 + 0.4) * 100) / 100;
    const useKg = rnd() < 0.4;
    const weightStr = useKg ? `${Math.round(tonnes * 1000).toLocaleString("en-GB")} kg` : `${tonnes.toFixed(2)} tonnes`;
    const ewc = layout === "consignment" ? pick(EWC.filter((e) => e.endsWith("*"))) : pick(EWC);
    const ref = layout === "consignment" ? `${LETTERS[int(0, 24)]}${LETTERS[int(0, 24)]}${int(1000, 9999)}/${int(10000, 99999)}` : pick([`HC-${int(10000, 99999)}`, `WTN${int(100000, 999999)}`, `${int(100000, 999999)}`, `T${int(2026001, 2026999)}`, `WTN-2026-${int(100, 999)}`]);
    const r = reg();
    const v = veh();
    const truth: Truth = { reference: ref.toUpperCase(), carrier, carrierRegistration: r, ewc, tonnes, date: dp.iso, vehicle: v.replace(" ", "") };
    const nz = noise();
    let body = "";
    if (layout === "paragraph") {
      body = `<h2>WASTE TRANSFER NOTE</h2>
<p>WTN No: ${ref}</p><p>Date of collection: ${dateStr}</p><p>Carrier: ${carrier}</p><p>Carrier registration ${r.slice(0, 4)} ${r.slice(4)}</p>
<p>Description of waste: Mixed construction and demolition waste</p><p>EWC code ${ewc}</p><p>Net weight ${weightStr}</p><p>Vehicle reg: ${v}</p>
<p>${nz[0]}</p><p>${nz[1]}</p><p>${nz[3]}</p>`;
    } else if (layout === "table") {
      body = `<h2>Waste Transfer Note</h2><table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
<tr><td>Transfer note number</td><td>${ref}</td></tr><tr><td>Date</td><td>${dateStr}</td></tr><tr><td>Carrier</td><td>${carrier}</td></tr>
<tr><td>Waste carrier licence</td><td>${r}</td></tr><tr><td>Waste description</td><td>Soil and stones</td></tr><tr><td>EWC (LoW) code</td><td>${ewc}</td></tr>
<tr><td>Quantity</td><td>${weightStr}</td></tr><tr><td>Vehicle registration</td><td>${v}</td></tr><tr><td>Contact</td><td>${nz[0]}</td></tr><tr><td>Order</td><td>${nz[4]}</td></tr></table>`;
    } else if (layout === "weighbridge") {
      const tare = Math.round(tonnes * 0.8 * 1000) + 6500, gross = Math.round(tonnes * 1000) + tare;
      body = `<h3>WEIGHBRIDGE TICKET</h3><pre style="font-size:14px">Ticket No : ${ref}
Date      : ${dateStr}  ${pad(int(6, 17))}:${pad(int(0, 59))}
Vehicle   : ${v}
Carrier   : ${carrier}
Licence   : ${r}
EWC       : ${ewc}
Gross     : ${gross.toLocaleString("en-GB")} kg
Tare      : ${tare.toLocaleString("en-GB")} kg
Net       : ${Math.round(tonnes * 1000).toLocaleString("en-GB")} kg
${nz[0]}
${nz[2]}</pre>`;
    } else if (layout === "consignment") {
      body = `<h2>HAZARDOUS WASTE CONSIGNMENT NOTE</h2><p>Part A. Consignment note code: ${ref}</p>
<p>Part B. Description of the waste. EWC code ${ewc} &nbsp; Physical form: solid &nbsp; Quantity ${weightStr}</p>
<p>Part C. Carrier's details. Carrier: ${carrier}. Registration no. ${r}. Vehicle ${v}.</p>
<p>Date of collection ${dateStr}.</p><p>${nz[1]}</p><p>${nz[0]}</p>`;
    } else {
      body = `<div style="text-align:center"><h1>${carrier.toUpperCase()}</h1><p>${nz[1]} &middot; ${nz[0]}</p></div><hr/>
<h3>Waste Transfer Note</h3><p>Docket ${ref}</p><p>Tipped: ${dateStr}</p><p>Upper tier carrier licence: ${r}</p>
<p>Waste code: ${ewc.replace(/ /g, "")}</p><p>Load: ${weightStr}</p><p>Wagon: ${v}</p><p>${nz[3]}</p>`;
    }
    // Letterhead and ticket layouts name the carrier outside a "Carrier:" label in some notes: that is what real notes do.
    const distort = i % 3 === 0;
    out.push({ id: `n${String(i + 1).padStart(2, "0")}-${layout}`, layout, html: `<html><body style="font-family:Arial;padding:28px;font-size:15px">${body}</body></html>`, truth, distort });
  }
  return out;
}
