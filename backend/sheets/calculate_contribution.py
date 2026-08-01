"""
Calculate product-level contribution per month — marginal costing methodology.

Data sources:
    item_sales_{fy}        populated from priya_textile.Aggregated Data (ORIGINAL sales)
    item_purchases_{fy}    populated from Purchase Register Excel (trading purchases)
    product_specification  SKU specs (fabrication charge, mts/kg)
    consumption_output_{fy}, mty_{fy}  for per-month cost scalars

────────────────────────────────────────────────────────────────────────
PMC Rate Card (4.PMC_Jul 26_V3.xlsx, sheet "Rate Card")

The three stages below reproduce V3's derived rates exactly:

    STAGE 1  rm_cost_per_kg = rm_rate_base * YIELD          (V3 B24 = B4*B5)
             wastage_per_kg = rm_cost_per_kg * WASTAGE      (V3 B25 = B24*B6)
             stage1_rm      = rm_cost_per_kg + wastage_per_kg   (V3 B26)

    STAGE 2  stage2_yarn    = yarn_conversion_per_kg        (V3 B27)

    STAGE 3  fabric_addon_per_kg                            (V3 B28)
             fabrication_per_kg = spec_fab_per_kg + FAB_RATE_INCREASE
                                                            (V3 SKU Master col G)

    mfg_cost_per_kg = 0  if the SKU has no Wt/Mt, else
                      stage1_rm + stage2_yarn + fabrication_per_kg + fabric_addon
                                                            (V3 SKU Master col H)

Difference from V3 by design: V3 hardcodes FY-average scalars in the Rate Card
(RM 151.17, in-house yarn 31.26, addon 14.47), whereas we derive Stage 1's RM
rate, Stage 2 and Stage 3's add-on from each month's own ledger — per the
ruling that the Rate Card should carry the month's actual values. So monthly
totals will not equal V3's; the formula shape is identical.

────────────────────────────────────────────────────────────────────────
Per-month cost scalars (identical for all SKUs in the same month):

    rm_rate_base         = SUM(value) / SUM(qty)
                           FROM consumption_output_{fy}
                           WHERE material = 'Raw Material Consumption'
                           -- V3 B4, but monthly actual instead of FY average

    yarn_conversion_per_kg  = SUM(Wages-Yarn, Power Bill, R&M-Machinery, R&M-Electricals,
                                   Freight Inwards, Rent, Misc, Yarn Processing charges)
                               / SUM(RM consumption qty)
                               -- matches PMC Rate Card "Stage 2 — Yarn Processing Rate"

    fabric_addon_per_kg     = SUM(Wages-Fabric, Wages-Inspection & Dispatch,
                                   Working Capital-Bank Charges, Working Capital-LC,
                                   Working Capital-OCC)
                               / SUM(RM consumption qty)
                               -- matches PMC Rate Card "Stage 3 — Fabric Rate" common add-on
                               -- (excludes SKU-specific fabrication charges, added per-SKU below)

    filament_conv_per_kg = yarn_conversion_per_kg + fabric_addon_per_kg
                            -- identical total to the old single-bucket calculation;
                            -- kept as a column for backwards compatibility

    fabric_cost_per_kg   = stage1_rm + filament_conv_per_kg
                            -- note: stage1_rm, not the raw RM rate, so this is
                            -- the full per-kg burden excluding SKU-specific fab

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
        manufacturing_cost   = produced_qty * mfg_cost_per_kg
        purchase_value_used  = purchase_qty_used * purchase_rate_per_kg

    STEP 6  Contribution
        contribution_value   = sales_revenue - manufacturing_cost - purchase_value_used
        contribution_per_kg  = contribution_value / sales_qty

────────────────────────────────────────────────────────────────────────
Products with no Wt/Mt (no product_specification row, or a blank weight/length)
carry mfg_cost_per_kg = 0, matching V3's
`=IF(OR(E="",E=0), 0, Stage1_RM+Stage2_Yarn+G+FabricAddon)`. As of the
Ratio Masterv2 master no sold SKU falls into this case, so it is a safety net.

Target table: contribution_{fy}
    id                   SERIAL PRIMARY KEY
    product_id           INT
    product_name         TEXT
    month                TEXT
    qty                  REAL   -- original sales qty
    revenue              REAL   -- original sales revenue
    selling_price_per_kg REAL   -- revenue / qty (never adjusted)
    rm_price             REAL   -- PMC Stage1 TOTAL: rm_rate_base * yield * (1 + wastage)
    rm_rate_base         REAL   -- raw RM rate before yield/wastage (PMC B4)
    wastage_per_kg       REAL   -- PMC B25
    yarn_conversion      REAL   -- yarn_conversion_per_kg for this month (PMC Stage2 Yarn)
    fabric_addon         REAL   -- fabric_addon_per_kg for this month (PMC Stage3 common add-on)
    filament_conversion  REAL   -- yarn_conversion + fabric_addon (kept for backwards compatibility)
    fabric_cost          REAL   -- rm_price (Stage1) + filament_conversion
    fabrication_per_kg   REAL   -- spec fab/kg + fab_rate_increase (PMC SKU Master col G)
    fab_rate_increase    REAL   -- flat PMC B14 uplift included in fabrication_per_kg
    mfg_cost_per_kg      REAL   -- PMC SKU Master col H
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

# ── PMC Rate Card constants (4.PMC_Jul 26_V3.xlsx, sheet "Rate Card") ────────
# These are the inputs V3 hardcodes and we cannot derive from the ledger.
# Everything else (RM rate, yarn conversion, fabric add-on, SKU fab rate) is
# taken from the month's own data.
#
# YIELD    V3 B5  — kg of RM input per kg of fabric (99.63% historical yield).
# WASTAGE  V3 B6  — uplift on RM cost. V3 ships 2%; its own note says
#                   "Hist=0 (actual consumption), set 5% for forecasts". We
#                   follow the file as shipped. Set to 0.0 to cost historical
#                   months on actual consumption.
# FAB_RATE_INCREASE
#          V3 B14 — flat ₹/kg added to every SKU's fab rate. Same caveat:
#                   the file ships ₹2 while its note says "Hist=0".
YIELD_KG_RM_PER_KG_FABRIC = 1.0037
WASTAGE_ALLOWANCE = 0.02
FAB_RATE_INCREASE_PER_KG = 2.0


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
            yarn_conversion      REAL,
            fabric_addon         REAL,
            filament_conversion  REAL,
            fabric_cost          REAL,
            fabrication_per_kg   REAL,
            rm_rate_base         REAL,
            wastage_per_kg       REAL,
            fab_rate_increase    REAL,
            mfg_cost_per_kg      REAL,
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
        ("yarn_conversion",   "REAL"),
        ("fabric_addon",      "REAL"),
        ("rm_rate_base",      "REAL"),
        ("wastage_per_kg",    "REAL"),
        ("fab_rate_increase", "REAL"),
        ("mfg_cost_per_kg",   "REAL"),
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


# PMC Rate Card "Stage 2 — Yarn Processing Rate (blended)": in-house yarn cost
# drivers plus the outsourced "Yarn Processing charges" line — dividing the
# actual total (in-house + outsourced) by total qty reproduces the blended
# rate without needing an explicit outsourced-% input.
_YARN_PARTICULARS = (
    "Wages-Yarn", "Power Bill", "R & M-Machinery", "R & M-Electricals",
    "Freight Inwards", "Rent", "Misc", "Yarn Processing charges",
)

# PMC Rate Card "Stage 3 — Fabric Rate Components" common add-on
# (SKU-specific fabrication charge is added separately, per-SKU).
_FABRIC_ADDON_PARTICULARS = (
    "Wages-Fabric", "Wages-Inspection & Dispatch",
    "Working Capital-Bank Charges", "Working Capital-LC", "Working Capital-OCC",
)


def _sum_particulars_per_kg(conn, fy: str, month: str, particulars: tuple) -> float:
    placeholders = ",".join(["%s"] * len(particulars))
    cost = _q1(
        conn,
        f"""SELECT SUM(value) FROM direct_expenses_output_{fy}
            WHERE month = %s
              AND category = 'Variable & Direct Expense'
              AND particulars IN ({placeholders})""",
        (month, *particulars),
    )
    monofil_qty = _q1(
        conn,
        f"""SELECT SUM(qty) FROM consumption_output_{fy}
            WHERE material = 'Raw Material Consumption' AND month = %s""",
        (month,),
    )
    return cost / monofil_qty if monofil_qty else 0.0


def _yarn_conversion(conn, fy: str, month: str) -> float:
    """Yarn conversion cost per kg of RM consumed (PMC Stage2 Yarn)."""
    return _sum_particulars_per_kg(conn, fy, month, _YARN_PARTICULARS)


def _fabric_addon(conn, fy: str, month: str) -> float:
    """Common fabric add-on cost per kg of RM consumed (PMC Stage3, ex SKU fab)."""
    return _sum_particulars_per_kg(conn, fy, month, _FABRIC_ADDON_PARTICULARS)


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

        # ── PMC Rate Card, Stage 1 (V3 B24/B25/B26) ─────────────────────────
        rm_rate_base = _rm_price(conn, fy, month)
        rm_cost_per_kg = rm_rate_base * YIELD_KG_RM_PER_KG_FABRIC
        wastage_per_kg = rm_cost_per_kg * WASTAGE_ALLOWANCE
        rm = rm_cost_per_kg + wastage_per_kg          # Stage 1 total

        # Stage 2 (V3 B27) and Stage 3 common add-on (V3 B28), monthly actual
        yarn_conv = _yarn_conversion(conn, fy, month)
        fab_addon = _fabric_addon(conn, fy, month)
        fc = yarn_conv + fab_addon
        fabric_cost_per_kg = rm + fc

        # Sanity check: yarn_conv + fab_addon must equal the total this replaces
        # (all Variable & Direct Expense except Fabrication charges).
        old_total = _q1(
            conn,
            f"""SELECT SUM(value) FROM direct_expenses_output_{fy}
                WHERE month = %s AND category = 'Variable & Direct Expense'
                  AND particulars != 'Fabrication charges'""",
            (month,),
        )
        monofil_qty = _q1(
            conn,
            f"""SELECT SUM(qty) FROM consumption_output_{fy}
                WHERE material = 'Raw Material Consumption' AND month = %s""",
            (month,),
        )
        old_fc = old_total / monofil_qty if monofil_qty else 0.0
        if abs(old_fc - fc) > 0.01:
            print(f"  ⚠  [{month}] Stage2+Stage3 split ({fc:.4f}) does not match "
                  f"lump-sum total ({old_fc:.4f}) — check particulars naming")

        print(f"  [{month}] RM_BASE={rm_rate_base:.4f}  WASTAGE={wastage_per_kg:.4f}  "
              f"STAGE1_RM={rm:.4f}  YARN_CONV={yarn_conv:.4f}  "
              f"FABRIC_ADDON={fab_addon:.4f}  FILAMENT_CONV={fc:.4f}  FABRIC_COST={fabric_cost_per_kg:.4f}")

        # LEFT JOIN item_purchases if the table exists (optional purchase register)
        has_purchases = _table_exists(conn, f"item_purchases_{fy}")
        if has_purchases:
            purchase_join = f"LEFT JOIN item_purchases_{fy} ip ON ip.product_id = s.product_id AND ip.month = s.month"
            purchase_cols = "COALESCE(ip.qty, 0) AS purchase_qty, COALESCE(ip.purchase_rate_per_kg, 0) AS purchase_rate"
        else:
            purchase_join = ""
            purchase_cols = "0 AS purchase_qty, 0 AS purchase_rate"

        # SKU scope, matching PMC's SKU Master / Live Contribution exactly:
        # fabric SKUs are coded 101-999; codes >= 1000 are yarn (3xxx), master
        # batch (2xxx), waste (2313) and generic trading lines (1xxx), which PMC
        # keeps out of per-SKU contribution and handles as PAL adjustments.
        # A SKU with sales but no product_specification row is still included
        # (fabrication_per_kg falls back to 0), as PMC does for codes whose
        # Rate/Mt is blank.
        scope_filter = "AND s.product_id < 1000"

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

            # ── PMC SKU Master col G: Fab Rate ₹/Kg (derived) ───────────
            # V3 applies the flat increase only where the SKU has a non-zero
            # base fab rate: every one of its Rate/Mt = 0 rows carries G = 0,
            # not G = 2 (codes 596, 635, 706, 720). Matching that keeps us
            # identical to V3 on all 127 of its SKU rows.
            fab_rate_increase = FAB_RATE_INCREASE_PER_KG if fab_per_kg else 0.0
            fab_per_kg += fab_rate_increase

            # ── PMC SKU Master col H: Mfg Cost ₹/Kg (derived) ───────────
            # mts_per_kg == 0 means the SKU has no usable Wt/Mt, which V3
            # costs at zero rather than applying the common burden.
            mfg_cost_per_kg = (rm + fc + fab_per_kg) if mts_per_kg else 0.0

            # ── Marginal costing steps ──────────────────────────────────
            purchase_qty_used   = min(purchase_qty, qty)          # Step 3
            produced_qty        = max(qty - purchase_qty_used, 0.0)  # Step 4

            manufacturing_cost  = produced_qty * mfg_cost_per_kg   # Step 5a
            purchase_value_used = purchase_qty_used * purchase_rate       # Step 5b

            contrib_value  = rev - manufacturing_cost - purchase_value_used  # Step 6
            contrib_per_kg = contrib_value / qty if qty else 0.0
            sales_mtrs     = qty * mts_per_kg

            conn.execute(
                f"""INSERT INTO contribution_{fy}
                    (product_id, product_name, month, qty, revenue, selling_price_per_kg,
                     rm_price, rm_rate_base, wastage_per_kg,
                     yarn_conversion, fabric_addon, filament_conversion, fabric_cost,
                     fabrication_per_kg, fab_rate_increase, mfg_cost_per_kg, mts_per_kg,
                     contribution_per_kg, sales_mtrs, contribution_value,
                     produced_qty, purchase_qty_used, purchase_value_used, manufacturing_cost)
                VALUES (%s,%s,%s,%s,%s,%s, %s,%s,%s, %s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s, %s,%s,%s,%s)""",
                (pid, pname, month, qty, rev, sell_rate,
                 rm, rm_rate_base, wastage_per_kg,
                 yarn_conv, fab_addon, fc, fabric_cost_per_kg,
                 fab_per_kg, fab_rate_increase, mfg_cost_per_kg, mts_per_kg,
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
