"""
Calculate product-level contribution per month from item_sales_{fy} and product_specification.

For each month available in item_sales_{fy}, the following per-month scalars are derived
from the DB (so every product in the same month gets the same constants):

    RM_PRICE (Rs/kg):
        = SUM(value) / SUM(qty)
          FROM consumption_output_{fy}
          WHERE material = 'Raw Material Consumption' AND month = <month>

    FILAMENT_CONV (Rs/kg finished goods):
        var_yarn_cost = mty_{fy}.value  WHERE line_item='Variable-Yarn Cost' AND month=<month>
        fixed_cost    = mty_{fy}.value  WHERE line_item='Fixed Cost'          AND month=<month>
        fg_total_qty  = SUM(qty) FROM inventory_sales_{fy}
                        WHERE category='FINISHED_GOODS' AND month=<month>
        FILAMENT_CONV = (var_yarn_cost + fixed_cost) / fg_total_qty

Per-product formulas (JOIN item_sales_{fy} ⋈ product_specification):

    fabrication_per_kg  = product_specification.fabrication_charge_per_kg
    mts_per_kg          = product_specification.mts_per_kg
    contribution_per_kg = selling_price_per_kg - RM_PRICE - FILAMENT_CONV - fabrication_per_kg
    sales_mtrs          = qty * mts_per_kg
    contribution_value  = qty * contribution_per_kg

Products with no matching product_code in product_specification are silently skipped.

Target table: contribution_{fy}
    id                   SERIAL PRIMARY KEY
    product_id           INT
    product_name         TEXT
    month                TEXT
    qty                  REAL
    revenue              REAL
    selling_price_per_kg REAL
    rm_price             REAL
    filament_conversion  REAL
    fabrication_per_kg   REAL
    mts_per_kg           REAL
    contribution_per_kg  REAL
    sales_mtrs           REAL
    contribution_value   REAL
"""

from typing import Optional

from .db import MONTHS, get_connection


def _q1(conn, sql: str, params=()):
    """Return first column of first row, or 0.0 if no rows."""
    rows = conn.execute(sql, params).fetchall()
    if not rows or rows[0][0] is None:
        return 0.0
    return float(rows[0][0])


def _create_table(conn, fy: str) -> None:
    conn.execute(f"""
        CREATE TABLE IF NOT EXISTS contribution_{fy} (
            id                   SERIAL PRIMARY KEY,
            product_id           INTEGER NOT NULL,
            product_name         TEXT,
            month                TEXT    NOT NULL,
            qty                  REAL,
            revenue              REAL,
            selling_price_per_kg REAL,
            rm_price             REAL,
            filament_conversion  REAL,
            fabrication_per_kg   REAL,
            mts_per_kg           REAL,
            contribution_per_kg  REAL,
            sales_mtrs           REAL,
            contribution_value   REAL
        )
    """)


def _rm_price(conn, fy: str, month: str) -> float:
    """RM Price per kg for the given month."""
    total_qty = _q1(
        conn,
        f"""SELECT SUM(qty) FROM consumption_output_{fy}
            WHERE material = 'Raw Material Consumption' AND month = %s""",
        (month,),
    )
    total_val = _q1(
        conn,
        f"""SELECT SUM(value) FROM consumption_output_{fy}
            WHERE material = 'Raw Material Consumption' AND month = %s""",
        (month,),
    )
    return total_val / total_qty if total_qty else 0.0


def _filament_conversion(conn, fy: str, month: str) -> float:
    """
    Filament conversion cost per kg of finished goods for the given month.

    = (Variable-Yarn Cost + Fixed Cost from mty) / SUM(FG qty from inventory_sales)
    """
    var_yarn = _q1(
        conn,
        f"SELECT value FROM mty_{fy} WHERE line_item = 'Variable-Yarn Cost' AND month = %s",
        (month,),
    )
    fixed = _q1(
        conn,
        f"SELECT value FROM mty_{fy} WHERE line_item = 'Fixed Cost' AND month = %s",
        (month,),
    )
    fg_qty = _q1(
        conn,
        f"""SELECT SUM(qty) FROM inventory_sales_{fy}
            WHERE category = 'FINISHED_GOODS' AND month = %s""",
        (month,),
    )
    return (var_yarn + fixed) / fg_qty if fg_qty else 0.0


def calculate_contribution(
    conn,
    fy: str,
    months: Optional[list] = None,
) -> None:
    """
    Calculate contribution for all months present in item_sales_{fy}.

    Parameters
    ----------
    conn   : DB connection
    fy     : FY suffix, e.g. '25_26'
    months : Optional list of month strings to restrict processing.
             If None, all months found in item_sales_{fy} are processed.
    """
    _create_table(conn, fy)

    # Get distinct months available in item_sales
    rows = conn.execute(f"SELECT DISTINCT month FROM item_sales_{fy}").fetchall()
    available = [r[0] for r in rows]

    if not available:
        print("  ⚠  No data in item_sales_{fy} — contribution calculation skipped")
        return

    # Filter to requested months if provided
    if months:
        to_process = [m for m in months if m in available]
        skipped = [m for m in months if m not in available]
        if skipped:
            print(f"  ⚠  Months requested but not in item_sales_{fy}: {skipped}")
    else:
        # Process in FY month order
        to_process = [m for m in MONTHS if m in available]

    print(f"  Processing contribution for months: {to_process}")

    for month in to_process:
        # Delete existing rows for this month before recalculating
        conn.execute(f"DELETE FROM contribution_{fy} WHERE month = %s", (month,))

        rm = _rm_price(conn, fy, month)
        fc = _filament_conversion(conn, fy, month)

        print(f"  [{month}] RM_PRICE={rm:.4f}  FILAMENT_CONV={fc:.4f}")

        # JOIN item_sales with product_specification averaged by product_code.
        # Average base specs, then recompute derived fields from the averaged inputs.
        sql = f"""
            SELECT
                s.product_id,
                p.product_name,
                s.qty,
                s.revenue,
                s.selling_price_per_kg,
                p.fabrication_charge_per_kg,
                p.mts_per_kg
            FROM item_sales_{fy} s
            JOIN (
                SELECT
                    product_code,
                    MIN(product_name) AS product_name,
                    AVG(width) AS width,
                    AVG(length) AS length,
                    AVG(weight) AS weight,
                    AVG(fabrication_charge_basic) AS fabrication_charge_basic,
                    CASE
                        WHEN AVG(weight) IS NULL OR AVG(weight) = 0 OR AVG(length) IS NULL OR AVG(length) = 0 THEN 0
                        ELSE AVG(length) / AVG(weight)
                    END AS mts_per_kg,
                    CASE
                        WHEN AVG(length) IS NULL OR AVG(length) = 0 OR AVG(weight) IS NULL OR AVG(weight) = 0 THEN 0
                        ELSE (AVG(weight) * 1000) / AVG(length)
                    END AS grm,
                    CASE
                        WHEN AVG(width) IS NULL OR AVG(width) = 0 OR AVG(length) IS NULL OR AVG(length) = 0 OR AVG(weight) IS NULL OR AVG(weight) = 0 THEN 0
                        ELSE ((AVG(weight) * 1000) / AVG(length)) / (AVG(width) / 39.37)
                    END AS gsm,
                    CASE
                        WHEN AVG(weight) IS NULL OR AVG(weight) = 0 OR AVG(length) IS NULL OR AVG(length) = 0 THEN 0
                        ELSE AVG(fabrication_charge_basic) * (AVG(length) / AVG(weight))
                    END AS fabrication_charge_per_kg
                FROM product_specification
                WHERE product_code IS NOT NULL
                GROUP BY product_code
            ) p ON s.product_id = p.product_code
            WHERE s.month = %s
        """
        matched_rows = conn.execute(sql, (month,)).fetchall()

        inserted = 0
        for row in matched_rows:
            pid, pname, qty, rev, sell_rate, fab_per_kg, mts_per_kg = (
                row[0], row[1], row[2], row[3], row[4], row[5], row[6],
            )
            qty = float(qty or 0)
            rev = float(rev or 0)
            sell_rate = float(sell_rate or 0)
            fab_per_kg = float(fab_per_kg or 0)
            mts_per_kg = float(mts_per_kg or 0)

            contrib_per_kg = sell_rate - rm - fc - fab_per_kg
            sales_mtrs = qty * mts_per_kg
            contrib_value = qty * contrib_per_kg

            conn.execute(
                f"""INSERT INTO contribution_{fy}
                    (product_id, product_name, month, qty, revenue, selling_price_per_kg,
                     rm_price, filament_conversion, fabrication_per_kg, mts_per_kg,
                     contribution_per_kg, sales_mtrs, contribution_value)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (pid, pname, month, qty, rev, sell_rate,
                 rm, fc, fab_per_kg, mts_per_kg,
                 contrib_per_kg, sales_mtrs, contrib_value),
            )
            inserted += 1

        # Count products in item_sales that had no match
        total_in_sales = _q1(
            conn,
            f"SELECT COUNT(*) FROM item_sales_{fy} WHERE month = %s",
            (month,),
        )
        unmatched = int(total_in_sales) - inserted
        print(
            f"  [{month}] Inserted {inserted} products"
            + (f" ({unmatched} skipped — no product_specification match)" if unmatched else "")
        )


if __name__ == "__main__":
    import sys

    fy = sys.argv[1] if len(sys.argv) > 1 else "25_26"
    months_arg = sys.argv[2].split(",") if len(sys.argv) > 2 else None

    conn = get_connection()
    try:
        calculate_contribution(conn, fy, months=months_arg)
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
