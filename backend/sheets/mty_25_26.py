"""
Create MTY (Material Type Yield) table for fiscal year.

Table stores calculated MTY line items by month.
"""


def create_mty_table(conn, fy_suffix: str) -> None:
    """Create MTY table for a specific fiscal year."""
    table_name = f"mty_{fy_suffix}"
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            id INTEGER PRIMARY KEY,
            month TEXT NOT NULL,
            line_item TEXT NOT NULL,
            value REAL,
            qty REAL,
            UNIQUE(month, line_item)
        )
    """
    )
    try:
        # Backfill: add qty column for existing tables (ignore if it already exists).
        conn.execute(f"ALTER TABLE {table_name} ADD COLUMN qty REAL")
    except Exception:
        conn.rollback()
    conn.commit()
    print(f"  ✓ Created table: {table_name}")


if __name__ == "__main__":
    import sys
    from pathlib import Path

    # Add parent directory to path for imports
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from sheets.db import get_connection

    conn = get_connection()
    create_mty_table(conn, "25_26")
    conn.close()
