"""
Ingest Purchase data from Sales_Pur_Exps Excel file.

Source: InputTallyTarka/Sales_Pur_Exps-Nov.25.xlsx -> Purchase sheet

Sections:
- Rows 3-17: Raw Materials (HDPE, MB, CP) with discount for HDPE
- Rows 21-34: Monofil & Other (Sravya, Other, Consumables, Monofil Fab, Yarn)
- Rows 36-49: Trading Part 1 (TSN, MSN, PPS)
- Rows 51-64: Trading Part 2 (Weed Mat, Misc)
"""

from pathlib import Path
from typing import Optional
import openpyxl

from .db import MONTHS, get_connection, create_purchases_table, clear_table


# Column mappings for each section
# Format: (material_name, kgs_col, value_col, rate_col, discount_col, discounted_value_col)
# Columns are 0-indexed

RAW_MATERIAL_COLS = [
    ("HDPE", 1, 2, 3, 13, 14),  # B, C, D, N (discount), O (discounted_value)
    ("MB", 4, 5, 6, None, None),  # E, F, G
    ("CP", 7, 8, 9, None, None),  # H, I, J
]

MONOFIL_OTHER_COLS = [
    ("Sravya", 1, 2, 3, None, None),  # B, C, D
    ("Other", 4, 5, 6, None, None),  # E, F, G
    ("Consumables", None, 7, None, None, None),  # H (value only)
    ("Monofil Fabrication", 8, 9, 10, None, None),  # I, J, K
    ("Yarn", 11, 12, 13, None, None),  # L, M, N
]

TRADING_COLS_1 = [
    ("TSN", 1, 2, 3, None, None),  # B, C, D
    ("MSN", 4, 5, 6, None, None),  # E, F, G
    ("PPS", 7, 8, 9, None, None),  # H, I, J
]

TRADING_COLS_2 = [
    ("Weed Mat", 1, 2, 3, None, None),  # B, C, D
    ("Misc", 4, 5, 6, None, None),  # E, F, G
]


def parse_month_name(cell_value: str) -> Optional[str]:
    """Convert month names like 'APRIL', 'MAY' to 'Apr', 'May'."""
    if not cell_value:
        return None
    month_map = {
        "APRIL": "Apr",
        "MAY": "May",
        "JUNE": "Jun",
        "JULY": "Jul",
        "AUGUST": "Aug",
        "SEPT": "Sep",
        "OCT": "Oct",
        "NOV": "Nov",
        "DEC": "Dec",
        "JAN": "Jan",
        "FEB": "Feb",
        "MARCH": "Mar",
        "SEPTEMBER": "Sep",
        "OCTOBER": "Oct",
        "NOVEMBER": "Nov",
        "DECEMBER": "Dec",
        "JANUARY": "Jan",
        "FEBRUARY": "Feb",
    }
    return month_map.get(cell_value.upper().strip())


def safe_float(val) -> Optional[float]:
    """Safely convert value to float."""
    if val is None or val == "" or val == " ":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def extract_section(
    ws, start_row: int, end_row: int, col_specs: list, category: str
) -> list:
    """
    Extract data from a section of the Purchase sheet.

    Args:
        ws: Worksheet object
        start_row: First data row (1-indexed, after header)
        end_row: Last data row (before TOTAL row)
        col_specs: List of (material, kgs_col, value_col, rate_col, discount_col, discounted_value_col)
        category: Category name for this section

    Returns:
        List of dicts with purchase data
    """
    records = []

    for row_idx in range(start_row, end_row + 1):
        row = list(ws.iter_rows(min_row=row_idx, max_row=row_idx, values_only=True))[0]

        # Get month from column A
        month = parse_month_name(str(row[0]) if row[0] else "")
        if not month:
            continue

        # Extract each material's data
        for (
            material,
            kgs_col,
            value_col,
            rate_col,
            discount_col,
            discounted_value_col,
        ) in col_specs:
            qty = safe_float(row[kgs_col]) if kgs_col is not None else None
            value = safe_float(row[value_col]) if value_col is not None else None
            rate = safe_float(row[rate_col]) if rate_col is not None else None
            discount = (
                safe_float(row[discount_col]) if discount_col is not None else None
            )

            # For discounted_value: use column O for HDPE, otherwise same as value
            if discounted_value_col is not None:
                discounted_value = safe_float(row[discounted_value_col])
            else:
                discounted_value = value

            # Skip if no data at all
            if value is None and qty is None:
                continue

            records.append(
                {
                    "month": month,
                    "category": category,
                    "material": material,
                    "qty": qty,
                    "value": value,
                    "rate": rate,
                    "discount": discount,
                    "discounted_value": discounted_value,
                }
            )

    return records


def ingest_purchases(conn, filepath: Path, fy_suffix: str) -> int:
    """
    Ingest purchase data from Excel file.

    Args:
        conn: Database connection
        filepath: Path to Sales_Pur_Exps Excel file
        fy_suffix: Fiscal year suffix (e.g., '25_26')

    Returns:
        Number of records inserted
    """
    if not filepath.exists():
        raise FileNotFoundError(f"File not found: {filepath}")

    print(f"\n[PURCHASES] Reading from: {filepath.name}")

    # Create table if needed
    create_purchases_table(conn, fy_suffix)
    table_name = f"purchases_{fy_suffix}"
    clear_table(conn, table_name)

    # Load workbook
    wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
    ws = wb["Purchase"]

    all_records = []

    # Section 1: Raw Materials (rows 5-16)
    print("  Processing Raw Materials (HDPE, MB, CP)...")
    records = extract_section(ws, 5, 16, RAW_MATERIAL_COLS, "RAW_MATERIAL")
    all_records.extend(records)
    print(f"    → {len(records)} records")

    # Section 2: Monofil & Other (rows 22-33)
    print("  Processing Monofil & Other...")
    records = extract_section(ws, 22, 33, MONOFIL_OTHER_COLS, "MONOFIL_OTHER")
    all_records.extend(records)
    print(f"    → {len(records)} records")

    # Section 3: Trading Part 1 - TSN, MSN, PPS (rows 37-48)
    print("  Processing Trading (TSN, MSN, PPS)...")
    records = extract_section(ws, 37, 48, TRADING_COLS_1, "TRADING")
    all_records.extend(records)
    print(f"    → {len(records)} records")

    # Section 4: Trading Part 2 - Weed Mat, Misc (rows 52-63)
    print("  Processing Trading (Weed Mat, Misc)...")
    records = extract_section(ws, 52, 63, TRADING_COLS_2, "TRADING")
    all_records.extend(records)
    print(f"    → {len(records)} records")

    wb.close()

    # Insert all records
    cursor = conn.cursor()
    for rec in all_records:
        cursor.execute(
            f"""
            INSERT INTO {table_name} 
            (month, category, material, qty, value, rate, discount, discounted_value)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
            (
                rec["month"],
                rec["category"],
                rec["material"],
                rec["qty"],
                rec["value"],
                rec["rate"],
                rec["discount"],
                rec["discounted_value"],
            ),
        )

    conn.commit()

    total = len(all_records)
    print(f"\n  ✓ Inserted {total} purchase records into {table_name}")

    return total


if __name__ == "__main__":
    # Test standalone
    from .db import get_connection

    conn = get_connection()
    count = ingest_purchases(conn, Path("InputTallyTarka"), "25_26")
    print(f"\nTotal records: {count}")

    # Show sample
    cursor = conn.execute("SELECT * FROM purchases_25_26 LIMIT 10")
    for row in cursor:
        print(dict(row))

    conn.close()
