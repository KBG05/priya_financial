"""
One-off: insert product codes that exist in Ratio Master.xlsx but are missing
from product_specification, so contribution uses the Ratio Master fabrication
rate for every SKU instead of falling back to 0.

Ratio Master supplies Rate/Mt and Wt/Mt only (no width/length). We store
length = 1 and weight = Wt/Mt, which makes every derived value used by
calculate_contribution.py correct:

    fabrication_charge_per_kg = Rate/Mt * (length / weight) = Rate/Mt / (Wt/Mt)
    mts_per_kg                = length / weight            = 1 / (Wt/Mt)
    grm                       = weight * 1000 / length     = grams per metre

gsm is left 0 because width is unknown; it is display-only and unused by the
contribution calculation.
"""
import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).parent))
from sheets.db import get_connection

RATIO_MASTER = Path("/home/kbg/Documents/PriyaFil/Ratio Master.xlsx")


def main():
    ws = openpyxl.load_workbook(RATIO_MASTER, data_only=True)["Sheet2"]
    rm = {}
    for r in ws.iter_rows(min_row=2, values_only=True):
        if r[0] is None or not r[4]:
            continue
        try:
            code = int(r[0])
        except (TypeError, ValueError):
            continue
        rm.setdefault(code, (str(r[1]) if r[1] else f"CODE{code}", float(r[3] or 0), float(r[4])))

    conn = get_connection()
    existing = {
        r[0] for r in conn.execute(
            "SELECT DISTINCT product_code FROM product_specification WHERE product_code IS NOT NULL"
        ).fetchall()
    }

    missing = sorted(set(rm) - existing)
    if not missing:
        print("Nothing to insert — product_specification already covers Ratio Master.")
        conn.close()
        return

    for code in missing:
        name, rate_mt, wt_mt = rm[code]
        conn.execute(
            """INSERT INTO product_specification
                   (product_name, product_code, width, length, weight, mts_per_kg,
                    grm, gsm, fabrication_charge_basic, fabrication_charge_per_kg)
               VALUES (%s, %s, NULL, 1, %s, %s, %s, 0, %s, %s)""",
            (name, code, wt_mt, 1.0 / wt_mt, wt_mt * 1000, rate_mt, rate_mt / wt_mt),
        )
        print(f"  + {code:<5} {name[:28]:<28} Rate/Mt={rate_mt:<6} Wt/Mt={wt_mt:.6f}  fab/kg={rate_mt/wt_mt:.2f}")

    conn.commit()
    print(f"\nInserted {len(missing)} rows into product_specification")
    conn.close()


if __name__ == "__main__":
    main()
