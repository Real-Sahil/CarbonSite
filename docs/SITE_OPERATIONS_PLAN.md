# Site operations plan: fuel, plant and controlled material movements

Written 6 October 2026. This is a plan, not built. It says what the platform already holds, what is missing for each project, and a build order. It is not legal advice: where it describes how sites handle waste and fuel, the organisation's competent person must confirm it for their own sites and nation.

## 1. What exists today

| Need | Today | Where |
|---|---|---|
| Fuel bought | Fuel receipts and bills become `s1-mobile` and `s1-stationary` records with litres and fuel type (diesel, HVO and blends) | field app capture, Add from a bill, fuel card connector |
| Machines | `PlantAsset` register: category, make, model, serial, fuel type, owned or hired, site, on-hire dates | `lib/plant/`, Plant page |
| Machine fuel and hours | `PlantTelematicsReading`: operating hours, idle hours, litres per period, from ISO 15143-3 feeds or CSV. Monitoring only, never inventory | `lib/plant/telematics.ts` |
| Site fuel reconciliation | Plant page compares telematics litres with the site's approved diesel and HVO records | Plant page |
| Waste and hazardous loads | `WasteRecord`: EWC code, hazardous flag, carrier name and registration number, transfer or consignment note reference, destination permit, vehicle registration, tonnes | `WasteRecord` |
| Permits and incidents | `EnvironmentalPermit` with conditions, `EnvironmentalIncident`, `EnvironmentalAspect`, method statements, planning obligations | HSE and compliance modules |

## 2. What is missing

Fuel:
- No record of **how many bowsers or fixed tanks** a project has, what each holds, or who owns it.
- No record of **fuel delivered into each store by type and month**, so no stock position and no loss or theft check.
- No **issue from store to machine** (litres, hours or meter reading, who). Machine litres only exist where telematics exists.
- No monthly view per machine of **litres, hours, litres per hour and idle share**, including hired plant that has no feed.

Contaminated and hazardous material:
- No **site-level chain of custody**: planned, loaded, in transit, received, rejected.
- No stored **classification evidence**: sample or laboratory result references, hazardous properties, who classified it and when.
- No **checks** that the carrier is registered and in date, that the destination's permit or exemption covers that EWC code, that a hazardous load has its consignment note, or that the receipt copy came back.
- No link from loads to a **method statement, permit or planning condition**, and no haulage carbon for waste movements.

## 3. Fuel storage, issue and machine consumption

New records, all scoped to the organisation and checked with `orgRefsError()`:

- **FuelStore**: a bowser, fixed tank or IBC. Site and project, kind, capacity in litres, fuel type, owned or hired, serial or registration, bunded or not, last inspection date, on and off site dates.
- **FuelDelivery**: into a store. Date, supplier, fuel type, litres, delivery note reference, ticket photo, received by. The existing fuel ticket capture gains a "which store" field, so one photograph still does the job.
- **FuelIssue**: out of a store into a machine or vehicle. Date, store, plant asset or vehicle, litres, hours or meter reading, issued by. A quick entry in the field app, scanned from a code on the machine, working offline.
- **FuelDip**: a measured level. Opening level plus deliveries minus issues minus closing level is the **variance**. A variance above a set share is flagged as possible loss, leak or theft.

Monthly roll-ups, with no raw aggregation at request time:
- Per store: opening, litres in by fuel type, litres out, closing, variance.
- Per machine: litres, hours, litres per hour against its category's range, idle share where a feed reports it, fuel type including HVO share.
- Per project: total litres by fuel type, and the gap against the approved fuel records already in the inventory.

**Decision on carbon basis.** The inventory keeps counting fuel from receipts and bills, as it does now. The new records never create a second set of activity records. They allocate and reconcile: which machine and project burned it, and whether deliveries, issues and bills agree. Allocation to machines and projects is where the new value is. A later option is to derive records from issues for sites with no bills.

Fuel type needs care: gas oil (rebated, "red"), road diesel, HVO and its blends, petrol and kerosene have different factors. The store and delivery carry the fuel type so the calculation picks the right factor. Whether a site may lawfully use rebated gas oil in a given machine is a tax question for the organisation; the platform records what was delivered and does not judge it.

## 4. Controlled material movements: contaminated soil and other hazardous material

"Contagious" is read here as contaminated and hazardous material: contaminated soil, asbestos, invasive species such as Japanese knotweed (controlled waste), and biologically hazardous material such as sewage or clinical waste. Confirm that is what is meant.

### What good looks like on a UK site (England; Wales, Scotland and Northern Ireland differ)

1. **Classify before it moves.** A competent person classifies the material, using sampling and laboratory results and the Environment Agency's waste classification guidance (WM3). The result is an EWC code, for example 17 05 04 for soil and stones, or 17 05 03* where it contains hazardous substances, plus the hazardous properties that make it so. Landfill acceptance also needs waste acceptance criteria testing.
2. **Choose the route.** Reuse on site under the CL:AIRE Definition of Waste Code of Practice with a materials management plan, treatment, or disposal at a facility whose permit or exemption covers that EWC code.
3. **Duty of care.** The producer checks the carrier is a registered waste carrier and the destination holds a permit or valid exemption. Non-hazardous loads need a waste transfer note. Hazardous loads need a consignment note. Records are kept for the periods the regulations set; confirm them (commonly two years for transfer notes and three for hazardous consignment notes).
4. **Move it safely.** Named vehicle and driver, covered loads, a routed and agreed haul route, wheel washing where needed, spill kit on board, and dangerous goods rules (ADR) where they apply. Asbestos goes only through licensed or competent contractors under the relevant regulations.
5. **Close the loop.** The destination confirms receipt, the returned copy of the note is matched to the load, and any load not received by an agreed date is chased.
6. **Keep evidence.** Notes, tickets with weights, photographs, laboratory reports, permits, carrier registrations.

### What the platform adds

- **MaterialClassification**: per stockpile or source area. Description, location, EWC code, hazardous properties, laboratory report references, classifier, date, evidence files, status.
- **MaterialMovement**: one per load or consignment. Date, from and to, destination name and permit or exemption number, carrier and registration expiry, vehicle and driver, ticket weight, transfer or consignment note reference and file, load photograph with GPS and time, status (planned, dispatched, received, rejected), receipt date and returned copy.
- On approval a movement writes the existing `WasteRecord` and its activity record, so waste totals, diversion, the hazardous share for ESRS E5 and the carbon calculation come from the one pipeline and nothing is typed twice.
- Haulage carbon for the load: tonnes times distance times the DEFRA HGV tonne-kilometre factor, the same method already used for delivery notes. Route distance from the existing routing client or typed.
- Links to the project, site, contract, method statement, permit and any planning condition.

### Deterministic checks (no model)

Each is shown on the movement with where to fix it, following the repo's "say where to fix it" rule:
- Carrier registration present and not expired.
- Hazardous load has the hazardous flag, an EWC code marked with an asterisk, and a consignment note reference.
- The destination's recorded authorised EWC list includes the load's code. This depends on the organisation entering the permit's list; the platform does not read the regulator's register.
- Ticket weight within a set tolerance of the planned load.
- No returned copy by an agreed date.
- Retention reminders.
An optional later step is a link that opens the regulator's public register for a carrier or permit number. No automatic lookup is planned until its terms are checked.

Not built on purpose: any claim that a load is lawful. The platform shows whether the evidence is complete; the competent person decides.

## 5. Other things that are probably missing

Ordered by how often a contractor is asked about them.

1. **HGV movement limits.** Planning conditions often cap daily lorry movements. Count movements from the movement register and the delivery notes against the obligation already held in planning obligations, with an early warning.
2. **Plant compliance dates.** Thorough examination (LOLER and PUWER), service due by hours (from telematics or meter readings), operator competence cards (CPCS, NPORS) linked to the machine, with reminders through the existing monitor.
3. **Low emission zone and emission stage.** Engine stage and registration on `PlantAsset` for sites in zones that restrict non-road mobile machinery (London's NRMM rules, others). Confirm current standards for each city.
4. **Fuel and hours budgets per project phase.** Planned litres and machine hours, actual against plan, alerting when the run rate is ahead, built on the carbon budget burn-down.
5. **Site waste plan, planned against actual.** Many clients still ask for it by contract even though the legal requirement was repealed in England.
6. **Environmental monitoring logs.** Noise, dust, vibration and water discharge readings against consent or planning limits, and complaints.
7. **Spill readiness.** Spill kit and drip tray checks, bund inspection, linked to the incident register.
8. **Temporary energy.** Grid connection against generator hours for cabins and lighting, with meter readings from photographs (already possible) and hired generators in the plant register.
9. **Document expiry for carriers, haulage subcontractors and plant suppliers.** Registration, insurance, operator licence, FORS or CLOCS standing, with one reminder list.
10. **Materials ordered against used.** Wastage rate per material from delivery notes and waste records.
11. **Scan-to-record on site.** A code on each machine, store and skip that opens the right form in the field app, offline.
12. **Fuel supplier feeds.** Delivery data straight from suppliers or fuel card providers through the existing connector ingest, waiting for review like any import.

## 6. Build order

| Phase | Scope | Why first |
|---|---|---|
| 1 | FuelStore, FuelDelivery, FuelIssue, FuelDip, monthly roll-ups per store, machine and project, variance flag, field app quick entry, reconciliation with existing fuel records | Answers the bowser and machine-litres questions directly and builds on plant and fuel receipts |
| 2 | MaterialClassification and MaterialMovement writing `WasteRecord`, status flow, load photograph and notes, haulage carbon | Answers the contaminated soil question and keeps one waste pipeline |
| 3 | Deterministic checks and reminders (carrier expiry, EWC coverage, returned copy, retention, plant examinations, emission stage), HGV movement limits | Turns records into compliance protection |
| 4 | Fuel budgets per phase and alerts, supplier feeds, scan-to-record, site waste plan | Efficiency and automation once the data exists |

Each phase follows the repo's rules: additive migrations with row level security, org ids checked on every write, audit log entries, Zod at the boundary, tenancy tests, and an end-to-end run on the demo data before merging.

## 7. Questions for the owner

1. Is "contagious" meant to include biologically hazardous material, or only contaminated and hazardous construction waste?
2. England first, with Wales, Scotland and Northern Ireland as later variants?
3. Confirm the carbon basis in section 3: receipts stay the inventory, issues allocate and reconcile.
4. Should the platform ever call the regulator's public register, or only link to it?
5. Which phase should a pilot customer see first? The fuel module is the quickest to demonstrate.
