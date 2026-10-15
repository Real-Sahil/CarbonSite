#!/usr/bin/env python3
"""Writes the Demo Construction Ltd activity CSVs used to demo the portal.

Demo data only: the company, sites, business units and suppliers are invented.
One CSV per reporting period (FY2024, FY2025, 2026 year to date), monthly rows,
import template ghg_protocol_v1. Seeds are fixed, so a rerun writes the same files.

    python3 scripts/demo/generate-demo-construction.py [output-dir]
"""

import calendar
import csv
import pathlib
import random
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT_DIR = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "demo-data" / "demo-construction"
NAICS_FILE = ROOT / "data" / "sources" / "SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv"

HEADER = [
    "Amount", "Unit", "Category Code", "Activity Date", "Start Date", "End Date",
    "Source Description", "Facility", "Business Unit", "Supplier", "Country", "Region",
    "Fuel Type", "Transport Mode", "Refrigerant Type", "Distance", "Distance Unit",
    "Spend Amount", "Spend Currency", "Scope 2 Method", "Assumption Notes", "Industry Code",
    "Data Origin",
]
# CLAUDE.md "Emissions Categories": the only codes that exist in the database.
SEEDED_CATEGORIES = {
    "s1-stationary", "s1-mobile", "s1-fugitive",
    "s2-electricity-lb", "s2-electricity-mb", "s2-heat",
    "s3-purchased-goods", "s3-capital-goods", "s3-fuel-energy", "s3-upstream-transport",
    "s3-waste", "s3-business-travel", "s3-commuting", "s3-upstream-leased",
    "s3-downstream-transport", "s3-processing-sold", "s3-use-sold", "s3-end-of-life",
    "s3-downstream-leased", "s3-franchises", "s3-investments",
}
UNITS = {"litres", "kWh", "tonnes", "km", "GBP", "kg"}
ORIGINS = {"metered", "invoiced", "supplier_specific", "calculated", "estimated", "proxy", "extrapolated"}

HEAD, DEPOT, BATCH, A61, YORK = (
    "Head office, Wakefield", "Leeds depot", "Sheffield batching plant",
    "A61 corridor works", "York Road bridge",
)
FACILITIES = {HEAD, DEPOT, BATCH, A61, YORK}
CIVILS, PLANT, SUPPORT = "Civils", "Plant hire", "Support services"
BUSINESS_UNITS = {CIVILS, PLANT, SUPPORT}

FUEL = "Ashcombe Fuels Ltd"
ENERGY = "Brindle Energy Supply Ltd"
GAS = "Calder Gas Supply Ltd"
WASTE = "Morvale Waste Carriers Ltd"
RAIL = "Stanmere Rail Travel Ltd"
CONCRETE = "Tarnside Ready-Mix Ltd"
STEEL = "Keldholme Steel Supplies Ltd"
AGGREGATE = "Farnley Aggregates Ltd"
ASPHALT = "Hollin Asphalt Ltd"
FGAS = "Coldharbour Refrigeration Ltd"

# Seasonal shapes by calendar month: winter dip on site work, heating peaks in winter.
ACTIVITY_SHAPE = [0.82, 0.86, 0.96, 1.02, 1.06, 1.10, 1.12, 1.10, 1.06, 1.00, 0.92, 0.84]
HEATING_SHAPE = [1.55, 1.40, 1.15, 0.80, 0.45, 0.25, 0.20, 0.22, 0.42, 0.85, 1.20, 1.50]
ELEC_SHAPE = [1.08, 1.06, 1.02, 0.99, 0.96, 0.95, 0.95, 0.96, 0.99, 1.02, 1.05, 1.09]

# (file, year, months covered, scale on base volumes, first month of HVO on A61 or None)
PERIODS = [
    ("activity-2024.csv", 2024, 12, 1.00, None),
    ("activity-2025.csv", 2025, 12, 0.93, 4),
    ("activity-2026-jan-sep.csv", 2026, 9, 0.96, 1),
]


def origin_of(desc):
    # Mirrors how a contractor holds each figure: meter reads, invoices, mileage claims, survey.
    if "meter" in desc:
        return "metered"
    if "survey" in desc:
        return "estimated"
    if "mileage claims" in desc:
        return "calculated"
    return "invoiced"


def row(year, month, *, amount, unit, category, desc, facility, bu, supplier="",
        fuel="", mode="", refrigerant="", scope2="", note="", naics=""):
    last = calendar.monthrange(year, month)[1]
    is_spend = unit == "GBP"
    return [
        amount, unit, category,
        f"{year}-{month:02d}-{last:02d}", f"{year}-{month:02d}-01", f"{year}-{month:02d}-{last:02d}",
        desc, facility, bu, supplier, "GB", "",
        fuel, mode, refrigerant, "", "",
        amount if is_spend else "", "GBP" if is_spend else "",
        scope2, note, naics, origin_of(desc),
    ]


def month_rows(year, month, scale, hvo_from, rng):
    def j(base, shape=1.0):
        return base * shape * scale * rng.uniform(0.97, 1.03)

    act = ACTIVITY_SHAPE[month - 1]
    heat = HEATING_SHAPE[month - 1]
    elec = ELEC_SHAPE[month - 1]
    rows = [
        row(year, month, amount=round(j(3600)), unit="litres", category="s1-mobile",
            desc="Fleet diesel, fuel card statement", facility=DEPOT, bu=PLANT, supplier=FUEL, fuel="diesel"),
        row(year, month, amount=round(j(6000, act)), unit="litres", category="s1-mobile",
            desc="Plant diesel, bowser meter reads", facility=A61, bu=CIVILS, supplier=FUEL, fuel="diesel"),
        row(year, month, amount=round(j(4200, act)), unit="litres", category="s1-mobile",
            desc="Plant diesel, bowser meter reads", facility=YORK, bu=CIVILS, supplier=FUEL, fuel="diesel"),
        row(year, month, amount=round(j(900)), unit="litres", category="s1-stationary",
            desc="Site generators, fuel delivery notes", facility=A61, bu=CIVILS, supplier=FUEL, fuel="diesel"),
        row(year, month, amount=round(j(650)), unit="litres", category="s1-stationary",
            desc="Site generators, fuel delivery notes", facility=YORK, bu=CIVILS, supplier=FUEL, fuel="diesel"),
        row(year, month, amount=round(j(42000, heat)), unit="kWh", category="s1-stationary",
            desc="Office heating, gas meter", facility=HEAD, bu=SUPPORT, supplier=GAS, fuel="natural gas"),
        row(year, month, amount=round(j(50000, act) + j(20000, heat)), unit="kWh", category="s1-stationary",
            desc="Aggregate drying, gas meter", facility=BATCH, bu=CIVILS, supplier=GAS, fuel="natural gas"),
        row(year, month, amount=round(j(6000, elec)), unit="kWh", category="s2-electricity-lb",
            desc="Half-hourly meter", facility=DEPOT, bu=PLANT, supplier=ENERGY, scope2="location_based"),
        row(year, month, amount=round(j(38000, act)), unit="kWh", category="s2-electricity-lb",
            desc="Half-hourly meter", facility=BATCH, bu=CIVILS, supplier=ENERGY, scope2="location_based"),
        row(year, month, amount=round(j(4500, elec)), unit="kWh", category="s2-electricity-lb",
            desc="Half-hourly meter", facility=HEAD, bu=SUPPORT, supplier=ENERGY, scope2="location_based"),
        row(year, month, amount=round(j(2500, act)), unit="kWh", category="s2-electricity-lb",
            desc="Half-hourly meter, site cabins", facility=A61, bu=CIVILS, supplier=ENERGY, scope2="location_based"),
        row(year, month, amount=round(j(2000, act)), unit="kWh", category="s2-electricity-lb",
            desc="Half-hourly meter, site cabins", facility=YORK, bu=CIVILS, supplier=ENERGY, scope2="location_based"),
        row(year, month, amount=round(j(60, act), 1), unit="tonnes", category="s3-waste",
            desc="Mixed C&D waste, EWC 17 09 04, weighbridge tickets", facility=A61, bu=CIVILS, supplier=WASTE),
        row(year, month, amount=round(j(25, act), 1), unit="tonnes", category="s3-waste",
            desc="Mixed C&D waste, EWC 17 09 04, weighbridge tickets", facility=YORK, bu=CIVILS, supplier=WASTE),
        row(year, month, amount=round(j(700)), unit="km", category="s3-business-travel",
            desc="Rail travel, travel desk invoices", facility=HEAD, bu=SUPPORT, supplier=RAIL, mode="rail"),
        row(year, month, amount=round(j(1200)), unit="km", category="s3-business-travel",
            desc="Grey fleet mileage claims", facility=HEAD, bu=SUPPORT, mode="car"),
        row(year, month, amount=round(j(5000)), unit="km", category="s3-commuting",
            desc="Staff commuting survey, scaled to headcount", facility=HEAD, bu=SUPPORT, mode="car",
            note="Home-to-work distances from the staff survey, scaled up to headcount"),
        row(year, month, amount=round(j(150000, act)), unit="GBP", category="s3-purchased-goods",
            desc="Ready-mix concrete, supplier invoices", facility=A61, bu=CIVILS, supplier=CONCRETE, naics="327320"),
        row(year, month, amount=round(j(60000, act)), unit="GBP", category="s3-purchased-goods",
            desc="Ready-mix concrete, supplier invoices", facility=YORK, bu=CIVILS, supplier=CONCRETE, naics="327320"),
        row(year, month, amount=round(j(45000, act)), unit="GBP", category="s3-purchased-goods",
            desc="Reinforcing steel, supplier invoices", facility=YORK, bu=CIVILS, supplier=STEEL, naics="331110"),
        row(year, month, amount=round(j(70000, act)), unit="GBP", category="s3-purchased-goods",
            desc="Aggregates, supplier invoices", facility=A61, bu=CIVILS, supplier=AGGREGATE, naics="212321"),
    ]
    if hvo_from and month >= hvo_from:
        rows.append(row(year, month, amount=round(j(1500, act)), unit="litres", category="s1-mobile",
                        desc="Plant HVO, delivery notes", facility=A61, bu=CIVILS, supplier=FUEL, fuel="HVO"))
    if 4 <= month <= 10:
        rows.append(row(year, month, amount=round(j(60000, act)), unit="GBP", category="s3-purchased-goods",
                        desc="Asphalt surfacing, supplier invoices", facility=A61, bu=CIVILS, supplier=ASPHALT,
                        naics="324121"))
    if month % 3 == 0:
        rows.append(row(year, month, amount=round(j(1.2), 1), unit="kg", category="s1-fugitive",
                        desc="Air conditioning top-up, F-gas service log", facility=HEAD, bu=SUPPORT,
                        supplier=FGAS, refrigerant="R410A"))
    return rows


def build(year, months, scale, hvo_from):
    rng = random.Random(f"demo-construction-{year}")
    rows = []
    for month in range(1, months + 1):
        rows.extend(month_rows(year, month, scale, hvo_from, rng))
    return rows


def check(name, rows, year, months):
    naics_text = NAICS_FILE.read_text(encoding="utf-8")
    seen, months_seen = set(), set()
    for r in rows:
        assert len(r) == len(HEADER), (name, r)
        d = dict(zip(HEADER, r))
        assert float(d["Amount"]) > 0, d
        assert d["Category Code"] in SEEDED_CATEGORIES, d["Category Code"]
        assert d["Unit"] in UNITS, d["Unit"]
        assert d["Facility"] in FACILITIES, d["Facility"]
        assert d["Business Unit"] in BUSINESS_UNITS, d["Business Unit"]
        assert d["Data Origin"] in ORIGINS, d["Data Origin"]
        y, m, _ = d["Activity Date"].split("-")
        assert int(y) == year and 1 <= int(m) <= months, d["Activity Date"]
        if d["Industry Code"]:
            assert len(d["Industry Code"]) == 6 and d["Industry Code"] in naics_text, d["Industry Code"]
            assert d["Unit"] == "GBP" and d["Spend Amount"] == d["Amount"], d
        key = (d["Category Code"], d["Amount"], d["Unit"], d["Activity Date"], d["Facility"], d["Supplier"])
        assert key not in seen, key
        seen.add(key)
        months_seen.add(m)
    assert months_seen == {f"{i:02d}" for i in range(1, months + 1)}, sorted(months_seen)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, year, months, scale, hvo_from in PERIODS:
        rows = build(year, months, scale, hvo_from)
        check(name, rows, year, months)
        with (OUT_DIR / name).open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(HEADER)
            w.writerows(rows)
        print(f"{OUT_DIR / name}: {len(rows)} rows")


if __name__ == "__main__":
    main()
