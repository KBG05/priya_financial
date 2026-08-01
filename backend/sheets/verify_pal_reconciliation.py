"""
Diagnostic check: does SKU-level contribution roll up to PAL Nett Profit?

Mirrors the PMC file's "PAL Reconciliation" sheet:

    Total SKU Contribution (contribution_{fy})
  + RM Sale margin  ('From RM Sales' in mty_{fy})
  + Trading Others margin  ('From Misc Trading' in mty_{fy})
  + Waste Income + Other Income          (mty_{fy})
  + Total Stock Difference (Monofil+Trading)  (mty_{fy})
  - Fixed Cost - Deprn                   (mty_{fy})
  = Engine Net Profit  (compare to mty_{fy} 'Nett Profit')

Note: mty_{fy}'s 'From RM Sales' = Sales RM - RM Consumption Cost, and
'From Misc Trading' = Sales Trading Others - COGS Misc Trading — these are
exactly PMC's Step2/Step3 RM/Trading-Others margin lines, so they ARE
available in the DB (an earlier version of this docstring said otherwise —
that was wrong).

Even PMC's own PAL Reconciliation sheet needs a hardcoded monthly "residual
true-up" plug after these steps (Step 6) to hit an exact match — e.g. for
June (PMC's own SKU total) that plug was -Rs3.6L against a ~Rs13.3L net
profit (~27%). So some residual gap here is expected even with a fully
correct formula and clean data; the question is whether our residual is in
that same ballpark or much larger (which would point to a real data issue).

This is a read-only diagnostic — it does not write anything to the DB.
"""

from .db import get_connection


def _q1(conn, sql: str, params=()):
    rows = conn.execute(sql, params).fetchall()
    if not rows or rows[0][0] is None:
        return 0.0
    return float(rows[0][0])


def check_month(conn, fy: str, month: str) -> dict:
    total_contribution = _q1(
        conn, f"SELECT SUM(contribution_value) FROM contribution_{fy} WHERE month = %s", (month,)
    )
    waste_income = _q1(
        conn, f"SELECT value FROM mty_{fy} WHERE line_item = 'Waste Income' AND month = %s", (month,)
    )
    other_income = _q1(
        conn, f"SELECT value FROM mty_{fy} WHERE line_item = 'Other Income' AND month = %s", (month,)
    )
    rm_sale_margin = _q1(
        conn, f"SELECT value FROM mty_{fy} WHERE line_item = 'From RM Sales' AND month = %s", (month,)
    )
    trading_margin = _q1(
        conn, f"SELECT value FROM mty_{fy} WHERE line_item = 'From Misc Trading' AND month = %s", (month,)
    )
    stock_diff = _q1(
        conn, f"SELECT value FROM mty_{fy} WHERE line_item = 'Total Stock Difference' AND month = %s", (month,)
    )
    # PMC's "LESS: Annual Fixed Expenses" points at Jul26!E38, which is the
    # Fixed Expns Break-up total (Salaries + Admn + Selling + Deprn +
    # Interest USL) — NOT the 'Fixed Cost' line. Confirmed: use the month's
    # actual MIS value, not an annual average.
    fixed_cost = _q1(
        conn,
        f"""SELECT SUM(value) FROM mty_{fy}
            WHERE month = %s
              AND line_item IN ('Salaries','Admn','Selling','Deprnn','Interest USL')""",
        (month,),
    )
    deprn = 0.0  # already inside the E38 break-up above
    nett_profit_target = _q1(
        conn, f"SELECT value FROM mty_{fy} WHERE line_item = 'Nett Profit' AND month = %s", (month,)
    )

    # Stock Difference is ADDED, per the PMC file and confirmed by Sudhir:
    # a positive/negative stock difference just indicates whether closing
    # stock is higher or lower than opening, and is intended to be added.
    #
    # We briefly used SUBTRACT here, reasoning from mty's internal identity
    # (Total Consumption = PFCo + Stock Difference). That was wrong. The
    # decisive evidence is how the residual behaves across months:
    #     ADD : +59.4L, +44.4L, +39.1L  (stable, same sign)
    #     SUB : -8.0L, +104.7L, +0.2L   (erratic, sign flips)
    # A stable residual indicates a genuine unmodelled item (consistent with
    # Step 6's "Yarn Semi-Finished" label); an erratic one indicates a broken
    # model. June's near-zero SUB residual was coincidence, not validation.
    engine_net_profit = (
        total_contribution + rm_sale_margin + trading_margin
        + waste_income + other_income + stock_diff - fixed_cost - deprn
    )
    gap = engine_net_profit - nett_profit_target

    return {
        "month": month,
        "total_contribution": total_contribution,
        "rm_sale_margin": rm_sale_margin,
        "trading_margin": trading_margin,
        "waste_income": waste_income,
        "other_income": other_income,
        "stock_diff": stock_diff,
        "fixed_cost": fixed_cost,
        "deprn": deprn,
        "engine_net_profit": engine_net_profit,
        "nett_profit_target": nett_profit_target,
        "gap": gap,
        "gap_pct": (gap / nett_profit_target * 100) if nett_profit_target else None,
    }


def print_report(result: dict) -> None:
    m = result["month"]
    print(f"\n── PAL Reconciliation check — {m} ──")
    print(f"  Total SKU Contribution     {result['total_contribution']:>14,.0f}")
    print(f"  + RM Sale margin           {result['rm_sale_margin']:>14,.0f}")
    print(f"  + Trading Others margin    {result['trading_margin']:>14,.0f}")
    print(f"  + Waste Income             {result['waste_income']:>14,.0f}")
    print(f"  + Other Income             {result['other_income']:>14,.0f}")
    print(f"  + Total Stock Difference   {result['stock_diff']:>14,.0f}")
    print(f"  - Fixed Cost               {result['fixed_cost']:>14,.0f}")
    print(f"  - Deprn                    {result['deprn']:>14,.0f}")
    print(f"  {'─'*44}")
    print(f"  = Engine Net Profit        {result['engine_net_profit']:>14,.0f}")
    print(f"  PAL Nett Profit (target)   {result['nett_profit_target']:>14,.0f}")
    print(f"  Gap                        {result['gap']:>+14,.0f}", end="")
    if result["gap_pct"] is not None:
        print(f"   ({result['gap_pct']:+.1f}%)")
    else:
        print()
    print(f"  => residual true-up (Step 6) required: {-result['gap']:>+,.0f}")
    print("  Note: Step 6 is a pure balancing figure (confirmed: C9 = C16 when C9=0),")
    print("        so PMC always 'reconciles' by construction. The meaningful metric is")
    print("        how LARGE and how STABLE this residual is, not whether it ties out.")


if __name__ == "__main__":
    import sys

    fy = sys.argv[1] if len(sys.argv) > 1 else "25_26"
    months = sys.argv[2].split(",") if len(sys.argv) > 2 else ["Apr", "Jun"]

    conn = get_connection()
    try:
        for month in months:
            result = check_month(conn, fy, month)
            print_report(result)
    finally:
        conn.close()
