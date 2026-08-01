"""
One-off: refresh product_specification.fabrication_charge_basic / weight from
the user-supplied "Ratio Master.xlsx" (authoritative per user directive — PMC/
Ratio Master values win over whatever is currently in product_specification,
including for duplicate product_code rows).

Ratio Master columns: Item Code, Product, Colour, (Fab Rate/Mtr), Wt/Mt
  - Fab Rate/Mtr  -> fabrication_charge_basic (direct)
  - Wt/Mt         -> weight = Wt/Mt * existing length (length is per-row, not
                     supplied by Ratio Master, so we keep whatever's in the DB)

Downstream columns (fabrication_charge_per_kg, mts_per_kg, grm, gsm) are
recomputed to stay consistent, even though calculate_contribution.py
recomputes its own values at query time and doesn't strictly need these.
"""
import sys
from pathlib import Path
from collections import defaultdict

import openpyxl

sys.path.insert(0, str(Path(__file__).parent))
from sheets.db import get_connection

RATIO_MASTER = Path("/home/kbg/Documents/PriyaFil/Ratio Master.xlsx")


def load_ratio_master():
    wb = openpyxl.load_workbook(RATIO_MASTER, read_only=True, data_only=True)
    ws = wb["Sheet2"]
    agg = defaultdict(lambda: {"fab": [], "wt": []})
    for row in ws.iter_rows(min_row=2, values_only=True):
        code, _name, _colour, fab_rate, wt_mt = row[0], row[1], row[2], row[3], row[4]
        if code is None:
            continue
        try:
            code = int(code)
        except (TypeError, ValueError):
            continue
        if fab_rate is not None:
            agg[code]["fab"].append(float(fab_rate))
        if wt_mt is not None:
            agg[code]["wt"].append(float(wt_mt))
    wb.close()

    result = {}
    for code, d in agg.items():
        fab = sum(d["fab"]) / len(d["fab"]) if d["fab"] else None
        wt = sum(d["wt"]) / len(d["wt"]) if d["wt"] else None
        result[code] = (fab, wt)
    return result


def main():
    ratio = load_ratio_master()
    print(f"Loaded {len(ratio)} product codes from Ratio Master")

    conn = get_connection()
    rows = conn.execute(
        "SELECT id, product_code, length FROM product_specification WHERE product_code IS NOT NULL"
    ).fetchall()

    updated = 0
    skipped_no_ratio = 0
    for pid, code, length in rows:
        if code not in ratio:
            skipped_no_ratio += 1
            continue
        fab_rate, wt_mt = ratio[code]
        length = float(length or 0)

        set_clauses = []
        params = []
        if fab_rate is not None:
            set_clauses.append("fabrication_charge_basic = %s")
            params.append(fab_rate)
        if wt_mt is not None and length:
            new_weight = wt_mt * length
            set_clauses.append("weight = %s")
            params.append(new_weight)

        if not set_clauses:
            continue

        # Recompute derived columns using the (possibly just-updated) basic/weight/length
        eff_fab = fab_rate if fab_rate is not None else None
        eff_weight = (wt_mt * length) if (wt_mt is not None and length) else None

        conn.execute(
            f"UPDATE product_specification SET {', '.join(set_clauses)} WHERE id = %s",
            (*params, pid),
        )
        updated += 1

    conn.commit()
    print(f"Updated {updated} rows ({skipped_no_ratio} product_codes not found in Ratio Master, left untouched)")

    # Recompute derived columns (mts_per_kg, grm, gsm, fabrication_charge_per_kg) for all rows
    conn.execute("""
        UPDATE product_specification
        SET
            mts_per_kg = CASE WHEN weight IS NULL OR weight = 0 OR length IS NULL OR length = 0 THEN 0 ELSE length / weight END,
            grm = CASE WHEN length IS NULL OR length = 0 OR weight IS NULL OR weight = 0 THEN 0 ELSE (weight * 1000) / length END,
            fabrication_charge_per_kg = CASE
                WHEN weight IS NULL OR weight = 0 OR length IS NULL OR length = 0 THEN 0
                ELSE fabrication_charge_basic * (length / weight)
            END
    """)
    conn.execute("""
        UPDATE product_specification
        SET gsm = CASE
            WHEN width IS NULL OR width = 0 OR length IS NULL OR length = 0 OR weight IS NULL OR weight = 0 THEN 0
            ELSE ((weight * 1000) / length) / (width / 39.37)
        END
    """)
    conn.commit()
    print("Recomputed mts_per_kg / grm / gsm / fabrication_charge_per_kg for all rows")
    conn.close()


if __name__ == "__main__":
    main()
