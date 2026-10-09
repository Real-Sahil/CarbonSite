# Defra Digital Waste Tracking: Receipt of Waste API

Source: github.com/DEFRA/waste-tracking-service (Open Government Licence v3.0), read 9 October 2026. The OpenAPI file is `docs/apiSpecifications/ReceiptAPI.yml` in that repository.

## Who it applies to

Permitted or licensed waste **receiving** sites must report each receipt digitally: England and Wales from 1 October 2026, Scotland and Northern Ireland from 1 January 2027. It does not apply to a contractor that only produces or carries waste. The permit holder (the operator) registers and pays on the DWT website; software cannot do that for them. A software provider holds one client ID and secret and sends each customer's data with that customer's `apiCode`.

## Provider steps

1. Register as a software provider (done, awaiting test credentials).
2. Build against the external test environment (`waste-tracking.integration.api.defra.gov.uk`) with a dummy API code.
3. Run the 17 production approval tests (R01 to R07, C01, C02, B01, P01, H01 to H03, X01) through `POST /production-approval-tests`, self-certify, and send Defra the waste tracking ID for each.
4. Receive production credentials. Defra then onboards receivers, who give us their own `apiCode`.

## Rules that shape the build

- Submit within two working days beginning the day after receipt. Later corrections go in with `PUT /movements/{wasteTrackingId}/receive`, and every mistake must be corrected.
- A movement between two sites of one company, or between two permits on one site, still needs a receipt.
- Rejections are not in v1. EWC codes are six digits, up to five per item. Free text is capped at 5,000 characters.
- OAuth2 client credentials; soft limit of 200 requests a second.
- Email addresses go to Defra, so the customer's record of processing activities needs updating.

## What MetricOra holds and lacks

Held: receipt date, our own reference, EWC code, carrier name and registration, vehicle registration, hazardous flag, weight, destination.

Missing for a receipt: time of receipt, receiver permit number, site address and postcode, physical form, container type and count, whether the weight is an estimate, disposal or recovery codes with weights, hazardous property codes and components, POPs data, consignment note code or the reason for none, broker or dealer, carrier address, email and phone, reason for no carrier registration, means of transport.

## Built so far

`lib/defra-dwt/receipt.ts`: a zod schema of the request body and `submissionDeadline()`. It calls nothing; it lets a reviewer see what is missing before anything is sent. Tests in `lib/defra-dwt/__tests__/receipt.test.ts` cover the PAT shapes R01, C01, C02, H02 and H03.

## Not built, waiting for test credentials

1. A "Report to Defra" step on the receiving side of Material movements: a reviewer completes the missing fields, checks them against the reference-data endpoints (EWC, hazardous properties, disposal or recovery codes, container types, POP names), and a person presses submit. No automatic submission.
2. Storage of the returned waste tracking ID and an audit entry for every submission and correction.
3. A two-working-day tracker on each received load; `submissionDeadline()` ignores bank holidays, so it can be a day early, never late.
4. OAuth token handling in a server-only module, with the client secret in the environment, never the database.
5. The remaining PAT scenarios as tests and a runner for the PAT endpoint.
