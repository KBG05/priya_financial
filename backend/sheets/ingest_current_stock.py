"""
ingest_current_stock.py
========================
One-off ingestion of the 'Clean Stock' sheet from Current_Stock_Report.xlsm —
a point-in-time bale/kg stock snapshot by SKU code + location, used by the
Quote Builder to show stock-on-hand when pricing a deal.

Not FY-suffixed and not part of the monthly upload pipeline: this is a
snapshot table, re-run manually against a fresh Current_Stock_Report.xlsm
whenever an up-to-date stock position is needed.

Source: <workspace root>/Current_Stock_Report.xlsm → sheet 'Clean Stock'
Columns: Code, Location, Category, Product, Colour, Qty Mtrs, Qty Kgs, Bales
"""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path
from typing import Optional

import openpyxl

from .db import get_connection

SHEET_NAME = "Clean Stock"
DEFAULT_FILE = "Current_Stock_Report.xlsm"


def create_current_stock_table(conn) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS current_stock (
            id         SERIAL PRIMARY KEY,
            code       INTEGER,
            location   TEXT,
            category   TEXT,
            product    TEXT,
            colour     TEXT,
            qty_mtrs   DOUBLE PRECISION,
            qty_kgs    DOUBLE PRECISION,
            bales      DOUBLE PRECISION,
            as_of_date DATE
        )
    """)
    conn.commit()
    print("  ✓ Table ready: current_stock")


def safe_float(val) -> Optional[float]:
    if val is None or val == "" or val == " ":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def safe_int(val) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def ingest_current_stock(
    conn,
    file_path: Path | None = None,
    as_of_date: date | None = None,
) -> int:
    """
    Replace the current_stock snapshot with rows from Clean Stock.

    Args:
        conn:       Database connection (psycopg2-compatible).
        file_path:  Path to Current_Stock_Report.xlsm.
                    Defaults to the workspace root (parent of sheets/).
        as_of_date: Snapshot date to record. Defaults to today.

    Returns:
        Number of rows inserted.
    """
    if file_path is None:
        file_path = Path(__file__).resolve().parents[3] / DEFAULT_FILE
    if as_of_date is None:
        as_of_date = date.today()

    if not file_path.exists():
        raise FileNotFoundError(f"Current stock report not found: {file_path}")

    print(f"\n[CURRENT STOCK] Reading from: {file_path.name}")
    create_current_stock_table(conn)

    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True, keep_vba=False)
    if SHEET_NAME not in wb.sheetnames:
        wb.close()
        raise ValueError(
            f"Sheet '{SHEET_NAME}' not found in {file_path.name}. "
            f"Available sheets: {wb.sheetnames}"
        )

    ws = wb[SHEET_NAME]
    rows = list(ws.iter_rows(min_row=2, values_only=True))  # row 1 = headers
    wb.close()

    records = []
    for row in rows:
        if not row or row[0] is None:
            continue
        code = safe_int(row[0])
        if code is None:
            continue
        records.append((
            code,
            str(row[1]).strip() if row[1] else None,   # location
            str(row[2]).strip() if row[2] else None,   # category
            str(row[3]).strip() if row[3] else None,   # product
            str(row[4]).strip() if row[4] else None,   # colour
            safe_float(row[5]),                          # qty_mtrs
            safe_float(row[6]),                          # qty_kgs
            safe_float(row[7]),                          # bales
            as_of_date,
        ))

    conn.execute("DELETE FROM current_stock")
    conn.executemany(
        """
        INSERT INTO current_stock
            (code, location, category, product, colour, qty_mtrs, qty_kgs, bales, as_of_date)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        records,
    )
    conn.commit()
    print(f"  ✓ Inserted {len(records)} current stock records (as of {as_of_date})")
    return len(records)


if __name__ == "__main__":
    conn = get_connection()
    try:
        path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
        n = ingest_current_stock(conn, file_path=path)
        print(f"\nDone — {n} records in current_stock table")
    except Exception as exc:
        conn.rollback()
        print(f"❌ Failed: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()
