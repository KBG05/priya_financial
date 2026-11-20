"""
Quote Builder costing — the live PMC rate card and per-SKU fabricator cost.

The rate card is computed on request from the month's own inputs
(consumption_output_{fy} and direct_expenses_output_{fy}) rather than read
back from contribution_{fy}. Contribution only stores a month's rate card when
that month has item sales, and only recomputes the months in each upload, so
its copy can be missing (a month with costs but no sales) or stale (inputs
re-uploaded since). Computing live keeps the Quote Builder on current figures.

Constants and expense lists are imported from the Contribution engine
(sheets/calculate_contribution.py), so both stay on one definition:

    RM          = rm_rate_base x YIELD x (1 + WASTAGE)
    Yarn        = SUM(yarn particulars)   / RM consumed qty
    Fabric OH   = SUM(fabric particulars) / RM consumed qty
    Fabricator  = Rate/Mt x Mts/Kg (+ flat increase when the base is non-zero)

RM base rate — Quote Builder rule (differs from the Consumption page by design):
    per material (HDPE, MB, CP), from consumption_output_{fy}:
        consumed qty   = opening + purchases - resold - closing        (unchanged)
        consumed value = opening + purchases - closing - resold_qty x average cost
        average cost   = (opening value + purchases value) / (opening qty + purchases qty)
    rm_rate_base = SUM(consumed value) / SUM(consumed qty)

The Consumption module (mirroring the MIS Excel) removes resold RM at the
'RM Purchase for sales' rate typed into the upload file (~₹96-100/kg against an
actual cost of ~₹140/kg), which leaves the difference inside consumption and
overstates the RM rate. Valuing resold RM at average cost removes that. The
consumed qty, and so the Yarn / Fabric OH denominators, are unchanged.
"""

import re
from typing import Optional

try:
    from .db import query
    from .sheets.db import MONTHS
    from .sheets.calculate_contribution import (
        FAB_RATE_INCREASE_PER_KG,
        WASTAGE_ALLOWANCE,
        YIELD_KG_RM_PER_KG_FABRIC,
        _FABRIC_ADDON_PARTICULARS,
        _YARN_PARTICULARS,
    )
except ImportError:
    from db import query
    from sheets.db import MONTHS
    from sheets.calculate_contribution import (
        FAB_RATE_INCREASE_PER_KG,
        WASTAGE_ALLOWANCE,
        YIELD_KG_RM_PER_KG_FABRIC,
        _FABRIC_ADDON_PARTICULARS,
        _YARN_PARTICULARS,
    )

RM_MATERIAL = "Raw Material Consumption"
# The materials that make up 'Raw Material Consumption' (calculate_consumption_output.py).
RM_COMPONENTS = ("HDPE", "MB", "CP")
VARIABLE_CATEGORY = "Variable & Direct Expense"

YARN_PARTICULARS = tuple(_YARN_PARTICULARS)
FABRIC_OH_PARTICULARS = tuple(_FABRIC_ADDON_PARTICULARS)
# Working-capital finance charges carried inside Fabric Overheads — derived
# from the engine's list so it can't drift from it.
FINANCE_PARTICULARS = tuple(p for p in FABRIC_OH_PARTICULARS if p.startswith("Working Capital-"))

_FY_RE = re.compile(r"\d{2}_\d{2}")


def _tables(prefix: str) -> set[str]:
    rows = query(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name LIKE :p",
        {"p": f"{prefix}%"},
    )
    fys = set()
    for r in rows:
        suffix = r["table_name"][len(prefix):]
        if _FY_RE.fullmatch(suffix):
            fys.add(suffix)
    return fys


def available_fys(selected: str) -> list[str]:
    """FYs that have both costing inputs: the selected FY first, then older FYs newest-first."""
    fys = sorted(_tables("consumption_output_") & _tables("direct_expenses_output_"), reverse=True)
    return [f for f in fys if f == selected] + [f for f in fys if f < selected]


def _component(particulars: tuple, amounts: dict, rm_qty: float) -> dict:
    items = [
        {
            "particular": p,
            "amount": amounts.get(p, 0.0),
            "per_kg": amounts.get(p, 0.0) / rm_qty if rm_qty else 0.0,
            "present": p in amounts,
        }
        for p in particulars
    ]
    total = sum(i["amount"] for i in items)
    return {"total": total, "per_kg": total / rm_qty if rm_qty else 0.0, "items": items}


def _rm_consumed(fy: str, month: str) -> tuple[float, float, float, list[dict]]:
    """
    RM consumed in the month, with resold RM valued at average cost.

    Returns (qty, value at average cost, value as on the Consumption page, resold
    detail per material). Qty is identical to the Consumption page's.
    """
    params = {"m": month}
    params.update({f"c{i}": c for i, c in enumerate(RM_COMPONENTS)})
    placeholders = ", ".join(f":c{i}" for i in range(len(RM_COMPONENTS)))
    rows = query(
        f"""SELECT material,
                   opening_stock_qty AS oq, opening_stock_value AS ov,
                   purchases_qty AS pq, purchases_value AS pv,
                   sales_qty AS sq, sales_value AS sv,
                   closing_stock_qty AS cq, closing_stock_value AS cv
            FROM consumption_output_{fy}
            WHERE month = :m AND material IN ({placeholders})""",
        params,
    )
    qty = value = page_value = 0.0
    resold: list[dict] = []
    for r in rows:
        oq, ov, pq, pv, sq, sv, cq, cv = (float(r[k] or 0) for k in ("oq", "ov", "pq", "pv", "sq", "sv", "cq", "cv"))
        avg_cost = (ov + pv) / (oq + pq) if (oq + pq) > 0 else 0.0
        # No stock to cost it from: fall back to the value the upload file gives.
        resold_at_cost = sq * avg_cost if avg_cost else sv
        qty += oq + pq - sq - cq
        value += ov + pv - cv - resold_at_cost
        page_value += ov + pv - cv - sv
        if sq:
            resold.append({
                "material": r["material"],
                "qty": sq,
                "avg_cost_per_kg": avg_cost,
                "value_at_cost": resold_at_cost,
                "value_in_file": sv,
            })
    return qty, value, page_value, resold


def rate_card(fy: str, month: str) -> dict:
    """
    The month's rate card (shared by every SKU), with the inputs behind each figure.

    status is 'complete' only when the month has RM consumption and variable
    direct expenses; any expected particular with no row is listed in
    missing_particulars (it counts as 0, exactly as the Contribution engine does).
    """
    if not _FY_RE.fullmatch(fy):
        raise ValueError(f"Invalid FY {fy!r}")

    rm_qty, rm_value, consumption_page_value, resold = _rm_consumed(fy, month)

    names = YARN_PARTICULARS + FABRIC_OH_PARTICULARS
    params = {"m": month, "cat": VARIABLE_CATEGORY}
    params.update({f"p{i}": n for i, n in enumerate(names)})
    placeholders = ", ".join(f":p{i}" for i in range(len(names)))
    rows = query(
        f"""SELECT particulars, SUM(value) AS amount
            FROM direct_expenses_output_{fy}
            WHERE month = :m AND category = :cat AND particulars IN ({placeholders})
            GROUP BY particulars""",
        params,
    )
    amounts = {r["particulars"]: float(r["amount"] or 0) for r in rows}

    if rm_qty <= 0 or rm_value <= 0:
        status = "missing_consumption"
    elif not amounts:
        status = "missing_expenses"
    else:
        status = "complete"

    rate_base = rm_value / rm_qty if rm_qty else 0.0
    rm_cost = rate_base * YIELD_KG_RM_PER_KG_FABRIC
    wastage_per_kg = rm_cost * WASTAGE_ALLOWANCE

    fabric = _component(FABRIC_OH_PARTICULARS, amounts, rm_qty)
    finance_total = sum(amounts.get(p, 0.0) for p in FINANCE_PARTICULARS)
    fabric["finance_total"] = finance_total
    fabric["finance_per_kg"] = finance_total / rm_qty if rm_qty else 0.0

    return {
        "fy": fy,
        "month": month,
        "status": status,
        "fy_fallback": False,
        "rm": {
            "qty": rm_qty,
            "value": rm_value,
            "rate_base": rate_base,
            "yield": YIELD_KG_RM_PER_KG_FABRIC,
            "wastage_pct": WASTAGE_ALLOWANCE,
            "wastage_per_kg": wastage_per_kg,
            # Yield + wastage on top of the base rate.
            "uplift_per_kg": rm_cost + wastage_per_kg - rate_base,
            "price": rm_cost + wastage_per_kg,
            # What the Consumption page shows (resold RM at the upload file's rate), for reference.
            "consumption_page_rate": consumption_page_value / rm_qty if rm_qty else 0.0,
            "resold": resold,
        },
        "yarn": _component(YARN_PARTICULARS, amounts, rm_qty),
        "fabric_overheads": fabric,
        "missing_particulars": [n for n in names if n not in amounts] if amounts else [],
    }


def _months_with_consumption(fy: str) -> list[str]:
    rows = query(
        f"""SELECT DISTINCT month FROM consumption_output_{fy}
            WHERE material = :mat AND COALESCE(qty, 0) > 0""",
        {"mat": RM_MATERIAL},
    )
    present = {r["month"] for r in rows}
    return [m for m in MONTHS if m in present]


def latest_rate_card(selected_fy: str) -> Optional[dict]:
    """Latest complete month's rate card: selected FY first, then older FYs."""
    for fy in available_fys(selected_fy):
        for month in reversed(_months_with_consumption(fy)):
            card = rate_card(fy, month)
            if card["status"] == "complete":
                card["fy_fallback"] = fy != selected_fy
                return card
    return None


def fabricator(rate_per_mt: Optional[float], has_rate: bool, mts_per_kg: float) -> dict:
    """
    Per-SKU fabricator cost ₹/kg (PMC SKU Master col G), with why it may be 0.

    status: ok | rate_zero (Rate/Mt is 0 in the spec) | rate_blank (no rate on
    file) | no_wtmt (no usable weight/length, so the SKU can't be costed).
    """
    rate = float(rate_per_mt) if rate_per_mt is not None else 0.0
    mts = float(mts_per_kg or 0)
    base = rate * mts
    increase = FAB_RATE_INCREASE_PER_KG if base else 0.0
    if mts <= 0:
        status = "no_wtmt"
    elif not has_rate:
        status = "rate_blank"
    elif rate == 0:
        status = "rate_zero"
    else:
        status = "ok"
    return {
        "status": status,
        "rate_per_mt": rate if has_rate else None,
        "mts_per_kg": mts,
        "base_per_kg": base,
        "increase_per_kg": increase,
        "per_kg": base + increase,
    }
