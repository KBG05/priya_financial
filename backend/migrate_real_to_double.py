"""
One-off migration: widen every REAL (float32) column in the public schema to
DOUBLE PRECISION.

REAL keeps ~7 significant digits, so crore-scale rupee values were silently
rounded on insert (e.g. closing stock 8,60,88,987 stored as 8,60,88,984).
New tables are already created as DOUBLE PRECISION; this fixes existing ones.

Widening keeps the already-rounded values — re-run ingestion for the FY
afterwards to restore exact figures.

Usage (from app/backend):
    uv run python migrate_real_to_double.py            # dry run
    uv run python migrate_real_to_double.py --apply
"""

import sys

from sheets.db import get_connection


def main(apply: bool) -> None:
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND data_type = 'real'
        ORDER BY table_name, column_name
        """
    ).fetchall()

    if not rows:
        print("No REAL columns found — nothing to do.")
        return

    for table, column in rows:
        print(f"  {table}.{column}: real → double precision")
        if apply:
            conn.execute(
                f'ALTER TABLE "{table}" ALTER COLUMN "{column}" TYPE DOUBLE PRECISION'
            )

    if apply:
        conn.commit()
        print(f"✓ Widened {len(rows)} columns")
    else:
        print(f"Dry run: {len(rows)} columns would change. Re-run with --apply.")
    conn.close()


if __name__ == "__main__":
    main("--apply" in sys.argv)
