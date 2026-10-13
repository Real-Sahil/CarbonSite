# Defra Digital Waste Tracking: Receipt of Waste API

Source: github.com/DEFRA/waste-tracking-service (Open Government Licence v3.0), read 9 October 2026. The OpenAPI file is `docs/apiSpecifications/ReceiptAPI.yml` in that repository.

## Who it applies to

Permitted or licensed waste **receiving** sites must report each receipt digitally: England and Wales from 1 October 2026, Scotland and Northern Ireland from 1 January 2027. It does not apply to a contractor that only produces or carries waste. The permit holder (the operator) registers and pays on the DWT website; software cannot do that for them. A software provider holds one client ID and secret and sends each customer's data with that customer's `apiCode`.

## Provider steps

1. Register as a software provider (done; test credentials received).
2. Build against the external test environment (`waste-tracking.integration.api.defra.gov.uk`) with a dummy API code.
3. Run the 14 production approval tests (R01 to R05, R07, C01, C02, B01, P01, H01 to H03, X01; R06 was withdrawn) through `POST /production-approval-tests`, which takes the twelve that create a receipt. C01 and H02 are refusals with no ID, so check their error handling separately. Self-certify, then email Defra to confirm and request production credentials, without the client secret.
4. Receive production credentials. Defra then onboards receivers, who give us their own `apiCode`. On hold: Defra's email with the test credentials (13 October 2026) says production is not rolling out yet and Defra is working on it. Nothing has been sent to Defra for production.

## Rules that shape the build

- Submit within two working days beginning the day after receipt. Later corrections go in with `PUT /movements/{wasteTrackingId}/receive`, and every mistake must be corrected.
- A movement between two sites of one company, or between two permits on one site, still needs a receipt.
- Rejections are not in v1. EWC codes are six digits, up to five per item. Only `specialHandlingRequirements` is capped, at 5,000 characters; the waste description has no maximum in the spec.
- OAuth2 client credentials; soft limit of 200 requests a second.
- Email addresses go to Defra, so the customer's record of processing activities needs updating.

## What MetricOra holds and lacks

Held: receipt date, our own reference, EWC code, carrier name and registration, vehicle registration, hazardous flag, weight, destination.

Missing for a receipt: time of receipt, receiver permit number, site address and postcode, physical form, container type and count, whether the weight is an estimate, disposal or recovery codes with weights, hazardous property codes and components, POPs data, consignment note code or the reason for none, broker or dealer, carrier address, email and phone, reason for no carrier registration, means of transport.

## Built so far

`lib/defra-dwt/receipt.ts`: a zod schema of the request body and `submissionDeadline(start, nation)`. The deadline is two working days after the window opens (the UK day of receipt; for piped waste, the last load day, or the earlier of the quarter end and the day piping stops), skipping weekends and that nation's bank holidays, due at 23:59:59 UK time. `bank-holidays.ts` holds England and Wales, Scotland and Northern Ireland for 2026 to 2028 from gov.uk; `working-days.ts` does the calendar arithmetic in Europe/London and throws for a year outside the loaded data rather than guessing. `nation.ts` (`siteNation()`) reads a receiving site's nation from the facility's region, then its postcode area, and returns null rather than guess (TD and DG postcodes straddle the border; Isle of Man and Channel Islands are outside Defra's scheme). `tracker.ts` (`receiptReportState()`) gives a load's status against its window: open, due today, overdue, reported or reported late. It calls nothing; it lets a reviewer see what is missing before anything is sent. Tests in `lib/defra-dwt/__tests__/receipt.test.ts` cover the schema rules, `deadline.test.ts` the holiday data, the clock changes and each nation's deadlines, and `pat-scenarios.test.ts` checks the shape of all 14 PAT scenarios. Shapes only: a `Pass` comes from `POST /production-approval-tests`, never from these tests. PAT runner: `lib/defra-dwt/pat-runner.ts` (injected `send`, no route; R06 skipped, C01 and H02 pass only when refused). Live run on 2026-10-13 against Defra's External Test host: all 12 receipt scenarios `Pass` (submissions `6ace6259aee0bc00cb7ec493` and `6ace65f0aee0bc00cb7ec494`); C01 and H02 were refused with 400 as expected. The live API rejects `concentrationOperator` (NotAllowed), so the schema does not accept it. Self-certification has not been done.

## Not built, waiting for production credentials

1. A "Report to Defra" step on the receiving side of Material movements: a reviewer completes the missing fields, checks them against the reference-data endpoints (EWC, hazardous properties, disposal or recovery codes, container types, POP names), and a person presses submit. No automatic submission.
2. Storage of the returned waste tracking ID and an audit entry for every submission and correction.
3. A two-working-day tracker on each received load. The deadline arithmetic is done (see above), but the status logic is done, the page and the per-load window start are not. The nation comes from `siteNation()`; a site where it returns null must be shown as missing, with a link to the facility's region and postcode, never defaulted to England. Bank holiday data stops at 2028 and must be re-copied each year.
4. OAuth token handling in a server-only module, with the client secret in the environment, never the database. Written in `lib/defra-dwt/client.ts` (test host URLs; no route calls it). It made live token requests to the test host in the 13 October 2026 PAT run; no production token request yet.
5. A route or job that calls `POST /production-approval-tests` again. The one-off run was made from a throwaway preview route that was not merged.
