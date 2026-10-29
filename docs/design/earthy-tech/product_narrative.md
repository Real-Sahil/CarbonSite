# Product narrative: the Morning Coffee, first 60 seconds

Status: draft for review. No UI code exists for this.

## Who is looking

Priya, sustainability manager at a 240-person contractor. She opens the dashboard at 08:10 with a coffee, before the site managers ring. She is not here to explore. She wants to know three things: am I on track, did anything change overnight, and is anything about to bite me.

## Principle

The page speaks first, in sentences. Numbers sit inside the sentences and are clickable. Tables exist, but one tap down. Nothing is shown that the records cannot back up. If a figure is estimated, the sentence says so.

## The 60 seconds

**0 to 5 seconds. The greeting.**
The page loads on a warm off-white ground with faint film grain. A serif headline types in once (no loop, skipped under reduced motion):

> Morning, Priya. October closed at **1,942 tCO2e**, 6% lower than last October.

Under it, one quieter line in the body face:

> Three things need you today. Two are waste tickets the phone could not read cleanly. One is a supplier factor that expires on Friday.

The "three things" are real counts from the review queue and the factor register. If the count is zero, the line becomes: "Nothing is waiting on you. The last record was approved yesterday at 16:42."

**5 to 20 seconds. The bento.**
Below the greeting sits a softened bento grid of five tiles, each with a one-sentence headline and a small mono figure.

1. Net zero path: "You are 38 tonnes behind this year's glidepath. Closing it needs about 3 tonnes less per month." A thin line shows actual against target.
2. Hotspot: "Waste hauling is 31% of Scope 3 and the biggest mover." A small Sankey preview.
3. People: "Supplier labour risk is flagged on 2 of 41 suppliers." (Only shown once supplier risk data exists.)
4. Audit readiness: "CSRD E1 is 8 of 11 datapoints ready." A ring.
5. Needs you: the three items from the greeting, as three tappable rows.

Hover physics: a tile lifts 2px and its corner radius relaxes slightly (a spring, about 200ms). Nothing bounces.

**20 to 40 seconds. The first tap.**
Priya taps "Waste hauling is 31%". The tile expands in place (shared-layout transition) into the hotspot view: a Sankey from Scope 3 to categories to suppliers. The sentence above it updates: "Three haulers account for most of it. Thames Valley Skips is up 22% on tonnes."

The breadcrumb reads Summary / Scope 3 / Waste. A chip row shows the active filter and a Save as view button. The URL carries the filter, so she can paste it to a colleague.

**40 to 60 seconds. The ledger.**
She taps "Show the records". The narrative recedes and the Scope 3 ledger rises: a dense table, mono numbers, one row per activity record, each row carrying the factor used and a confidence mark. She sorts by weakest confidence, opens the first row, sees the OCR reading beside the photographed ticket, corrects the weight and approves. The ledger row updates and the sentence on the hotspot view changes by 0.4 tonnes.

She has answered her three questions and fixed one thing, in under a minute, without opening a report.

## Tone rules for generated sentences

Sentences are assembled from data by templates, not written freely by a model, so the numbers are exact and the claim set is closed. Each template has a data guard: if an input is missing it is not rendered, it is replaced by its empty state. Plain verbs, no cheerleading. Never "great job". A bad month is stated as flatly as a good one, then followed by the one action that would help.

## First-run and quiet-day variants

First login, no data: "Nothing here yet, and that is fine. Import last year's fuel and electricity and we will build the first picture together." One button: Import a spreadsheet. A second, lighter link: Try with demo data (the whole dashboard then carries a persistent Demo data label).

Mid-import: "Reading 1,240 rows. Most are clean. 31 need a look." The count is live.

No change overnight: "Quiet night. Nothing moved since yesterday."

## Claims we will not make

No score without a published method. The Social Impact score on the summary is shown only when its inputs exist and its formula is one click away. No "compliant" or "assured" wording anywhere: the Audit Hub says "ready", "partly ready" and "missing", with the missing items listed and linked.
