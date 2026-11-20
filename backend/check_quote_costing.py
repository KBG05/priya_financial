"""
Read-only check of the Quote Builder's live rate card (quote_costing.py).

Run from backend/:  python check_quote_costing.py
Only SELECT queries are issued. Exit code 1 if any check fails.

Checks
  1. For every FY/month with costing inputs, Yarn + Fabric Overheads equals all
     'Variable & Direct Expense' except 'Fabrication charges' (no particular is
     lost or double counted), and RM = base x yield x (1 + wastage).
  2. Wherever contribution_{fy} holds a split rate card, report whether the live
     card matches it (a mismatch means the stored copy is stale).
  3. Known FY26-27 values (only when that FY is present).
"""

import sys

from db import query
from quote_costing import (
    FABRIC_OH_PARTICULARS,
    VARIABLE_CATEGORY,
    YARN_PARTICULARS,
    _months_with_consumption,
    _tables,
    available_fys,
    rate_card,
)
from sheets.calculate_contribution import WASTAGE_ALLOWANCE, YIELD_KG_RM_PER_KG_FABRIC

TOL = 0.0001
failures: list[str] = []


def check(ok: bool, label: str) -> None:
    print(f"  {'OK  ' if ok else 'FAIL'} {label}")
    if not ok:
        failures.append(label)


def stored_card(fy: str, month: str):
    table = f"contribution_{fy}"
    if fy not in _tables("contribution_"):
        return None
    cols = {r["column_name"] for r in query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=:t",
        {"t": table})}
    if not {"yarn_conversion", "fabric_addon"} <= cols:
        return None  # legacy table without the split
    rows = query(
        f"""SELECT MAX(rm_price) AS rm, MAX(yarn_conversion) AS yarn, MAX(fabric_addon) AS fab
            FROM {table} WHERE month = :m AND COALESCE(rm_price, 0) > 0""",
        {"m": month},
    )
    return rows[0] if rows and rows[0]["rm"] is not None else None


def main() -> int:
    fys = available_fys("99_99")
    print(f"FYs with costing inputs: {fys}\n")
    cards: dict[tuple[str, str], dict] = {}

    for fy in fys:
        for month in _months_with_consumption(fy):
            card = rate_card(fy, month)
            cards[(fy, month)] = card
            rm, yarn, fab = card["rm"]["price"], card["yarn"]["per_kg"], card["fabric_overheads"]["per_kg"]
            print(f"[{fy} {month}] status={card['status']}  RM={rm:.2f}  Yarn={yarn:.2f}  "
                  f"FabOH={fab:.2f} (finance {card['fabric_overheads']['finance_per_kg']:.2f})"
                  + (f"  missing={card['missing_particulars']}" if card["missing_particulars"] else ""))
            if card["status"] != "complete":
                continue

            # 1. Internal consistency
            expected_rm = card["rm"]["rate_base"] * YIELD_KG_RM_PER_KG_FABRIC * (1 + WASTAGE_ALLOWANCE)
            check(abs(rm - expected_rm) < TOL, f"{fy} {month}: RM = base x yield x (1+wastage)")
            lump = query(
                f"""SELECT SUM(value) AS v FROM direct_expenses_output_{fy}
                    WHERE month = :m AND category = :cat AND particulars <> 'Fabrication charges'""",
                {"m": month, "cat": VARIABLE_CATEGORY},
            )[0]["v"] or 0
            split = card["yarn"]["total"] + card["fabric_overheads"]["total"]
            check(abs(split - float(lump)) < 0.01,
                  f"{fy} {month}: Yarn + Fabric OH totals ({split:,.2f}) = variable expenses ex fabrication ({float(lump):,.2f})")

            print(f"    RM base {card['rm']['rate_base']:.2f} + uplift {card['rm']['uplift_per_kg']:.2f}  "
                  f"(Consumption page rate {card['rm']['consumption_page_rate']:.2f}; resold: "
                  + ", ".join(f"{r['material']} {r['qty']:,.0f} kg @ {r['avg_cost_per_kg']:.2f} avg cost "
                              f"vs {r['value_in_file'] / r['qty']:.2f} in file" for r in card["rm"]["resold"])
                  + ")")
            check(abs(card["rm"]["rate_base"] + card["rm"]["uplift_per_kg"] - rm) < TOL,
                  f"{fy} {month}: RM base + uplift = RM")

            # 2. Stored Contribution copy, informational. RM differs by design (the
            #    Quote Builder values resold RM at average cost), so compare Yarn / Fabric OH.
            stored = stored_card(fy, month)
            if stored:
                # Half a paisa: stored columns are REAL, and sub-paisa drift is noise.
                same = abs(stored["yarn"] - yarn) < 0.005 and abs(stored["fab"] - fab) < 0.005
                print(f"    contribution_{fy}: Yarn={stored['yarn']:.2f} FabOH={stored['fab']:.2f} "
                      f"-> {'matches' if same else 'STALE (live card differs)'}")

    # 3. Known FY26-27 values from the audit
    if "26_27" in fys:
        print("\nKnown FY26-27 values:")
        # (RM incl. yield + wastage, Yarn, Fabric OH), from independent SQL. RM values
        # resold RM at average cost (base: Sep 139.95, Oct 143.10).
        expected = {
            "Apr": (109.92, 35.01, 19.27),
            "May": (130.67, 37.70, 18.59),
            "Jun": (154.81, 31.62, 12.29),
            "Jul": (146.36, 32.56, 11.44),
            "Aug": (133.94, 36.44, 12.16),
            "Sep": (143.28, 31.29, 12.46),
            "Oct": (146.51, 38.55, 16.31),
        }
        for month, (e_rm, e_yarn, e_fab) in expected.items():
            card = cards.get(("26_27", month))
            if not card:
                check(False, f"26_27 {month}: rate card present")
                continue
            got = (round(card["rm"]["price"], 2), round(card["yarn"]["per_kg"], 2),
                   round(card["fabric_overheads"]["per_kg"], 2))
            check(got == (e_rm, e_yarn, e_fab), f"26_27 {month}: {got} == {(e_rm, e_yarn, e_fab)}")

    print(f"\nYarn particulars:   {', '.join(YARN_PARTICULARS)}")
    print(f"Fabric OH particulars: {', '.join(FABRIC_OH_PARTICULARS)}")
    print(f"\n{'All checks passed.' if not failures else f'{len(failures)} check(s) failed.'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
