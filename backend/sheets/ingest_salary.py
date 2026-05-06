"""
Ingest Salary data from Salary Excel file.

Source: InputTallyTarka/PFCO November 25 Salary.xls -> Monitor FY25-26 sheet

Structure:
- Row 2: Month headers (Excel date serial numbers)
- Row 3: Sub-headers (EMP Nos, GROSS SALARY for each month)
- Rows 4-25: Department salary data
- Rows 26-30: Totals/Abstract (SKIP)
- Rows 33-42: Individual employee salary data
- Row 43+: Totals (SKIP)

Each month has 2 columns: EMP Nos (col 0), GROSS SALARY (col 1)
Months start at column D (index 3)
"""

from pathlib import Path
from typing import Optional
import xlrd
from datetime import datetime, timedelta


def create_salary_table(conn, fy_suffix: str) -> None:
    """Create salary table for a specific fiscal year."""
    table_name = f"salary_{fy_suffix}"
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            id INTEGER PRIMARY KEY,
            department TEXT NOT NULL,
            cost_centre TEXT,
            month TEXT NOT NULL,
            emp_count INTEGER,
            gross_salary REAL,
            UNIQUE(department, month)
        )
    """
    )
    conn.commit()
    print(f"  ✓ Created table: {table_name}")


def safe_float(val) -> Optional[float]:
    """Safely convert value to float."""
    if val is None or val == "" or val == " ":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def safe_int(val) -> Optional[int]:
    """Safely convert value to int."""
    if val is None or val == "" or val == " ":
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def serial_to_month(serial: float) -> str:
    """Convert Excel date serial to month name."""
    # Excel epoch: 1899-12-30
    # Serial 45748 = Apr 2025, 45778 = May 2025, etc.
    date = datetime(1899, 12, 30) + timedelta(days=int(serial))
    month_names = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ]
    return month_names[date.month - 1]


# Month column mapping (0-indexed)
# Row 2 contains Excel date serials, we'll parse them dynamically
# Each month has 2 columns: EMP Nos, GROSS SALARY
# Starting from column 3 (D), every 2 columns is a month


def ingest_salary(
    conn, input_dir: Path, fy_suffix: str, salary_file: Optional[Path] = None
) -> int:
    """
    Ingest salary data from Excel file.

    Args:
        conn: Database connection
        input_dir: Path to InputTallyTarka directory
        fy_suffix: Fiscal year suffix (e.g., '25_26')

    Returns:
        Number of records inserted
    """
    if salary_file is not None:
        filepath = salary_file
        if not filepath.exists():
            raise FileNotFoundError(f"Salary file not found: {filepath}")
    else:
        files = list(input_dir.glob("PFCO*Salary.xls"))
        if not files:
            files = list(input_dir.glob("PFCO*Salary.xlsx"))
        if not files:
            files = list(input_dir.glob("*Salary*.xls"))
        if not files:
            files = list(input_dir.glob("*Salary*.xlsx"))
        if not files:
            raise FileNotFoundError(f"No Salary file found in {input_dir}")
        filepath = files[0]
    print(f"\n[SALARY] Reading from: {filepath.name}")

    create_salary_table(conn, fy_suffix)
    table_name = f"salary_{fy_suffix}"
    conn.execute(f"DELETE FROM {table_name}")

    wb = xlrd.open_workbook(str(filepath))
    ws = wb.sheet_by_name("Monitor FY25-26")

    # Parse month names from row 2 (index 1)
    month_cols = {}  # {month_name: (emp_col_idx, salary_col_idx)}
    for col_idx in range(3, ws.ncols, 2):  # Start from col 3, step by 2
        if col_idx >= ws.ncols:
            break
        serial_val = ws.cell_value(1, col_idx)  # Row 2 = index 1
        if serial_val and isinstance(serial_val, (int, float)):
            month = serial_to_month(serial_val)
            month_cols[month] = (col_idx, col_idx + 1)  # (emp_count, gross_salary)

    print(f"  Found {len(month_cols)} months: {list(month_cols.keys())}")

    records = []

    # Process rows 4-25 (department data)
    for row_idx in range(3, 25):  # Row 4 = index 3, Row 25 = index 24
        if row_idx >= ws.nrows:
            break

        department = str(ws.cell_value(row_idx, 1)).strip()  # Column B
        if not department or department == "":
            continue

        cost_centre = (
            str(ws.cell_value(row_idx, 2)).strip() if ws.cell_value(row_idx, 2) else ""
        )

        for month, (emp_col, sal_col) in month_cols.items():
            emp_count = safe_int(ws.cell_value(row_idx, emp_col))
            gross_salary = safe_float(ws.cell_value(row_idx, sal_col))

            # Only insert if gross_salary has a value (skip empty future months)
            if gross_salary is not None and gross_salary > 0:
                records.append(
                    {
                        "department": department,
                        "cost_centre": cost_centre,
                        "month": month,
                        "emp_count": emp_count,
                        "gross_salary": gross_salary,
                    }
                )

    # Process rows 33-42 (individual employee data)
    for row_idx in range(32, 42):  # Row 33 = index 32, Row 42 = index 41
        if row_idx >= ws.nrows:
            break

        department = str(ws.cell_value(row_idx, 1)).strip()  # Column B (employee name)
        if not department or department == "" or department == "TOTAL":
            continue

        cost_centre = (
            str(ws.cell_value(row_idx, 2)).strip() if ws.cell_value(row_idx, 2) else ""
        )

        for month, (emp_col, sal_col) in month_cols.items():
            emp_count = safe_int(ws.cell_value(row_idx, emp_col))
            gross_salary = safe_float(ws.cell_value(row_idx, sal_col))

            # Only insert if gross_salary has a value (skip empty future months)
            if gross_salary is not None and gross_salary > 0:
                records.append(
                    {
                        "department": department,
                        "cost_centre": cost_centre,
                        "month": month,
                        "emp_count": emp_count,
                        "gross_salary": gross_salary,
                    }
                )

    cursor = conn.cursor()
    for rec in records:
        cursor.execute(
            f"""
            INSERT INTO {table_name}
            (department, cost_centre, month, emp_count, gross_salary)
            VALUES (%s, %s, %s, %s, %s)
        """,
            (
                rec["department"],
                rec["cost_centre"],
                rec["month"],
                rec["emp_count"],
                rec["gross_salary"],
            ),
        )

    conn.commit()

    total = len(records)
    print(f"  ✓ Inserted {total} salary records into {table_name}")

    # Summary
    cursor = conn.execute(f"SELECT COUNT(DISTINCT department) FROM {table_name}")
    dept_count = cursor.fetchone()[0]
    print(f"  Departments/Employees: {dept_count}")

    return total
