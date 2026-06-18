"""
Calculate product-level contribution per month — marginal costing methodology.

Data sources:
    item_sales_{fy}        populated from priya_textile.Aggregated Data (ORIGINAL sales)
    item_purchases_{fy}    populated from Purchase Register Excel (trading purchases)
    product_specification  SKU specs (fabrication charge, mts/kg)
    consumption_output_{fy}, mty_{fy}  for per-month cost scalars

────────────────────────────────────────────────────────────────────────
Per-month cost scalars (identical for all SKUs in the same month):

    rm_price_per_kg      = SUM(value) / SUM(qty)
                           FROM consumption_output_{fy}
                           WHERE material = 'Raw Material Consumption'

    filament_conv_per_kg = Variable-Yarn Cost (mty_{fy}) / SUM(RM consumption qty)

    fabric_cost_per_kg   = rm_price_per_kg + filament_conv_per_kg

────────────────────────────────────────────────────────────────────────
Per-SKU marginal costing steps:

    STEP 1  Original sales (never adjusted)
        sales_qty     = item_sales.qty
        sales_revenue = item_sales.revenue
        selling_price_per_kg = sales_revenue / sales_qty

    STEP 2  Purchase data (0 if SKU has no purchases this month)
        purchase_qty          = COALESCE(item_purchases.qty, 0)
        purchase_rate_per_kg  = COALESCE(item_purchases.purchase_rate_per_kg, 0)

    STEP 3  Purchase qty actually consumed in this month's sales
        purchase_qty_used = MIN(sales_qty, purchase_qty)

    STEP 4  Manufactured qty
        produced_qty = MAX(sales_qty - purchase_qty_used, 0)

    STEP 5  Costs
        manufacturing_cost   = produced_qty * (rm_price + filament_conv + fabrication)
        purchase_value_used  = purchase_qty_used * purchase_rate_per_kg

    STEP 6  Contribution
        contribution_value   = sales_revenue - manufacturing_cost - purchase_value_used
        contribution_per_kg  = contribution_value / sales_qty

────────────────────────────────────────────────────────────────────────
Products with no match in product_specification are included with fab_per_kg = 0
(manufacturing burden rm + fc still applied — no row is skipped).

Target table: contribution_{fy}
    id                   SERIAL PRIMARY KEY
    product_id           INT
    product_name         TEXT
    month                TEXT
    qty                  REAL   -- original sales qty
    revenue              REAL   -- original sales revenue
    selling_price_per_kg REAL   -- revenue / qty (never adjusted)
    rm_price             REAL   -- rm_price_per_kg for this month
    filament_conversion  REAL   -- filament_conv_per_kg for this month
    fabric_cost          REAL   -- rm_price + filament_conversion
    fabrication_per_kg   REAL   -- from product_specification
    mts_per_kg           REAL   -- from product_specification
    contribution_per_kg  REAL
    sales_mtrs           REAL
    contribution_value   REAL
    -- debug fields (nullable, populated when purchase register available)
    produced_qty         REAL
    purchase_qty_used    REAL
    purchase_value_used  REAL
    manufacturing_cost   REAL
"""

from typing import Optional

from .db import MONTHS, get_connection


def _table_exists(conn, table_name: str) -> bool:
    row = conn.execute(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = %s
        """,
        (table_name,),
    ).fetchone()
    return row is not None


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
            fabric_cost          REAL,
            fabrication_per_kg   REAL,
            mts_per_kg           REAL,
            contribution_per_kg  REAL,
            sales_mtrs           REAL,
            contribution_value   REAL,
            produced_qty         REAL,
            purchase_qty_used    REAL,
            purchase_value_used  REAL,
            manufacturing_cost   REAL
        )
    """)


def _migrate_table(conn, fy: str) -> None:
    """Add any debug columns that may be missing from pre-existing tables."""
    debug_cols = [
        ("produced_qty",      "REAL"),
        ("purchase_qty_used", "REAL"),
        ("purchase_value_used", "REAL"),
        ("manufacturing_cost", "REAL"),
    ]
    for col, dtype in debug_cols:
        try:
            conn.execute(f"ALTER TABLE contribution_{fy} ADD COLUMN IF NOT EXISTS {col} {dtype}")
        except Exception:
            conn.rollback()  # ignore if column already exists in older Postgres


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
    Filament conversion cost per kg of RM consumed.

    Numerator = all 'Variable & Direct Expense' EXCEPT 'Fabrication charges'.
    This captures: Yarn Processing + Power + Wages-Yarn + Wages-Fabric +
    Wages-I&D + Working Capital (OCC/Bank/LC) + Freight + Rent + Misc + R&M.

    Matches the reference Rate Card: Stage 2 (Yarn) + Stage 3 (Fabric add-on).
    """
    conversion_cost = _q1(
        conn,
        f"""SELECT SUM(value) FROM direct_expenses_output_{fy}
            WHERE month = %s
              AND category = 'Variable & Direct Expense'
              AND particulars != 'Fabrication charges'""",
        (month,),
    )
    monofil_qty = _q1(
        conn,
        f"""SELECT SUM(qty) FROM consumption_output_{fy}
            WHERE material = 'Raw Material Consumption' AND month = %s""",
        (month,),
    )
    return conversion_cost / monofil_qty if monofil_qty else 0.0


def _fabric_cost(conn, fy: str, month: str) -> float:
    """
    Total fabric cost per kg of RM consumed (display-only).

    = Variable-Fabric Cost (from mty) / SUM(RM consumption qty from consumption_output)
    Includes both common fabric rate and per-SKU fabrication charges.
    """
    var_fabric = _q1(
        conn,
        f"SELECT value FROM mty_{fy} WHERE line_item = 'Variable-Fabric Cost' AND month = %s",
        (month,),
    )
    monofil_qty = _q1(
        conn,
        f"""SELECT SUM(qty) FROM consumption_output_{fy}
            WHERE material = 'Raw Material Consumption' AND month = %s""",
        (month,),
    )
    return var_fabric / monofil_qty if monofil_qty else 0.0


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
    item_sales_table = f"item_sales_{fy}"
    if not _table_exists(conn, item_sales_table):
        print(f"  ⚠  {item_sales_table} not found — contribution calculation skipped")
        return

    _create_table(conn, fy)
    _migrate_table(conn, fy)

    # Get distinct months available in item_sales
    rows = conn.execute(f"SELECT DISTINCT month FROM {item_sales_table}").fetchall()
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
        fabric_cost_per_kg = rm + fc   # user definition: rm + filament_conv

        print(f"  [{month}] RM_PRICE={rm:.4f}  FILAMENT_CONV={fc:.4f}  FABRIC_COST={fabric_cost_per_kg:.4f}")

        # LEFT JOIN item_purchases if the table exists (optional purchase register)
        has_purchases = _table_exists(conn, f"item_purchases_{fy}")
        if has_purchases:
            purchase_join = f"LEFT JOIN item_purchases_{fy} ip ON ip.product_id = s.product_id AND ip.month = s.month"
            purchase_cols = "COALESCE(ip.qty, 0) AS purchase_qty, COALESCE(ip.purchase_rate_per_kg, 0) AS purchase_rate"
            # Exclude products in neither spec nor purchases (e.g. HDPE/Yarn/Waste RM re-sales)
            scope_filter = "AND (p.product_code IS NOT NULL OR ip.product_id IS NOT NULL)"
        else:
            purchase_join = ""
            purchase_cols = "0 AS purchase_qty, 0 AS purchase_rate"
            scope_filter = "AND p.product_code IS NOT NULL"

        # JOIN item_sales with product_specification averaged by product_code.
        sql = f"""
            SELECT
                s.product_id,
                p.product_name,
                s.qty,
                s.revenue,
                s.selling_price_per_kg,
                p.fabrication_charge_per_kg,
                p.mts_per_kg,
                {purchase_cols}
            FROM item_sales_{fy} s
            LEFT JOIN (
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
            {purchase_join}
            WHERE s.month = %s
            {scope_filter}
        """
        matched_rows = conn.execute(sql, (month,)).fetchall()

        inserted = 0
        for row in matched_rows:
            (pid, pname, qty, rev, sell_rate,
             fab_per_kg, mts_per_kg, purchase_qty, purchase_rate) = (
                row[0], row[1], row[2], row[3], row[4],
                row[5], row[6], row[7], row[8],
            )
            qty          = float(qty or 0)
            rev          = float(rev or 0)
            sell_rate    = float(sell_rate or 0)    # original, never adjusted
            fab_per_kg   = float(fab_per_kg or 0)
            mts_per_kg   = float(mts_per_kg or 0)
            purchase_qty  = float(purchase_qty or 0)
            purchase_rate = float(purchase_rate or 0)

            # ── Marginal costing steps ──────────────────────────────────
            purchase_qty_used   = min(purchase_qty, qty)          # Step 3
            produced_qty        = max(qty - purchase_qty_used, 0.0)  # Step 4

            manufacturing_cost  = produced_qty * (rm + fc + fab_per_kg)  # Step 5a
            purchase_value_used = purchase_qty_used * purchase_rate       # Step 5b

            contrib_value  = rev - manufacturing_cost - purchase_value_used  # Step 6
            contrib_per_kg = contrib_value / qty if qty else 0.0
            sales_mtrs     = qty * mts_per_kg

            conn.execute(
                f"""INSERT INTO contribution_{fy}
                    (product_id, product_name, month, qty, revenue, selling_price_per_kg,
                     rm_price, filament_conversion, fabric_cost, fabrication_per_kg, mts_per_kg,
                     contribution_per_kg, sales_mtrs, contribution_value,
                     produced_qty, purchase_qty_used, purchase_value_used, manufacturing_cost)
                VALUES (%s,%s,%s,%s,%s,%s, %s,%s,%s,%s,%s, %s,%s,%s, %s,%s,%s,%s)""",
                (pid, pname, month, qty, rev, sell_rate,
                 rm, fc, fabric_cost_per_kg, fab_per_kg, mts_per_kg,
                 contrib_per_kg, sales_mtrs, contrib_value,
                 produced_qty, purchase_qty_used, purchase_value_used, manufacturing_cost),
            )
            inserted += 1

        # Count products in item_sales that had no match in product_specification
        total_in_sales = _q1(
            conn,
            f"SELECT COUNT(*) FROM item_sales_{fy} WHERE month = %s",
            (month,),
        )
        unmatched = int(total_in_sales) - inserted
        print(
            f"  [{month}] Inserted {inserted} products"
            + (f" ({unmatched} excluded — not in spec or purchases)" if unmatched else "")
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
