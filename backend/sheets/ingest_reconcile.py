"""
Ingest Reconcile data from Qty Summary Excel file.

Source: InputTallyTarka/PFCo 25-26 Qty Summary(November2025).xlsx -> Reconcile sheet

Structure:
- Row 2: Headers (blank, Op Stock, Apr, May, Jun, ...)
- Row 3: Sub-headers (HMT, CRK, Diff for each month)
- Rows 4-18: Material reconciliation data

HMT column positions (0-indexed):
- Op Stock: col 1
- Apr: col 4, May: col 7, Jun: col 10, Jul: col 13, 
- Aug: col 16, Sep: col 19, Oct: col 22, Nov: col 25,
- Dec: col 28, Jan: col 31, Feb: col 34, Mar: col 37
"""

from pathlib import Path
from typing import Optional
import openpyxl


def create_reconcile_table(conn, fy_suffix: str) -> None:
    """Create reconcile table for a specific fiscal year."""
    table_name = f"reconcile_{fy_suffix}"
    conn.execute(f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            id INTEGER PRIMARY KEY,
            particular TEXT NOT NULL,
            month TEXT NOT NULL,
            hmt_value REAL,
            UNIQUE(particular, month)
        )
    """)
    conn.commit()
    print(f"  ✓ Created table: {table_name}")


def safe_float(val) -> Optional[float]:
    """Safely convert value to float."""
    if val is None or val == '' or val == ' ':
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


# HMT column mapping (0-indexed column numbers)
# Each month has 3 columns (HMT, CRK, Diff), we only want HMT
MONTH_COLS = {
    'Op Stock': 1,   # Column B
    'Apr': 4,        # Column E
    'May': 7,        # Column H
    'Jun': 10,       # Column K
    'Jul': 13,       # Column N
    'Aug': 16,       # Column Q
    'Sep': 19,       # Column T
    'Oct': 22,       # Column W
    'Nov': 25,       # Column Z
    'Dec': 28,       # Column AC
    'Jan': 31,       # Column AF
    'Feb': 34,       # Column AI
    'Mar': 37,       # Column AL
}

# Data rows: start from row 4, end at row 18 (inclusive)
DATA_START_ROW = 4
DATA_END_ROW = 18


def ingest_reconcile(conn, input_dir: Path, fy_suffix: str) -> int:
    """
    Ingest reconcile data from Excel file.

    Args:
        conn: Database connection
        input_dir: Path to InputTallyTarka directory
        fy_suffix: Fiscal year suffix (e.g., '25_26')

    Returns:
        Number of records inserted
    """
    files = list(input_dir.glob('PFCo*Qty Summary*.xlsx'))
    if not files:
        raise FileNotFoundError(f"No Qty Summary file found in {input_dir}")

    filepath = files[0]
    print(f"\n[RECONCILE] Reading from: {filepath.name}")

    create_reconcile_table(conn, fy_suffix)
    table_name = f"reconcile_{fy_suffix}"
    conn.execute(f"DELETE FROM {table_name}")

    wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
    ws = wb['Reconcile']

    records = []

    for row_idx in range(DATA_START_ROW, DATA_END_ROW + 1):
        row = list(ws.iter_rows(min_row=row_idx, max_row=row_idx, values_only=True))[0]

        # Get particular name from column A (index 0)
        particular = str(row[0]).strip() if row[0] else None
        if not particular or particular == '':
            continue

        # Extract HMT value for each month
        for month, col_idx in MONTH_COLS.items():
            hmt_value = safe_float(row[col_idx])
            
            # Only insert if there's a value
            if hmt_value is not None:
                records.append({
                    'particular': particular,
                    'month': month,
                    'hmt_value': hmt_value,
                })

    wb.close()

    cursor = conn.cursor()
    for rec in records:
        cursor.execute(f"""
            INSERT INTO {table_name}
            (particular, month, hmt_value)
            VALUES (%s, %s, %s)
        """, (rec['particular'], rec['month'], rec['hmt_value']))

    conn.commit()

    total = len(records)
    print(f"  ✓ Inserted {total} reconcile records into {table_name}")

    # Show unique particulars
    cursor = conn.execute(f"SELECT DISTINCT particular FROM {table_name} ORDER BY particular")
    particulars = [row[0] for row in cursor]
    print(f"  Particulars: {len(particulars)}")
    for particular in particulars:
        print(f"    - {particular}")

    return total
