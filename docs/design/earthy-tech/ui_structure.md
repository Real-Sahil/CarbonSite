# UI structure: component tree

Status: revision 2, final for visual review. Incorporates the owner's decisions on the Social Impact baseline, UK-first Audit Hub, typography split, the two-hue colour rule, uniform radii and archival empty states. This is a specification in words. No component has been built, and none will be until the artefacts are approved.

## Decisions applied in this revision

1. The Social Impact baseline appears on the Executive Summary from day one, as "Baseline in Progress" with named phases. It never shows a letter grade or a bare score.
2. The Audit Hub opens on the UK regime (FCA SDR and UK-adopted TCFD). CSRD sits beside it, un-toggled, with an explanatory tooltip.
3. Serif is used for the narrative greeting and primary page titles only. Every data label is mono. Every other interface element is sans.
4. Terracotta marks interaction. A separate burnt brick red marks compliance alerts and negative trends. The two never share a component.
5. All corners are uniform and soft (12 to 16px). No uneven radii.
6. Empty states use cleaned, tinted public-domain archival sketches that bloom into colour when a data source connects.

## How to read this

Every component is listed with its purpose, the props it takes (name, meaning) and its empty state. Props describe the data contract, not an implementation. Names are working titles.

Five rules apply to every component:

1. **Sentences come from templates with data guards.** A component that shows a sentence receives structured values, never prose. If a required value is missing, the component renders its empty state instead of a gap or a zero.
2. **Numbers are links.** Any figure in a sentence can be tapped to open the view that produced it. The destination is always a URL, so the state can be shared.
3. **Empty states are written by a person, not a template.** Each says what is missing, why that is fine or not, and the one next step, with a link to the page where it is fixed.
4. **Type roles are fixed.** Serif appears only in `NarrativeGreeting` and primary page titles. Mono is used for every data label: figures, units, ledger headers, axis labels, chip values, table dates and hashes. Sans is used for everything else, including tile headline sentences.
5. **Two reds, two jobs.** Terracotta means "you can act here": hover, selected state, primary highlight, links in running text. Brick red means "something is wrong or worsening": a compliance alert, a negative trend, a failed check. A component uses one or the other, never both, and brick red always travels with an icon and a word.

## The tree

```
AppShell
  SideRail
  TopBar
    Breadcrumb
    PeriodSwitch
    FilterChips
    SaveViewButton
    DemoDataBadge
  PageSurface (warm ground, film grain)
    ExecutiveSummaryPage
      NarrativeGreeting
      NeedsYouStrip
      SummaryBento
        NetZeroTile
        HotspotTile
          SankeyPreview
        SocialBaselineTile
        AuditReadinessTile
          ReadinessRing
        NeedsYouTile
    CarbonAccountingPage
      ScopeToggle
      CarbonBentoGrid
        ScopeTotalTile (x3)
        MethodNote
        TrendTile
        DataQualityTile
      SankeyHotspotTracker
      Scope3CategoryList
      Scope3Ledger
        LedgerToolbar
        LedgerRow
        ConfidenceMark
      RecordDrawer
        SourceViewer
        OcrReadingPair
        FactorAndFormula
        HistoryTimeline
    SocialValuesPage
      SocialBento
        InclusionTile
        SupplyChainLabourRiskTile
        CommunityInvestmentTile
      SupplierRiskList
      SocialBaselineCard
    AuditHubPage
      FrameworkTabs
      ReadinessSummary
      DatapointChecklist
      GapList
      ExportPackDialog
      AuditChainStatus
    EmptyState (shared)
    Toast (shared)
```

## Shell

### AppShell
Purpose: frame for every page. Holds the rail, top bar and the page surface, and owns the URL as the single source of state (period, filters, drill path).
Props: organisation (id, name, reporting currency, country), user (name, role), activeModule, urlState (parsed filters, period, drill path).
Empty state: not applicable. If the organisation has no reporting period yet, the page surface shows the first-run state of the Executive Summary.

### SideRail
Purpose: four destinations only: Summary, Carbon, Social, Audit. Quiet by default, labels visible on hover and focus, always visible on wide screens.
Props: items (label, route, count badge optional), activeModule, collapsed.
Empty state: a module with nothing in it still appears; its page explains what to add. Nothing is hidden because it is empty.

### Breadcrumb
Purpose: shows the drill path, for example Summary / Scope 3 / Waste. Each crumb steps back one level and the current crumb is plain text.
Props: path (ordered crumbs with label and route), maxVisible.
Empty state: at the top level it shows only the module name.

### PeriodSwitch
Purpose: choose the reporting period. Shows the period as words ("October 2026") with the status beside it (open, closed, published).
Props: periods (id, label, status), selectedId.
Empty state: "No periods yet. Set up your reporting year in Settings." with a link.

### FilterChips
Purpose: active filters as removable chips (project, site, scope, supplier, review status). The chips mirror the URL.
Props: filters (key, label, value), onRemove, onClearAll.
Empty state: none shown. The row collapses to nothing when no filter is active.

### SaveViewButton
Purpose: name and keep the current filters and drill path as a saved view the whole team can open.
Props: currentState (as URL), existingViews (name, owner), canSave (role check).
Empty state: first use shows one line: "Keep this view so the team can open it too."

### DemoDataBadge
Purpose: persistent label whenever any figure on screen comes from demonstration data. Cannot be dismissed.
Props: active.
Empty state: not rendered when data is real.

## Executive Summary

### NarrativeGreeting
Purpose: the first thing read. A serif headline giving the headline figure and its change, plus one quieter line naming what needs attention.
Props: userFirstName, periodLabel, totalTco2e, comparisonTco2e, comparisonLabel, needsYou (counts by kind), lastApprovalAt, partOfDay.
Empty state (no data): "Nothing here yet, and that is fine. Import last year's fuel and electricity and we will build the first picture together." One primary button, Import a spreadsheet, and a lighter link, Try with demo data.
Variants: nothing waiting ("Nothing is waiting on you. The last record was approved yesterday at 16:42."), mid-import ("Reading 1,240 rows. 31 need a look."), quiet night ("Quiet night. Nothing moved since yesterday.").

### NeedsYouStrip
Purpose: the "three things" as tappable rows under the greeting, each naming the item and its age.
Props: items (kind, label, ageHours, route), maxItems.
Empty state: omitted when there are none; the greeting carries the "nothing waiting" line.

### SummaryBento
Purpose: the softened bento grid. Exactly as many tiles as there are things to say, never a placeholder cell. Tiles reorder by what needs attention, not by a fixed layout.
Props: tiles (id, priority, span), layoutDensity.
Empty state: with no data, shows a single wide tile with the first-run message instead of five hollow ones.

### NetZeroTile
Purpose: progress against the glidepath in one sentence and a thin actual-versus-target line.
Props: targetYear, baseYearTco2e, ytdTco2e, glidepathYtdTco2e, requiredMonthlyChange, targetStatus (on track, behind, no target set).
Empty state: "No target set yet. Choose a base year and a goal and we will draw the path." Link to Targets.

### HotspotTile
Purpose: names the biggest and fastest-moving source and shows a small Sankey. Tapping expands it in place to the full tracker.
Props: topCategory (code, label, share, changeVsPrior), topFlows (up to 5), scope.
Empty state: "No emissions calculated for this period. Run a calculation after you import." Link to Calculations.

### SocialBaselineTile
Purpose: shows the Social Impact baseline from the first login, framed as "Baseline in Progress". It states the current phase in words and what completes it. It never shows a letter grade, a percentage score or a rank.
Props: phases (ordered list: id, label, status of not started, in progress or complete, completedAt), currentPhaseId, nextAction (label, route), inputsAvailable (inclusion, labourRisk, community), methodVersion, methodRoute.
Phases (proposed): Phase 1 Data integration (connect a workforce return, supplier list or community records), Phase 2 First measurement (inputs read and checked), Phase 3 Baseline set (first full period measured and signed off), Phase 4 Tracking (change against the baseline). Names are for review.
Sentence template: "Social baseline in progress. Phase 1, data integration: workforce return added, supplier list and community records still to come."
Empty state (nothing connected): the tile shows the four phases as a quiet row with Phase 1 highlighted and one action, "Add your first social data". The archival sketch (a seedling) sits behind the text at low strength and blooms when the first source connects.
Honesty rule: the phase is derived from which inputs exist, never from a judgement of performance. The method link opens the published formula or, until a score is introduced, the milestone definitions. A numeric or graded score is not shown until the method is published and a full period has been measured; this tile is where it would first appear, with the words "Baseline set" replacing "in progress".
Colour: terracotta for the next-action highlight; no brick red, because an unfinished baseline is not an alert.

### AuditReadinessTile
Purpose: how many required datapoints for the primary regime are ready, as a ring and a sentence. The primary regime is the UK one (FCA SDR and UK-adopted TCFD). Wording is "ready", "partly ready" or "missing", never "compliant".
Props: framework (UK regime by default), readyCount, partialCount, missingCount, totalCount, hasCriticalGap.
Empty state: "Nothing to check yet. Once a period is calculated we will list what the UK regime asks for and what you already have." Link to Audit Hub.
Colour: a critical gap (a required datapoint missing near a deadline) uses brick red with an icon and the word "Missing". Otherwise the ring is moss.

### NeedsYouTile
Purpose: the review queue and expiring items in one tile for those who skip the greeting.
Props: items, totalCount.
Empty state: "All clear." followed by the time of the last approval.

## Carbon Accounting

### ScopeToggle
Purpose: switch between all scopes, Scope 1, 2 and 3. Scope 2 offers location-based and market-based side by side, never added together.
Props: selectedScope, scope2Method, availableScopes.
Empty state: a scope with no records is selectable and says so on arrival.

### CarbonBentoGrid
Purpose: totals by scope, trend and data quality as tiles with one-sentence headlines.
Props: totalsByScope (tCO2e, share, change), trendSeries (period, tCO2e), dataQuality (share measured, share estimated), unpublishedDifference (signed tCO2e against the latest published snapshot).
Empty state: per tile, e.g. Scope 1: "No fuel or gas records for this period." with a link to the record form.

### ScopeTotalTile
Purpose: one scope's total, its share and its change, with a sentence that says what drives it.
Props: scope, tco2e, share, changeVsPrior, topDriver (label, share), method (for Scope 2).
Empty state: as above, per scope.

### MethodNote
Purpose: one visible line stating the method and factor library behind the page ("Location-based. DEFRA 2026.1."). Links to the methodology page.
Props: methodologyVersion, factorLibrary (name, year, attribution).
Empty state: not applicable; shows "No calculation run yet" until one exists.

### TrendTile
Purpose: monthly emissions line with the target path behind it.
Props: series, targetSeries optional, annotations (publication events).
Empty state: "One month is a point, not a trend. A second month will draw the line."

### DataQualityTile
Purpose: share of the total backed by measured data, estimated data, and spend-based proxies, with the count of records needing review.
Props: measuredShare, estimatedShare, spendBasedShare, reviewCount.
Empty state: "Nothing to grade yet."

### SankeyHotspotTracker
Purpose: the central exploration tool. Flow from scope to category to supplier to site, band width proportional to tCO2e. Selecting a band filters the page and writes the choice to the URL.
Props: nodes (id, level, label, tco2e), links (source, target, tco2e), selected (path), minShare (hides slivers into an "Other" band with a count), reducedMotion.
Empty state: "No flows to draw yet. A Sankey needs at least two categories with emissions." Text alternative always provided as a ranked list the same data can be read from.
Accessibility: every band reachable by keyboard; the ranked list is the primary reading order for screen readers.

### Scope3CategoryList
Purpose: the 15 GHG Protocol categories as a ranked list with share and a presence marker ("calculated", "no data", "excluded by you"). A category excluded must carry the reason the organisation gave.
Props: categories (code, label, tco2e, share, status, exclusionReason).
Empty state: each category with no data says "No data. Add it" with a link; it is never silently marked not applicable.

### Scope3Ledger
Purpose: the granular table, one row per activity record. Sorted weakest confidence first by default. Dense, mono figures, sticky header, stacks into labelled cards under 640px.
Props: rows (id, date, supplier, category, quantity and unit, tco2e, factor id, confidence, review status), sort, filters, cursor, totalCount.
Empty state: "No records match these filters." with the filter chips repeated and a Clear filters button; if the period has no records at all: "No records yet. Import a spreadsheet or have a site photograph a ticket."

### LedgerToolbar
Purpose: search, filter, column choice and export of the current slice.
Props: searchTerm, activeFilters, columns, canExport.
Empty state: not applicable.

### LedgerRow
Purpose: one record. Opens the drawer on activation.
Props: record summary, selected, onOpen.
Empty state: not applicable.

### ConfidenceMark
Purpose: small mark showing how reliable the reading is, always paired with text for those who cannot rely on colour ("Weak", "Changed", "Clean").
Props: level, ocrConfidence optional, wasCorrected.
Empty state: a dash when the record was not read by OCR.

### RecordDrawer
Purpose: everything behind one row without leaving the ledger: the source, the reading, the factor, the formula and the history.
Props: recordId, canApprove, canCorrect.
Empty state: "This record has no attached evidence." with an Add evidence button.
Parts: SourceViewer (photographed ticket or file), OcrReadingPair (OCR reading beside the corrected value), FactorAndFormula (factor name, library, year, the formula written out), HistoryTimeline (audit entries with the chain check).

## Social Values

### SocialBento
Purpose: the three social tiles. A tile appears only when its data exists; until then the page shows one invitation, not three blanks.
Props: inclusion (available, metrics), labourRisk (available, flagged, assessed), community (available, amount, hours, currency).
Empty state: "Social figures start with a supplier list or a workforce return. Add either and this page fills in." Two links.

### InclusionTile
Purpose: workforce composition and pay-gap figures the organisation has supplied, with the date of the return and the definition used.
Props: metrics (label, value, basis, asAt), coverageShare (share of staff the return covers).
Empty state: "No workforce return added." Link to Settings. Small groups are suppressed with a stated threshold so no individual is identifiable.

### SupplyChainLabourRiskTile
Purpose: how many suppliers are flagged, on what grounds, and how many have been assessed at all.
Props: assessedCount, flaggedCount, flagBasis (country risk, sector risk, questionnaire), topFlags.
Empty state: "No suppliers assessed yet." Link to supplier list.
Note: a flag states its basis. Country or sector risk is described as exposure, never as an accusation against a named supplier.

### CommunityInvestmentTile
Purpose: money, hours and in-kind support recorded against local programmes, by contract where relevant.
Props: totalValue (currency), volunteerHours, programmes (name, value), period.
Empty state: "No community investment recorded." Link to the entry form.

### SupplierRiskList
Purpose: flagged suppliers with their emissions share beside the risk, so the two views meet. Opens the ledger filtered to that supplier.
Props: suppliers (name, flags, tco2e, share, lastAssessedAt).
Empty state: "No suppliers flagged." with the count assessed.

### SocialBaselineCard
Purpose: the full version of the Summary's baseline tile. Lists every phase with its checklist, which inputs are connected, what each phase needs and who can complete it. When the baseline is set, it shows change against that baseline in words and mono figures, with the method one click away.
Props: phases (id, label, status, requirements with done flags, completedAt), inputs (label, value, weight, available), methodVersion, baselineSetAt optional.
Empty state: "No social data connected yet. Phase 1 starts with a workforce return, a supplier list or community records. Pick whichever you have." Three links, one per input. The card never shows a number built from partial inputs without saying which are missing.
Honesty rule: no letter grade, ever. Milestones describe how complete the measurement is, not how well the organisation is doing.

## Audit Hub

### FrameworkTabs
Purpose: choose the disclosure regime. The Audit Hub opens on the UK regime, labelled "UK: FCA SDR and TCFD", as the primary and pre-selected view. Beside it sits a CSRD (ESRS) module, shown un-toggled and grayed out, so it is visible without competing for attention.
Props: frameworks (id, label, readiness summary, state of primary, available or dormant), selected (defaults to the UK regime), dormantReason, enableAction.
Behaviour of the dormant CSRD module: it can be focused and read with a keyboard and screen reader (announced as "CSRD, not enabled"). Its tooltip reads: "CSRD may apply if your group has significant revenue in the EU. Check the thresholds with your adviser. Turn this on to see what it would ask for." Activating the toggle enables the module and it then behaves like the UK tab. Gray here means "not enabled", not "broken" or "failed", so it carries no brick red.
Wording rule: the tooltip says "may apply" and points to advice. The product does not tell an organisation that a law applies to it, because it cannot know the group structure.
Scope note: FCA SDR applies to FCA-regulated firms and TCFD-aligned disclosure applies to certain companies. A contractor may be in neither. The tab therefore says "what this regime asks for" and shows readiness against its datapoints, and never states that the organisation is required to report.
Empty state: a tab with no datapoints loaded says "This regime's datapoints are not loaded yet" and names the date they will be, rather than appearing empty.

### ReadinessSummary
Purpose: one sentence and a ring for the chosen regime.
Props: framework, ready, partial, missing, total, lastChecked.
Empty state: "Nothing to assess until a period is calculated."
Wording rule: "ready", "partly ready", "missing". The words "compliant", "assured" and "certified" are not used. Missing items use brick red with an icon and the word.

### DatapointChecklist
Purpose: each required datapoint with its status, the figure or answer behind it, and the link to the page that supplies it.
Props: datapoints (id, label, status, value or narrative, sourceRoute).
Empty state: not applicable; a datapoint is always listed.

### GapList
Purpose: only the missing and partly ready items, ordered by effort, each with the fix link.
Props: gaps (datapoint, reason, fixRoute, estimatedEffort).
Empty state: "No gaps found against this framework's listed datapoints." This states what was checked and does not claim the report would pass review.

### ExportPackDialog
Purpose: choose framework and period, preview what the pack contains and what it lacks, and export. A pack with gaps says so on its cover.
Props: framework, periodId, includes (sections), gaps, format.
Empty state: export is disabled until a published snapshot exists, with the reason beside the button.

### AuditChainStatus
Purpose: shows whether the audit trail checks out, the head hash and when it was last checked. Offers the offline checker.
Props: status (intact, broken, empty), headHash, checkedAt, legacyRows, redactedRows.
Empty state: "No audit entries yet."

## Shared

### EmptyState
Purpose: the one empty state used everywhere. One short sentence of what is missing, one sentence of why it matters or that it is fine, one action. Above it sits an archival sketch, never a generic circle with an icon.
Props: title, body, primaryAction (label, route), secondaryAction optional, sketch (id from the archive: botanical or architectural, with source and licence recorded), tintPair (moss, terracotta), connected (boolean, drives the bloom).
Tone: warm, plain, specific. No exclamation marks, no "Oops".

Artwork rules:
- Subjects are 19th-century botanical plates and architectural elevations or details, chosen for the module: botanical for Carbon and Social (seedling, leaf, root, field grass), architectural for Audit and Imports (arch, doorway, ledger room, drawing of a bridge or lock).
- Every sketch comes from a source that states it is public domain or carries a CC0 or public-domain mark, for example the Biodiversity Heritage Library, the Internet Archive, Wikimedia Commons, or a national library's open collection. The source, the work's creator and date, the exact licence and the retrieval date are recorded in `docs/THIRD_PARTY_SOURCES.md` for each image. A scan from a modern publisher or museum is checked individually, because a scan of a public-domain work is not always free to reuse. Nothing is loaded until its licence has been checked.
- Cleaning: remove paper stain and foxing, flatten the background to transparent, keep the line work. Tinting is done with the tokens, not baked in: line work takes `--color-moss-700`, the fill layer takes `--color-moss-300` and `--color-terra-300` accents. Each sketch is stored as a line layer and a separate fill layer so the bloom can act on the fill only.
- Each sketch has descriptive alternative text, or is marked decorative when the heading already says what is missing.
- Size: at most 240px high inside a tile, 360px on a full page empty state, never behind running text at reduced contrast that harms reading.

The bloom (data source connected):
1. The line layer holds still. The fill layer starts at zero opacity and nearly uncoloured, then fills with colour from the base of the sketch upwards over about 700ms (a vertical reveal of the fill layer, driven by transform and opacity only, with a soft edge).
2. The sketch holds for about 300ms, then the empty state fades and the data widget rises into the same place using the shared layout transition.
3. The bloom plays once per source, the first time it connects, and not on later visits.
4. Under reduced motion there is no bloom. The sketch swaps to its filled state and the widget replaces it at once.
5. The bloom never delays access. A user who acts again, or a widget that has data ready sooner, cuts the animation short and shows the widget immediately.

### Toast
Purpose: confirmation after an action, with Undo where the action can be reversed. Appears bottom left, leaves by itself.
Props: message, undoAction optional, duration.
Empty state: not applicable.

## Motion and interaction notes

Hover on a tile lifts it 2px on a spring of about 200ms and deepens its shadow. The corner radius does not change, since every corner is uniform and soft. The physical feel comes from the lift, the shadow, the film grain and the warm ground. The expand-in-place transition from tile to full view uses a shared layout animation. Counters tween once on first load. The empty state bloom is described under `EmptyState`. All motion collapses to an instant state change under reduced motion, and nothing relies on motion to carry meaning.

## Responsive behaviour

Wide: rail left, bento in a twelve-column grid. Tablet: rail collapses to icons, bento to six columns. Phone: bottom tab bar replaces the rail (Summary, Carbon, Social, Audit), bento becomes a single column of tiles ordered by priority, the ledger stacks into labelled cards, the Sankey turns into its ranked list with a "View as flow" option.

## Open questions for review

The previous six questions are answered by the decisions at the top. What remains, none of which blocks visual review:

1. Phase names for the social baseline. The four proposed are Data integration, First measurement, Baseline set and Tracking. Rename freely.
2. Who counts as "in scope" for the UK regime tab. FCA SDR applies to FCA-authorised firms, so a contractor may see an entire regime that does not apply to them. Should the tab ask one question at first use ("Are you FCA-regulated or in a group that reports under TCFD?") and rank the answer, or always show it?
3. Archive picks. Once the direction is approved, shortlist up to twelve sketches with source and licence for you to choose from, before anything is cleaned or loaded.
