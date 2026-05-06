"""
Ingest item-level monthly sales data from an Excel file.

Source file format (any month):
    Column 0: ProductID  (integer)
    Column 1: Quantity   (kg, float)
    Column 2: Revenue    (Rs, float)

Multiple rows per ProductID are aggregated (SUM qty, SUM revenue).
Selling price per kg is derived as revenue / qty.

Target table: item_sales_{fy}
    product_id          INT
    month               TEXT
    qty                 REAL
    revenue             REAL
    selling_price_per_kg REAL

Existing rows for the given month are deleted before re-inserting,
so re-running for the same month is safe.
"""

from pathlib import Path
from collections import defaultdict

import openpyxl

from .db import get_connection


def _create_table(conn, fy: str) -> None:
    conn.execute(f"""
        CREATE TABLE IF NOT EXISTS item_sales_{fy} (
            id                   SERIAL PRIMARY KEY,
            product_id           INTEGER NOT NULL,
            month                TEXT    NOT NULL,
            qty                  REAL,
            revenue              REAL,
            selling_price_per_kg REAL
        )
    """)
    conn.execute(f"""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_item_sales_{fy}_pid_month
        ON item_sales_{fy} (product_id, month)
    """)


def ingest_item_sales(conn, filepath: Path, fy: str, month: str) -> None:
    """
    Read *filepath*, aggregate by ProductID, and upsert into item_sales_{fy}
    for the given *month*.

    Parameters
    ----------
    conn      : DB connection returned by get_connection()
    filepath  : Path to the item-sales Excel file
    fy        : FY suffix, e.g. '25_26'
    month     : Three-letter month abbreviation, e.g. 'Mar'
    """
    wb = openpyxl.load_workbook(filepath, data_only=True, read_only=True)
    ws = wb.active

    # Aggregate rows by ProductID
    totals: dict[int, dict] = defaultdict(lambda: {"qty": 0.0, "rev": 0.0})
    skipped = 0
    for row in ws.iter_rows(min_row=2, values_only=True):
        pid = row[0]
        qty = row[1]
        rev = row[2]
        if pid is None:
            continue
        try:
            pid = int(pid)
        except (ValueError, TypeError):
            skipped += 1
            continue
        totals[pid]["qty"] += float(qty or 0)
        totals[pid]["rev"] += float(rev or 0)

    wb.close()

    if skipped:
        print(f"  ⚠  Skipped {skipped} rows with non-integer ProductID")

    print(f"  Aggregated {len(totals)} unique products from {filepath.name}")

    _create_table(conn, fy)

    # Delete existing rows for this month
    conn.execute(f"DELETE FROM item_sales_{fy} WHERE month = %s", (month,))

    rows_inserted = 0
    for pid, d in totals.items():
        qty = d["qty"]
        rev = d["rev"]
        rate = rev / qty if qty else 0.0
        conn.execute(
            f"""
            INSERT INTO item_sales_{fy} (product_id, month, qty, revenue, selling_price_per_kg)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (pid, month, qty, rev, rate),
        )
        rows_inserted += 1

    print(f"  Inserted {rows_inserted} rows into item_sales_{fy} for month={month}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 4:
        print("Usage: python -m sheets.ingest_item_sales <filepath> <fy> <month>")
        print("  e.g. python -m sheets.ingest_item_sales 'march sales.xlsx' 25_26 Mar")
        sys.exit(1)

    fp = Path(sys.argv[1])
    fy = sys.argv[2]
    month = sys.argv[3]

    conn = get_connection()
    try:
        ingest_item_sales(conn, fp, fy, month)
        conn.commit()
        print("Done.")
    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()
