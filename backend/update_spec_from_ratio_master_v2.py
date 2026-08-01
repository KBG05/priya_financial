"""
Update product_specification from "Ratio Masterv2.xlsx" (sheet UPDATED).

v2 is the verified master. Validated before writing:

  * Wt/Mt is IDENTICAL to the previous Ratio Master for all 513 shared codes,
    and matches DB weight/length for all 530 spec rows that carry a weight.
    So this is a FABRICATION-RATE-ONLY update — no geometry is touched.
  * 127 codes have a revised Rate/Mt (small uplifts, e.g. 4.70 -> 4.78).
  * 3 codes are new: 295, 729, 1119.

Duplicate rows per code: v2 repeats a code once per product name. Per Sudhir
sir, duplicates are the same physical product, so cost specs must be identical.
Two codes disagree across their own rows (126: 5.7/0/0, 706: 9.75/9.746) — we
take the MAX rate, treating 0 as "blank" rather than a real zero rate. Codes
where every row is 0 (108 of them, e.g. the AIR54" range) stay at 0.

fabrication_charge_per_kg is recomputed per row from that row's own geometry
(rate * length / weight), so row-level length variation is preserved. Rows with
weight = 0 (codes 402, 416, 509, 511, 522, 534 — blank Wt/Mt in the master too)
keep per_kg = 0; none of them have sales.

Run:  uv run python update_spec_from_ratio_master_v2.py [PATH_TO_XLSX] [--commit]
Without --commit it prints the diff and rolls back. PATH_TO_XLSX defaults to the
local checkout location; pass it explicitly on other machines.
"""
import sys
from collections import defaultdict
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).parent))
from sheets.db import get_connection

RATIO_MASTER_V2 = Path("/home/kbg/Documents/PriyaFil/Ratio Masterv2.xlsx")
SHEET = "UPDATED"


def load_master(path: Path = RATIO_MASTER_V2):
    """code -> (name, rate_per_mt, wt_per_mt), collapsing duplicate rows."""
    ws = openpyxl.load_workbook(path, data_only=True)[SHEET]
    grouped = defaultdict(list)
    for r in ws.iter_rows(min_row=2, values_only=True):
        if r[0] is None:
            continue
        try:
            code = int(r[0])
        except (TypeError, ValueError):
            continue
        grouped[code].append((str(r[1] or f"CODE{code}"), float(r[3] or 0), float(r[4] or 0)))

    master = {}
    for code, rows in grouped.items():
        # max treats a blank/0 rate on one duplicate row as missing, not as a
        # real zero — see module docstring.
        master[code] = (rows[0][0], max(r for _, r, _ in rows), max(w for _, _, w in rows))
    return master


def main(commit: bool, path: Path = RATIO_MASTER_V2):
    print(f"Master: {path}")
    master = load_master(path)
    conn = get_connection()

    specs = conn.execute(
        """SELECT id, product_code, product_name, length, weight,
                  fabrication_charge_basic, fabrication_charge_per_kg
           FROM product_specification WHERE product_code IS NOT NULL"""
    ).fetchall()

    updated, unchanged = [], 0
    for sid, code, name, length, weight, old_basic, old_per_kg in specs:
        code = int(code)
        if code not in master:
            continue  # in DB but not in v2 (codes 474, 1421) — leave alone
        _, rate, _ = master[code]
        length = float(length or 0)
        weight = float(weight or 0)
        old_basic = float(old_basic or 0)
        old_per_kg = float(old_per_kg or 0)

        per_kg = rate * length / weight if weight else 0.0
        if abs(rate - old_basic) < 1e-9 and abs(per_kg - old_per_kg) < 1e-6:
            unchanged += 1
            continue

        conn.execute(
            """UPDATE product_specification
               SET fabrication_charge_basic = %s, fabrication_charge_per_kg = %s
               WHERE id = %s""",
            (rate, per_kg, sid),
        )
        updated.append((code, name, old_basic, rate, old_per_kg, per_kg))

    existing = {int(r[1]) for r in specs}
    inserted = []
    for code in sorted(set(master) - existing):
        name, rate, wt_mt = master[code]
        if not wt_mt:
            print(f"  ! skipping new code {code} ({name}) — Wt/Mt is blank in the master")
            continue
        # Master gives Rate/Mt and Wt/Mt only, so store length = 1 and
        # weight = Wt/Mt; every derived value stays correct.
        conn.execute(
            """INSERT INTO product_specification
                   (product_name, product_code, width, length, weight, mts_per_kg,
                    grm, gsm, fabrication_charge_basic, fabrication_charge_per_kg)
               VALUES (%s, %s, NULL, 1, %s, %s, %s, 0, %s, %s)""",
            (name, code, wt_mt, 1.0 / wt_mt, wt_mt * 1000, rate, rate / wt_mt),
        )
        inserted.append((code, name, rate, wt_mt, rate / wt_mt))

    updated.sort(key=lambda x: -abs(x[5] - x[4]))
    print(f"\n{len(updated)} spec rows change, {unchanged} unchanged, {len(inserted)} inserted\n")
    print(f"{'code':>5} {'product':<26}{'oldRate':>9}{'newRate':>9}{'old/kg':>10}{'new/kg':>10}{'delta':>9}")
    for code, name, ob, nb, op, np_ in updated[:30]:
        print(f"{code:>5} {name[:26]:<26}{ob:>9.3f}{nb:>9.3f}{op:>10.2f}{np_:>10.2f}{np_-op:>+9.2f}")
    if len(updated) > 30:
        print(f"  ... and {len(updated)-30} more")

    if inserted:
        print("\ninserted:")
        for code, name, rate, wt, per_kg in inserted:
            print(f"  + {code:<5} {name[:26]:<26} Rate/Mt={rate:<7.3f} Wt/Mt={wt:.6f}  fab/kg={per_kg:.2f}")

    if commit:
        conn.commit()
        print("\nCOMMITTED")
    else:
        conn.rollback()
        print("\ndry run — rolled back (pass --commit to apply)")
    conn.close()


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    main("--commit" in sys.argv, Path(args[0]) if args else RATIO_MASTER_V2)
