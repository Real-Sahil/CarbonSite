<context>
MetricOra turns site paperwork (tickets, receipts, bills, sign-in exports) into carbon figures a checker can trace, for UK contractors: Scope 1 to 3, Carbon Reduction Plans, SECR and assurance packs.
This film is the launch video, played with sound on the site, YouTube and LinkedIn.
Read `videos/BRAND.md` first. It holds the brief, the look, the brand element, the components, the product owner's rulings and what we may claim. This prompt only adds the story.
</context>

<inputs>
Decided: 1920x1080, 60 fps, dark stage with light product UI, 28 bars at 120 BPM, 56 s. Music: original score from `scripts/compose.py` (ours, no licence), regenerated into `public/audio/launch/` (gitignored). No edit: the score is written to the film's length.
</inputs>

<direction>
Calm, exact, confident. Paper becomes a figure you can open.
Ingredients (from the interview): logo reveal open and close · big punchlines word by word · magic moves · cursor, phone frame, demo-data proof.
Only the product's own surfaces, colors, borders and effects.
Banned: dashes in copy, App Store or Apple devices, customer names or results, any figure not from the demo tenant, "guaranteed" or "certified".
</direction>

<cast>
- The brand element: the MetricOra mark (orange to amber square, white M) drawing itself at the open and the close.
- Cursors: the user's OS arrow on the web app; taps on the phone.
- Demo world: Northgate Civils Ltd (fictional), A61 corridor works, Dan Mitchell (field worker), Sam Hartley (reviewer), Certas Energy fuel receipt of 520 litres HVO, FY2025 total 4,710.05 tCO2e.
</cast>

<structure>
120 BPM, 4/4, 28 bars. One beat is 0.5 s. The beat sheet with every cue is `src/videos/launch/BEAT-SHEET.md`.

Bars 1-2, opening. The mark scales in on the downbeat bell, the M draws, "MetricOra" lands.
Bars 3-4: "Carbon figures that hold up / when someone checks them."
Bars 5-8, field app. Fuel Receipt tile, camera, on-device reading of four fields, pre-filled form, submit, pending, syncing, submitted.
Bars 9-10, review. The receipt photo flies from the phone into the review page; the reviewer approves.
Bar 11: "Open any figure."
Bars 12-15, trace. The FY2025 headline counts up; Scope 1 opens into its records; the fuel receipt opens into 520 litre x 0.03558 kg CO2e/litre = 18.50 kg CO2e, DEFRA 2025.2, Verified, the photo as evidence.
Bar 16, the build: "The three documents most contractors need." The last beat is silent.
Bars 17-20, the drop. Carbon Reduction Plan, SECR and GHG Protocol report land on the downbeats; the plan comes forward with the published figures and is generated.
Bars 21-22, proof. The assurance pack lists its files; download.
Bars 23-24: "From site paperwork / to a published figure."
Bars 25-28, ending. The lockup, "Start your Carbon Reduction Plan", metricora.co.uk, the three documents and the field app on Google Play; fade on the ring-out.
</structure>

<build>
1. Remotion in `videos/` (BRAND.md, Workspace). Kit in `src/kit/`, film in `src/videos/launch/`. fps from props: 60 for stills and drafts, 240 for the final render.
2. Every style is a pure function of time; the phone spinner is a frame-driven twin.
3. `cues.ts` is the beat sheet as data; `scripts/beat-sheet.ts` writes BEAT-SHEET.md from it.
4. Magic moves with `kit/move.ts`: phone photo to review photo, Scope 1 tile to records panel, record row to calculation, document stack to pack.
5. `scripts/compose.py` writes the score and SFX on the same grid; `scripts/beats.py` measured it at 119.985 BPM, 2 ms spread.
6. Final: `bun scripts/render.ts Launch metricora-launch --duration 56 --poster 52.5`, then `scripts/verify.py`.
</build>

<start>
Regenerate the audio (`npm run setup`), then `npm run studio` to preview.
</start>
