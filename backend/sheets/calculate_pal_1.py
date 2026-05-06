"""
Calculate PAL_1 output table from ingested data.

Populates pal_1_{fy_suffix} table with 22 line items per month.
"""

from pathlib import Path
from typing import Optional, Dict
from .db import MONTHS, get_connection


def safe_divide(numerator: Optional[float], denominator: Optional[float]) -> Optional[float]:
    """Safely divide two numbers, returning None if denominator is 0 or either is None."""
    if numerator is None or denominator is None or denominator == 0:
        return None
    return numerator / denominator


def get_previous_month(month: str) -> Optional[str]:
    """Get previous month name, or None if month is Apr."""
    if month == 'Apr':
        return None
    month_idx = MONTHS.index(month)
    return MONTHS[month_idx - 1]


def calculate_pal_1(conn, fy_suffix: str) -> int:
    """
    Calculate PAL_1 output for all months.
    
    Args:
        conn: Database connection
        fy_suffix: Fiscal year suffix (e.g., '25_26')
    
    Returns:
        Number of records inserted
    """
    table_name = f"pal_1_{fy_suffix}"
    purchases_table = f"purchases_{fy_suffix}"
    stock_table = f"stock_valuation_{fy_suffix}"
    sales_table = f"inventory_sales_{fy_suffix}"
    direct_exp_table = f"direct_expenses_{fy_suffix}"
    indirect_exp_table = f"indirect_expenses_{fy_suffix}"
    
    print(f"\n[PAL_1 CALCULATION] Calculating for FY {fy_suffix}...")
    
    # Clear existing data
    conn.execute(f"DELETE FROM {table_name}")
    
    records = []
    
    for month in MONTHS:
        print(f"  Processing {month}...")
        month_data = {}
        
        # ===== 1. Op Stock =====
        prev_month = get_previous_month(month)
        if prev_month:
            # Sum of all stock_valuation from previous month
            cursor = conn.execute(f"""
                SELECT SUM(qty) as qty, SUM(value) as value
                FROM {stock_table}
                WHERE month = %s
            """, (prev_month,))
        else:
            # For Apr, use "Op Stock" month
            cursor = conn.execute(f"""
                SELECT SUM(qty) as qty, SUM(value) as value
                FROM {stock_table}
                WHERE month = 'Op Stock'
            """)
        row = cursor.fetchone()
        op_stock_qty = row[0] if row[0] else 0
        op_stock_value = row[1] if row[1] else 0
        op_stock_rate = safe_divide(op_stock_value, op_stock_qty)
        month_data['Op Stk'] = (op_stock_qty, op_stock_value, op_stock_rate)
        
        # ===== 2. Purchase-RM =====
        # Use discounted_value which already has HDPE discount applied
        cursor = conn.execute(f"""
            SELECT SUM(qty) as qty, SUM(discounted_value) as value
            FROM {purchases_table}
            WHERE month = %s AND category = 'RAW_MATERIAL'
        """, (month,))
        row = cursor.fetchone()
        prm_qty = row[0] if row[0] else 0
        prm_value = row[1] if row[1] else 0
        prm_rate = safe_divide(prm_value, prm_qty)
        month_data['Purchase-RM'] = (prm_qty, prm_value, prm_rate)
        
        # ===== 3. Purchase-Trading =====
        cursor = conn.execute(f"""
            SELECT SUM(qty) as qty, SUM(value) as value
            FROM {purchases_table}
            WHERE month = %s AND category = 'TRADING'
        """, (month,))
        row = cursor.fetchone()
        pt_qty = row[0] if row[0] else 0
        pt_value = row[1] if row[1] else 0
        pt_rate = safe_divide(pt_value, pt_qty)
        month_data['Purchase-Trading'] = (pt_qty, pt_value, pt_rate)
        
        # ===== 4. Purchase Yarn =====
        cursor = conn.execute(f"""
            SELECT SUM(qty) as qty, SUM(value) as value
            FROM {purchases_table}
            WHERE month = %s AND material = 'Yarn'
        """, (month,))
        row = cursor.fetchone()
        py_qty = row[0] if row[0] else 0
        py_value = row[1] if row[1] else 0
        py_rate = safe_divide(py_value, py_qty)
        month_data['Purchase Yarn'] = (py_qty, py_value, py_rate)
        
        # ===== 5. Purchase-Fabric+ Cons =====
        cursor = conn.execute(f"""
            SELECT SUM(qty) as qty, SUM(value) as value
            FROM {purchases_table}
            WHERE month = %s AND material = 'Monofil Fabrication'
        """, (month,))
        row = cursor.fetchone()
        pfc_qty = row[0] if row[0] else 0
        pfc_value = row[1] if row[1] else 0
        pfc_rate = safe_divide(pfc_value, pfc_qty)
        month_data['Purchase-Fabric+ Cons'] = (pfc_qty, pfc_value, pfc_rate)
        
        # ===== 6. Cl Stk =====
        cursor = conn.execute(f"""
            SELECT SUM(qty) as qty, SUM(value) as value
            FROM {stock_table}
            WHERE month = %s
        """, (month,))
        row = cursor.fetchone()
        cl_qty = row[0] if row[0] else 0
        cl_value = row[1] if row[1] else 0
        cl_rate = safe_divide(cl_value, cl_qty)
        month_data['Cl Stk'] = (cl_qty, cl_value, cl_rate)
        
        # ===== 7. Sales =====
        # Qty: sum(qty) - qty of Waste (HDPE Monofilament Waste)
        cursor = conn.execute(f"""
            SELECT SUM(qty) as total_qty
            FROM {sales_table}
            WHERE month = %s AND category != 'RM_COST'
        """, (month,))
        row = cursor.fetchone()
        total_sales_qty = row[0] if row[0] else 0
        
        cursor = conn.execute(f"""
            SELECT qty FROM {sales_table}
            WHERE month = %s AND product = 'HDPE Monofilament Waste'
        """, (month,))
        row = cursor.fetchone()
        waste_qty = row[0] if row and row[0] else 0
        
        sales_qty = total_sales_qty - waste_qty
        
        # Value: sum(value) - value of (HDPE Monofilament Waste, Sale of Asset, Discount, Other Income)
        cursor = conn.execute(f"""
            SELECT SUM(value) as total_value
            FROM {sales_table}
            WHERE month = %s AND category != 'RM_COST'
        """, (month,))
        row = cursor.fetchone()
        total_sales_value = row[0] if row[0] else 0
        
        cursor = conn.execute(f"""
            SELECT SUM(value) as excluded_value
            FROM {sales_table}
            WHERE month = %s AND product IN ('HDPE Monofilament Waste', 'Sale of Asset', 'Discount', 'Other Income')
        """, (month,))
        row = cursor.fetchone()
        excluded_value = row[0] if row[0] else 0
        
        # Get Discount value separately to subtract it twice
        cursor = conn.execute(f"""
            SELECT value FROM {sales_table}
            WHERE month = %s AND product = 'Discount'
        """, (month,))
        row = cursor.fetchone()
        discount_value = row[0] if row and row[0] else 0
        
        # Subtract excluded values and subtract Discount one more time
        sales_value = total_sales_value - excluded_value - discount_value
        sales_rate = safe_divide(sales_value, sales_qty)
        month_data['Sales'] = (sales_qty, sales_value, sales_rate)
        
        # ===== 8. Consumption Cost =====
        # MIS Formula: Sales - (Op Stk + Purchases - Cl Stk)
        # Which equals: Sales - Op - Purchases + Cl
        consumption_qty = (sales_qty - op_stock_qty - prm_qty - pt_qty - py_qty - pfc_qty + cl_qty)
        consumption_value = (sales_value - op_stock_value - prm_value - pt_value - py_value - pfc_value + cl_value)
        consumption_rate = safe_divide(consumption_value, consumption_qty)
        # Note: This is calculated but not directly stored as a line item
        
        # ===== 9. Waste =====
        cursor = conn.execute(f"""
            SELECT qty, value
            FROM {sales_table}
            WHERE month = %s AND product = 'HDPE Monofilament Waste'
        """, (month,))
        row = cursor.fetchone()
        waste_qty = row[0] if row and row[0] else 0
        waste_value = row[1] if row and row[1] else 0
        waste_rate = safe_divide(waste_value, waste_qty)
        month_data['Waste'] = (waste_qty, waste_value, waste_rate)
        
        # ===== 10. Othr Inc =====
        cursor = conn.execute(f"""
            SELECT value
            FROM {sales_table}
            WHERE month = %s AND product = 'Other Income'
        """, (month,))
        row = cursor.fetchone()
        other_inc_value = row[0] if row and row[0] else 0
        month_data['Othr Inc'] = (None, other_inc_value, None)
        
        # ===== 11. Consumption Cost+Others =====
        # MIS Formula: (Sales - (Op+Purchases-Cl)) + Waste + Other Inc
        # Not stored as separate line item per user spec
        cons_others_qty = consumption_qty + waste_qty
        cons_others_value = consumption_value + waste_value + other_inc_value
        # Rate not needed per user
        
        # ===== 12. Direct Expns =====
        # Sum of ALL direct expenses, then subtract specific items:
        # - In House Fabrn (twice)
        # - Fabrication Charges (once) - this is also "Fabrn" which we don't ingest
        # - Depreciation (once)
        cursor = conn.execute(f"""
            SELECT SUM(value) as total_value
            FROM {direct_exp_table}
            WHERE month = %s
        """, (month,))
        row = cursor.fetchone()
        all_direct_expns = row[0] if row[0] else 0
        
        # Get In House Fabrn value (will be subtracted twice)
        cursor = conn.execute(f"""
            SELECT value
            FROM {direct_exp_table}
            WHERE month = %s AND expense_name = 'In House Fabrn'
        """, (month,))
        row = cursor.fetchone()
        in_house_value = row[0] if row and row[0] else 0
        
        # Get Fabrication charges (this is also "Fabrn" row which we don't ingest)
        cursor = conn.execute(f"""
            SELECT SUM(value) as total_value
            FROM {direct_exp_table}
            WHERE month = %s AND expense_name IN (
                'Fabrication Charges - B-Lore.',
                'Fabrication Charges-M/H & TN'
            )
        """, (month,))
        row = cursor.fetchone()
        fabrication_value = row[0] if row[0] else 0
        
        # Get Depreciation
        cursor = conn.execute(f"""
            SELECT value
            FROM {direct_exp_table}
            WHERE month = %s AND expense_name = 'Depreciation'
        """, (month,))
        row = cursor.fetchone()
        depreciation_value = row[0] if row and row[0] else 0
        
        # Calculate: Total - In House Fabrn (twice) - Fabrication (Fabrn) - Depreciation
        direct_expns_value = all_direct_expns - (in_house_value * 2) - fabrication_value - depreciation_value
        month_data['Direct Expns'] = (None, direct_expns_value, None)
        
        # ===== 13. In House Fabrn =====
        # (already retrieved above)
        month_data['In House Fabrn'] = (None, in_house_value, None)
        
        # ===== 14. Fabrication =====
        # (already retrieved above)
        month_data['Fabrication'] = (None, fabrication_value, None)
        
        # ===== 15. Direct Cost =====
        direct_cost_value = direct_expns_value + in_house_value + fabrication_value
        month_data['Direct Cost'] = (None, direct_cost_value, None)
        
        # ===== 16. Deprecition =====
        cursor = conn.execute(f"""
            SELECT value
            FROM {direct_exp_table}
            WHERE month = %s AND expense_name = 'Depreciation'
        """, (month,))
        row = cursor.fetchone()
        depreciation_value = row[0] if row and row[0] else 0
        month_data['Deprecition'] = (None, depreciation_value, None)
        
        # ===== 17. Indirect Expns =====
        cursor = conn.execute(f"""
            SELECT SUM(value) as total_value
            FROM {indirect_exp_table}
            WHERE month = %s
        """, (month,))
        row = cursor.fetchone()
        indirect_expns_value = row[0] if row[0] else 0
        month_data['Indirect Expns'] = (None, indirect_expns_value, None)
        
        # ===== 18. Total Expns =====
        total_expns_value = direct_cost_value + depreciation_value + indirect_expns_value
        month_data['Total Expns'] = (None, total_expns_value, None)
        
        # ===== 19. Profit (A) =====
        profit_a_value = cons_others_value - total_expns_value
        month_data['Profit (A)'] = (None, profit_a_value, None)
        
        # ===== 20. Fabrication Cost =====
        fabrication_cost_value = in_house_value + fabrication_value
        month_data['Fabrication Cost'] = (None, fabrication_cost_value, None)
        
        # ===== 21. Gross Profit =====
        gross_profit_value = cons_others_value - direct_cost_value - depreciation_value
        month_data['Gross Profit'] = (None, gross_profit_value, None)
        
        # ===== 22. Nett Profit =====
        nett_profit_value = gross_profit_value - indirect_expns_value
        month_data['NETT PROFIT'] = (None, nett_profit_value, None)
        
        # Add all records for this month
        for line_item, (qty, value, rate) in month_data.items():
            records.append({
                'month': month,
                'line_item': line_item,
                'qty': qty,
                'value': value,
                'rate': rate,
            })
    
    # Insert all records
    cursor = conn.cursor()
    for rec in records:
        cursor.execute(f"""
            INSERT INTO {table_name}
            (month, line_item, qty, value, rate)
            VALUES (%s, %s, %s, %s, %s)
        """, (rec['month'], rec['line_item'], rec['qty'], rec['value'], rec['rate']))
    
    conn.commit()
    
    total = len(records)
    print(f"  ✓ Inserted {total} PAL_1 records into {table_name}")
    
    # Summary by month
    cursor = conn.execute(f"""
        SELECT month, COUNT(*) as count
        FROM {table_name}
        GROUP BY month
        ORDER BY CASE month
            WHEN 'Apr' THEN 1 WHEN 'May' THEN 2 WHEN 'Jun' THEN 3
            WHEN 'Jul' THEN 4 WHEN 'Aug' THEN 5 WHEN 'Sep' THEN 6
            WHEN 'Oct' THEN 7 WHEN 'Nov' THEN 8 WHEN 'Dec' THEN 9
            WHEN 'Jan' THEN 10 WHEN 'Feb' THEN 11 WHEN 'Mar' THEN 12
        END
    """)
    for row in cursor:
        print(f"    {row[0]}: {row[1]} line items")
    
    return total


if __name__ == '__main__':
    # Test standalone
    conn = get_connection()
    count = calculate_pal_1(conn, '25_26')
    print(f"\nTotal records: {count}")
    
    # Show sample for Apr
    print("\nApr sample:")
    cursor = conn.execute("""
        SELECT line_item, qty, value, rate
        FROM pal_1_25_26
        WHERE month = 'Apr'
        ORDER BY ROWID
    """)
    for row in cursor:
        qty_str = f"{row[1]:12.2f}" if row[1] is not None else "None        "
        value_str = f"{row[2]:15.2f}" if row[2] is not None else "None           "
        rate_str = f"{row[3]:.4f}" if row[3] is not None else "None"
        print(f"  {row[0]:25s} qty={qty_str} value={value_str} rate={rate_str}")
    
    conn.close()
