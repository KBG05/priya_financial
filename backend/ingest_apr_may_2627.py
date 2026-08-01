"""
One-off: ingest real Apr/May item_sales + item_purchases for FY 26_27 from the
user-supplied Tally exports (raw SKU Sales+Purchase files, not PMC-derived),
then recalculate contribution for those months.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sheets.db import get_connection
from sheets.ingest_item_sales import ingest_item_sales
from sheets.ingest_item_purchases import ingest_item_purchases
from sheets.calculate_contribution import calculate_contribution

FY = "26_27"
FILES = {
    "Apr": Path("/home/kbg/Documents/PriyaFil/1.Apr 26 SKU Sales  Purchase.xlsx"),
    "May": Path("/home/kbg/Documents/PriyaFil/2.May 26 SKU Sales Purchase.xlsx"),
    "Jun": Path("/home/kbg/Documents/PriyaFil/3.Jun 26 SKU Sales & Purchase.xlsx"),
}


def main():
    conn = get_connection()
    try:
        for month, fp in FILES.items():
            print(f"\n=== {month} ({fp.name}) ===")
            ingest_item_sales(conn, FY, month, filepath=fp)
            ingest_item_purchases(conn, fp, FY, month)
        conn.commit()

        calculate_contribution(conn, FY, months=list(FILES.keys()))
        conn.commit()
        print("\nDone.")
    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
