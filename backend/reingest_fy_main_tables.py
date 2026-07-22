"""
One-off: re-ingest main tables (Purchases, Inventory Sales, Direct/Indirect
Expenses, Stock Valuation) + recalc (PAL I, Consumption Output, Direct
Expenses Output, MTY) for Apr/May/Jun 25_26 from the single, correct
core file — WITHOUT touching item_sales_{fy} / item_purchases_{fy}.

Why: item_sales/item_purchases are populated from a separate source
(priya_textile DB) and pipeline.py always re-pulls them whenever --months
is given. We snapshot + restore those two tables around the pipeline run
so they're guaranteed untouched, then recalculate contribution separately
afterward using the (unchanged) item_sales data.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sheets.db import get_connection
from pipeline import run_pipeline

FY = "25_26"
MONTHS = ["Apr", "May", "Jun"]
CORE_FILE = Path("InputTallyTarka/jun/6e70f818950545f29aa4410cb3562b96_core.xlsx")


def _snapshot(conn, table):
    cols = [
        r[0] for r in conn.execute(
            """SELECT column_name FROM information_schema.columns
               WHERE table_schema='public' AND table_name=%s
               ORDER BY ordinal_position""",
            (table,),
        ).fetchall()
        if r[0] != "id"
    ]
    rows = conn.execute(f"SELECT {', '.join(cols)} FROM {table}").fetchall()
    return cols, rows


def _restore(conn, table, cols, rows):
    conn.execute(f"DELETE FROM {table}")
    if rows:
        placeholders = ", ".join(["%s"] * len(cols))
        conn.executemany(
            f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({placeholders})",
            rows,
        )
    conn.commit()


def main():
    conn = get_connection()

    item_sales_table = f"item_sales_{FY}"
    item_purchases_table = f"item_purchases_{FY}"

    print(f"[SNAPSHOT] {item_sales_table}, {item_purchases_table} (untouched by this run)")
    is_cols, is_rows = _snapshot(conn, item_sales_table)
    ip_cols, ip_rows = _snapshot(conn, item_purchases_table)
    print(f"  {item_sales_table}: {len(is_rows)} rows")
    print(f"  {item_purchases_table}: {len(ip_rows)} rows")
    conn.close()

    print(f"\n[PIPELINE] Re-ingesting main tables for {MONTHS} from {CORE_FILE.name}")
    run_pipeline(
        fy=FY,
        sales_pur_file=CORE_FILE,
        mis_file=None,
        item_sales_file=None,
        selected_months=MONTHS,
        replace_existing=True,
    )

    conn = get_connection()
    print(f"\n[RESTORE] {item_sales_table}, {item_purchases_table} to pre-run snapshot")
    _restore(conn, item_sales_table, is_cols, is_rows)
    _restore(conn, item_purchases_table, ip_cols, ip_rows)
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
