"""
Diagnostic check: does SKU-level contribution roll up to PAL Nett Profit?

Mirrors the PMC file's "PAL Reconciliation" sheet:

    Total SKU Contribution (contribution_{fy})
  + Waste Income + Other Income          (mty_{fy})
  + Total Stock Difference (Monofil+Trading)  (mty_{fy})
  - Fixed Cost - Deprn                   (mty_{fy})
  = Engine Net Profit  (compare to mty_{fy} 'Nett Profit')

Known gap: unlike the PMC file, we don't have a cost basis for RM/Trading-Others
resale margin in the DB (mty only has gross Sales RM / Sales Trading Others
revenue, not the margin) — so this check omits that adjustment. In the PMC
June numbers that item was small (RM margin ~Rs160, Trading margin ~Rs1.9L),
so the residual reported here is expected to run a bit high versus PMC's own
final tie-out, not because the contribution formula is wrong.

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
    stock_diff = _q1(
        conn, f"SELECT value FROM mty_{fy} WHERE line_item = 'Total Stock Difference' AND month = %s", (month,)
    )
    fixed_cost = _q1(
        conn, f"SELECT value FROM mty_{fy} WHERE line_item = 'Fixed Cost' AND month = %s", (month,)
    )
    deprn = _q1(
        conn, f"SELECT value FROM mty_{fy} WHERE line_item = 'Deprn' AND month = %s", (month,)
    )
    nett_profit_target = _q1(
        conn, f"SELECT value FROM mty_{fy} WHERE line_item = 'Nett Profit' AND month = %s", (month,)
    )

    engine_net_profit = (
        total_contribution + waste_income + other_income + stock_diff - fixed_cost - deprn
    )
    gap = engine_net_profit - nett_profit_target

    return {
        "month": month,
        "total_contribution": total_contribution,
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
    print("  Note: RM/Trading-Others resale margin not included (no cost basis in DB) —")
    print("        expect a residual gap even when the formula is correct.")


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
