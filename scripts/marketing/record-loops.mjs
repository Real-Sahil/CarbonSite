// Records the product loops and stills used on the marketing site from a
// running local build signed in to the demo tenant (Northgate Civils Ltd).
// Usage: ORG_ID=... STATE=admin-storage.json FFMPEG=/path/to/ffmpeg \
//   RUN_ID=... RECORD_ID=... SUBMISSION_ID=... PLAN_ID=... node scripts/marketing/record-loops.mjs [loopName|shots]
// ffmpeg is not a project dependency; `npx ffmpeg-static` provides one.
import { chromium } from "playwright";
import { readdirSync, rmSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
const ids = { orgId: process.env.ORG_ID, runs: { FY2025: process.env.RUN_ID } };
const O = `${process.env.BASE_URL ?? "http://localhost:3000"}/orgs/${ids.orgId}`;
const FF = process.env.FFMPEG ?? "ffmpeg";
const STATE = process.env.STATE;
const TMP = process.env.TMP_DIR ?? "/tmp/metricora-recordings";
mkdirSync(TMP, { recursive: true });
const OUT = "public/marketing/loops/";
const SHOTS = "public/marketing/screens/";
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const glide = (page, to, ms) => page.evaluate(({ to, ms }) => new Promise((res) => { const from = window.scrollY, t0 = performance.now(); const step = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; window.scrollTo(0, from + (to - from) * e); k < 1 ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step); }), { to, ms });
const loops = {
  prove: { url: "/dashboard", act: async (p) => { await p.waitForTimeout(1500); await glide(p, 700, 6000); await p.waitForTimeout(1200); await glide(p, 0, 4000); await p.waitForTimeout(800); } },
  review: { url: `/submissions/${process.env.SUBMISSION_ID}`, act: async (p) => { await p.waitForTimeout(1500); await glide(p, 900, 7000); await p.waitForTimeout(1500); await glide(p, 0, 4000); } },
  calc: { url: `/calculations/${ids.runs.FY2025}`, act: async (p) => { await p.waitForTimeout(1500); await glide(p, 1300, 9000); await p.waitForTimeout(1200); await glide(p, 0, 4000); } },
  record: { url: `/records/${process.env.RECORD_ID}`, act: async (p) => { await p.waitForTimeout(1500); await glide(p, 600, 5000); await p.waitForTimeout(2000); await glide(p, 0, 3500); } },
  compliance: { url: "/compliance/crosswalk", act: async (p) => { await p.waitForTimeout(1500); await glide(p, 1100, 8000); await p.waitForTimeout(1000); await glide(p, 0, 4000); } },
  reports: { url: "/reports", act: async (p) => { await p.waitForTimeout(1500); await glide(p, 700, 6000); await p.waitForTimeout(1500); await glide(p, 0, 3500); } },
  // The guided Carbon Reduction Plan, section by section (PLAN_ID = a plan in the demo tenant).
  plan: {
    url: `/carbon-reduction-plan/${process.env.PLAN_ID}`,
    act: async (p) => {
      for (const section of ["Supplier and boundary", "Emissions", "Baseline", "Net zero and targets", "Reduction projects", "Declaration", "Check and generate"]) {
        await p.click(`nav >> text=${section}`);
        await p.waitForTimeout(2600);
      }
    },
  },
};
// Sections of the guided plan captured as stills: file name -> section label.
const planShots = { "crp-emissions": "Emissions", "crp-baseline": "Baseline", "crp-check": "Check and generate" };
const only = process.argv[2];
for (const [name, L] of Object.entries(loops)) {
  if (only && only !== name) continue;
  const dir = `${TMP}/${name}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, storageState: STATE, recordVideo: { dir, size: { width: 1440, height: 900 } } });
  const t0 = Date.now();
  const p = await ctx.newPage();
  await p.goto(O + L.url, { waitUntil: "load" }); await p.waitForTimeout(3500);
  await p.waitForTimeout(1500);
  const s = (Date.now() - t0) / 1000;
  await L.act(p);
  const e = (Date.now() - t0) / 1000;
  await p.close(); await ctx.close();
  const webm = `${dir}/${readdirSync(dir).find((f) => f.endsWith(".webm"))}`;
  execSync(`${FF} -y -loglevel error -ss ${s.toFixed(2)} -to ${e.toFixed(2)} -i ${webm} -vf "scale=1280:-2,fps=25" -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p -an -movflags +faststart ${OUT}${name}.mp4`);
  execSync(`${FF} -y -loglevel error -ss ${(s + 0.6).toFixed(2)} -i ${webm} -frames:v 1 -vf "scale=1280:-2" -q:v 4 ${OUT}${name}.jpg`);
  console.log(name, (e - s).toFixed(1) + "s", execSync(`du -k ${OUT}${name}.mp4`).toString().trim());
}
// stills at 2x
const shots = { dashboard: "/dashboard", submissions: "/submissions", "submission-review": `/submissions/${process.env.SUBMISSION_ID}`, "calc-run": `/calculations/${ids.runs.FY2025}`, record: `/records/${process.env.RECORD_ID}`, reports: "/reports", crosswalk: "/compliance/crosswalk", "esrs-e1": "/compliance/esrs-e1", deadlines: "/compliance/deadlines", assurance: "/compliance/assurance-readiness", "energy-contracts": "/settings/energy-instruments", "carbon-price": "/settings/carbon-price", boundary: "/boundary", analytics: "/analytics", calculations: "/calculations", records: "/records", "audit-trail": "/audit", "base-year": "/base-year", "transition-plan": "/transition-plan" };
if (!only || only === "shots") {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, storageState: STATE });
  for (const [n, u] of Object.entries(shots)) { const p = await ctx.newPage(); // The dashboard holds an SSE stream open, so the network never goes idle.
    await p.goto(O + u, { waitUntil: "load" }); await p.waitForTimeout(3500); await p.screenshot({ path: `${TMP}/${n}.png` }); await p.close();
    execSync(`${FF} -y -loglevel error -i ${TMP}/${n}.png -vf scale=2400:-2 -q:v 5 ${SHOTS}${n}.jpg`); }
  console.log("shots", Object.keys(shots).length);
}
if (process.env.PLAN_ID && (!only || only === "shots" || only === "planshots")) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, storageState: STATE });
    const p = await ctx.newPage();
    await p.goto(`${O}/carbon-reduction-plan/${process.env.PLAN_ID}`, { waitUntil: "load" }); await p.waitForTimeout(3500);
    for (const [n, section] of Object.entries(planShots)) {
      await p.click(`nav >> text=${section}`); await p.waitForTimeout(1500);
      await p.screenshot({ path: `${TMP}/${n}.png` });
      execSync(`${FF} -y -loglevel error -i ${TMP}/${n}.png -vf scale=2400:-2 -q:v 5 ${SHOTS}${n}.jpg`);
    }
    await p.goto(`${O}/reports`, { waitUntil: "load" }); await p.waitForTimeout(2500);
    await p.screenshot({ path: `${TMP}/report-picker.png` });
    execSync(`${FF} -y -loglevel error -i ${TMP}/report-picker.png -vf scale=2400:-2 -q:v 5 ${SHOTS}report-picker.jpg`);
    await p.close();
    console.log("plan shots", Object.keys(planShots).length + 1);
  await ctx.close();
}
await b.close();
