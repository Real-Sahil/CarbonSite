# Demo data: Demo Construction Ltd

Three activity files for a demo organisation. The company, its five sites, its three business units, its ten suppliers and every person named are fictional. Any resemblance to a real business is accidental. The figures are invented to read like a mid-sized civils contractor and are not taken from any real organisation.

This is a separate tenant from the Northgate Civils Ltd demo that feeds the marketing captures (`scripts/marketing/demo-activity-csv.py`). Nothing here changes the Northgate figures on the marketing site.

## The files

| File | Rows | Activity dates | Reporting period to create |
|---|---|---|---|
| `activity-2024.csv` | 263 | 1 Jan to 31 Dec 2024 | 2024 (full year) |
| `activity-2025.csv` | 272 | 1 Jan to 31 Dec 2025 | 2025 (full year) |
| `activity-2026-jan-sep.csv` | 207 | 1 Jan to 30 Sep 2026 | 2026 (1 Jan to 30 Sep) |

Each file has the 23 columns of the `ghg_protocol_v1` import template. Rows are monthly per source, so a fleet, a site or a supplier account appears once a month. The files cover:

- Scope 1: fleet and plant diesel, site generators on diesel, HVO in the plant fleet at the A61 corridor works from April 2025, gas for the head office and the batching plant, and an F-gas top-up every third month.
- Scope 2: location-based electricity for every site.
- Scope 3: construction and demolition waste (EWC 17 09 04) by tonnes, rail travel, grey fleet mileage, staff commuting, and spend in GBP on ready-mix concrete, reinforcing steel, aggregates and asphalt. The spend rows carry real NAICS codes (327320, 331110, 212321, 324121) so the supply-chain factors match.

The Data Origin column is filled in from how each figure was obtained: metered (meter reads), invoiced (supplier invoices and statements), calculated (mileage claims worked out from distance) or estimated (a commuting survey, scaled up).

## Set up the demo

1. Load the categories and factor libraries into the database, if you have not already: `pnpm prisma db seed`.
2. Create the demo account and organisation `demo-org` ("Demo Construction Ltd"). Use a local or throwaway database only:

   ```bash
   ALLOW_DEMO_SEED=1 DEMO_PASSWORD='<at least 12 characters>' pnpm seed:demo
   ```

   Set `DEMO_EMAIL` to use a different sign-in address. The default is `demo@example.test`.
3. Sign in and open **Settings → Operations**.
4. Add these business units: **Civils**, **Plant hire** and **Support services**.
5. Add these facilities, using the names exactly as written. The commit matches names case-insensitively but does not create missing facilities:
   - A61 corridor works
   - Sheffield batching plant
   - York Road bridge
   - Leeds depot
   - Head office, Wakefield
6. Add three reporting periods with the dates shown in the table above: 2024, 2025 and 2026 (1 January to 30 September).

## Import the files

For each file, open **Imports**, choose the template **GHG Protocol v1 (default)**, pick the reporting period that matches the file, and upload it. Wait for the batch to reach ready to commit, then commit it.

A batch stops at needs attention if a facility or business unit name does not match Settings, or if the period is locked. Fix the setup and import again rather than editing the file in the batch. The generator checks that there are no duplicate rows, so the duplicate warning should not appear.

## Calculate and look at the results

Start a calculation run for each period from **Calculations**. When the runs finish, open the dashboard at `/orgs/demo-org/dashboard`. To produce reports, publish a snapshot of each period first, since reports read from published snapshots.

## Regenerate the files

The files come from `scripts/demo/generate-demo-construction.py`:

```bash
python3 scripts/demo/generate-demo-construction.py            # writes into this folder
python3 scripts/demo/generate-demo-construction.py /some/dir  # or into another folder
```

The generator uses fixed seeds, so running it again gives the same files. It also checks every row before writing: the column count, the seeded category codes, the units, the facility and business unit names, the data origins, the activity dates, the NAICS codes against the supply-chain factor file, the absence of duplicate keys, and that every month of each period has rows. A failed check stops the script with an assertion message and writes nothing.
