import calendar

MONTH_ORDER = [
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
    "Jan",
    "Feb",
    "Mar",
]
DAYS_IN_MONTH = {
    "Apr": 30,
    "May": 31,
    "Jun": 30,
    "Jul": 31,
    "Aug": 31,
    "Sep": 30,
    "Oct": 31,
    "Nov": 30,
    "Dec": 31,
    "Jan": 31,
    "Feb": 28,
    "Mar": 31,
}


def safe_float(val):
    if val is None or val == "" or val == " ":
        return 0.0
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0


def safe_divide(n, d):
    return n / d if d != 0 else 0.0


def _q(conn, sql, params=()):
    row = conn.execute(sql, params).fetchone()
    return safe_float(row[0]) if row else 0.0


def calculate_kpis(conn, fy_suffix):
    table_name = f"kpis_{fy_suffix}"
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            id INTEGER PRIMARY KEY,
            kpi_name TEXT NOT NULL,
            month TEXT NOT NULL,
            value REAL,
            UNIQUE(kpi_name, month)
        )
    """
    )
    conn.execute(f"DELETE FROM {table_name}")

    print(f"\n[KPI CALCULATION] Calculating for FY {fy_suffix}...")

    # Get distinct months in fiscal year order (PostgreSQL-compatible subquery)
    months = [
        row[0]
        for row in conn.execute(
            f"""
        SELECT month FROM (
            SELECT DISTINCT month,
                CASE month
                    WHEN 'Apr' THEN 1 WHEN 'May' THEN 2 WHEN 'Jun' THEN 3
                    WHEN 'Jul' THEN 4 WHEN 'Aug' THEN 5 WHEN 'Sep' THEN 6
                    WHEN 'Oct' THEN 7 WHEN 'Nov' THEN 8 WHEN 'Dec' THEN 9
                    WHEN 'Jan' THEN 10 WHEN 'Feb' THEN 11 WHEN 'Mar' THEN 12
                END AS sort_key
            FROM mty_{fy_suffix}
        ) t ORDER BY sort_key
    """
        ).fetchall()
    ]

    records = []

    for i, month in enumerate(months):
        print(f"  Processing {month}...")
        prev_month = months[i - 1] if i > 0 else None
        days = DAYS_IN_MONTH.get(month, 30)

        # ====== VALUES FROM MTY ======
        total_sales = _q(
            conn,
            f"SELECT value FROM mty_{fy_suffix} WHERE month=%s AND line_item='TOTAL SALES->'",
            (month,),
        )
        var_yarn = _q(
            conn,
            f"SELECT value FROM mty_{fy_suffix} WHERE month=%s AND line_item='Variable-Yarn Cost'",
            (month,),
        )
        gross_profit = _q(
            conn,
            f"SELECT value FROM mty_{fy_suffix} WHERE month=%s AND line_item='Gross Profit'",
            (month,),
        )
        ebitda = _q(
            conn,
            f"SELECT value FROM mty_{fy_suffix} WHERE month=%s AND line_item='EBITDA'",
            (month,),
        )
        net_profit = _q(
            conn,
            f"SELECT value FROM mty_{fy_suffix} WHERE month=%s AND line_item='Nett Profit'",
            (month,),
        )
        cogs_monofil = _q(
            conn,
            f"SELECT value FROM mty_{fy_suffix} WHERE month=%s AND line_item='COGS Monofil'",
            (month,),
        )
        cogs_misc = _q(
            conn,
            f"SELECT value FROM mty_{fy_suffix} WHERE month=%s AND line_item='COGS Misc Trading'",
            (month,),
        )

        # 1. Revenue Growth
        if month == "Apr":
            # One-time override for FY25-26 per MIS KPI sheet
            rev_growth = -10.5
        else:
            prev_total_sales = _q(
                conn,
                f"SELECT value FROM mty_{fy_suffix} WHERE month=%s AND line_item='TOTAL SALES->'",
                (prev_month,),
            )
            rev_growth = round(
                safe_divide((total_sales - prev_total_sales), prev_total_sales) * 100.0,
                2,
            )

        # 2. Gross Margin
        gross_margin = round(safe_divide(gross_profit, total_sales) * 100.0, 2)

        # 3. EBITDA Margin
        ebitda_margin = round(safe_divide(ebitda, total_sales) * 100.0, 2)

        # 4. Net Margin
        net_margin = round(safe_divide(net_profit, total_sales) * 100.0, 2)

        # ====== STOCK VALUATION ======
        stock_val_query = f"""
            SELECT SUM(value) FROM stock_valuation_{fy_suffix} 
            WHERE month=%s AND material NOT IN ('Seconds', 'Packing Materials', 'Work in Progress')
        """
        sv_curr = _q(conn, stock_val_query, (month,))

        if month == "Apr":
            sv_prev = _q(
                conn,
                f"""
                SELECT SUM(value) FROM stock_valuation_{fy_suffix} 
                WHERE month='Op Stock' AND material NOT IN ('Seconds', 'Packing Materials', 'Work in Progress')
            """,
            )
        else:
            sv_prev = _q(conn, stock_val_query, (prev_month,))

        cogs_total = cogs_monofil + cogs_misc
        avg_stock = (sv_curr + sv_prev) / 2

        # 6. DIO (Days Inventory Outstanding)
        dio = round(safe_divide(avg_stock, cogs_total) * days, 2)

        # ====== BALANCE SHEET ======
        sundry_debtors = _q(
            conn,
            f"SELECT SUM(value) FROM balance_sheet_{fy_suffix} WHERE month=%s AND line_item='Sundry Debtors'",
            (month,),
        )
        sundry_creditors = _q(
            conn,
            f"SELECT SUM(value) FROM balance_sheet_{fy_suffix} WHERE month=%s AND line_item='Sundry Creditors'",
            (month,),
        )

        current_assets = _q(
            conn,
            f"SELECT SUM(value) FROM balance_sheet_{fy_suffix} WHERE month=%s AND category='Current Assets'",
            (month,),
        )
        current_liab = _q(
            conn,
            f"SELECT SUM(value) FROM balance_sheet_{fy_suffix} WHERE month=%s AND category='Current Liabilities'",
            (month,),
        )

        closing_stock = _q(
            conn,
            f"SELECT SUM(value) FROM balance_sheet_{fy_suffix} WHERE month=%s AND line_item='Closing Stock'",
            (month,),
        )
        loans_advances_str = "Loans & Advances"
        loans_advances = _q(
            conn,
            f"SELECT SUM(value) FROM balance_sheet_{fy_suffix} WHERE month=%s AND line_item=%s",
            (month, loans_advances_str),
        )

        loans_liability = _q(
            conn,
            f"SELECT SUM(value) FROM balance_sheet_{fy_suffix} WHERE month=%s AND category='Loans (Liability)'",
            (month,),
        )
        capital_account = _q(
            conn,
            f"SELECT SUM(value) FROM balance_sheet_{fy_suffix} WHERE month=%s AND category='Capital Account'",
            (month,),
        )

        cash_in_hand = _q(
            conn,
            f"SELECT SUM(value) FROM balance_sheet_{fy_suffix} WHERE month=%s AND line_item='Cash-in-hand'",
            (month,),
        )
        bank_accounts = _q(
            conn,
            f"SELECT SUM(value) FROM balance_sheet_{fy_suffix} WHERE month=%s AND line_item='Bank Accounts'",
            (month,),
        )

        # ====== DIRECT EXPENSES OUTPUT ======
        working_cap_arr = [
            "Working Capital-Bank Charges",
            "Working Capital-LC",
            "Working Capital-OCC",
            "Finance Cost-Int On Term Loan",
            "Finance Cost-Int On Deposits",
        ]
        working_cap_query = f"SELECT SUM(value) FROM direct_expenses_output_{fy_suffix} WHERE month=%s AND particulars IN ({','.join('%s' for _ in working_cap_arr)})"
        finance_costs = _q(conn, working_cap_query, (month, *working_cap_arr))

        # 7. DSO (Days Sales Outstanding)
        dso = round(safe_divide(sundry_debtors, total_sales) * days, 2)

        # 8. DPO (Days Payable Outstanding)
        dpo = round(safe_divide(sundry_creditors, total_sales) * days, 2)

        # 5. CCC (Cash Conversion Cycle)
        ccc = round(dio + dso - dpo, 2)

        # 9. Current Ratio
        current_ratio = round(safe_divide(current_assets, current_liab), 2)

        # 10. Quick Ratio
        quick_ratio = round(
            safe_divide(
                (current_assets - closing_stock - loans_advances), current_liab
            ),
            2,
        )

        # 11. Debt Equity
        debt_equity = round(safe_divide(loans_liability, capital_account), 2)

        # 12. Debt Coverage
        debt_coverage = round(safe_divide(ebitda, (loans_liability + finance_costs)), 2)

        # 13. Interest Coverage (EBITDA/Interest)
        interest_coverage = round(safe_divide(ebitda, finance_costs), 2)

        # 14. EV (Enterprise Value)
        ev = round(capital_account + loans_liability - cash_in_hand - bank_accounts, 2)

        kpis = {
            "Revenue growth": rev_growth,
            "Gross margin": gross_margin,
            "EBITDA": ebitda_margin,
            "Net Margin": net_margin,
            "CCC (cash conversion cycle)": ccc,
            "DIO (Days Inventory Outstanding)": dio,
            "DSO (Days sales Outstanding)": dso,
            "DPO (Days Payable Outstanding)": dpo,
            "Current Ratio": current_ratio,
            "Quick Ratio": quick_ratio,
            "Debt Equity": debt_equity,
            "Debt Coverage": debt_coverage,
            "Interest Coverage": interest_coverage,
            "EV (Enterprise Value)": ev,
        }

        for k, v in kpis.items():
            records.append((k, month, v))

    conn.executemany(
        f"""
        INSERT INTO {table_name} (kpi_name, month, value) VALUES (%s, %s, %s)
    """,
        records,
    )
    conn.commit()
    print(f"  ✓ Inserted {len(records)} KPI records.")

    return len(records)


if __name__ == "__main__":
    from sheets.db import get_connection

    conn = get_connection()
    calculate_kpis(conn, "25_26")
    conn.close()
