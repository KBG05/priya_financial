"""
MIS Dashboard FastAPI Backend
DB driver: psycopg2 (Postgres) or sqlite3 (SQLite dev).
Set DATABASE_URL env var to switch. See db.py.
"""

import os
import re
from datetime import date
from pathlib import Path
from typing import Optional
from uuid import uuid4
from typing import List
from fastapi import FastAPI, Query, UploadFile, File, Form
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

try:
    # When imported as package: backend.main
    from .db import query
except ImportError:
    # When run from backend dir: uvicorn main:app
    from db import query

load_dotenv()

def _current_fy() -> str:
    """Indian fiscal year (Apr-Mar) suffix for today, e.g. '26_27'."""
    today = date.today()
    start_year = today.year if today.month >= 4 else today.year - 1
    return f"{start_year % 100}_{(start_year + 1) % 100}"


FY = os.getenv("FY_SUFFIX") or _current_fy()
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

app = FastAPI(title="MIS Dashboard API", version="1.0.0")

# Parse ALLOWED_ORIGINS from env, fallback to localhost for dev
origins_str = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000"
)
allowed_origins = [o.strip() for o in origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT_DIR = Path(__file__).resolve().parents[3]
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _months(months_param: str) -> tuple[List[str], dict]:
    m_list = [m.strip() for m in months_param.split(",")]
    params = {f"m{i}": m for i, m in enumerate(m_list)}
    placeholders = ", ".join(f":m{i}" for i in range(len(m_list)))
    return placeholders, params


def _table_exists(table_name: str) -> bool:
    row = query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=:t",
        {"t": table_name},
    )
    return bool(row)


def _column_exists(table_name: str, column_name: str) -> bool:
    row = query(
        "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=:t AND column_name=:c",
        {"t": table_name, "c": column_name},
    )
    return bool(row)


@app.get("/health")
def health():
    return {"status": "ok", "fy": FY}


@app.get("/fy")
def get_fy_list():
    """Return all available fiscal year suffixes based on existing pal_1_* tables."""
    rows = query(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name LIKE 'pal_1_%'"
    )
    fy_list = sorted({r["table_name"].replace("pal_1_", "") for r in rows})
    return {"fy_list": fy_list, "default": FY}


@app.get("/months")
def get_months(fy: str = Query(FY)):
    rows = query(f"SELECT DISTINCT month FROM pal_1_{fy}")
    available = [r["month"] for r in rows]
    ordered = [m for m in MONTH_ORDER if m in available]

    # Months are pre-seeded with placeholder (all-zero) rows before upload,
    # so "available" alone isn't a reliable default — find the latest month
    # that actually has non-zero uploaded data.
    data_rows = query(
        f"SELECT month, SUM(ABS(COALESCE(value, 0))) AS tot FROM pal_1_{fy} GROUP BY month"
    )
    months_with_data = {r["month"] for r in data_rows if (r["tot"] or 0) > 0}
    latest_with_data = next((m for m in reversed(ordered) if m in months_with_data), None)

    return {"months": ordered, "latest_with_data": latest_with_data}


@app.get("/pal1")
def get_pal1(months: str = Query(...), fy: str = Query(FY)):
    ph, params = _months(months)
    return {
        "data": query(
            f"SELECT month, line_item, qty, value, rate FROM pal_1_{fy} WHERE month IN ({ph})",
            params,
        )
    }


@app.get("/mty")
def get_mty(months: str = Query(...), fy: str = Query(FY)):
    ph, params = _months(months)
    return {
        "data": query(
            f"SELECT month, line_item, value, qty FROM mty_{fy} WHERE month IN ({ph})",
            params,
        )
    }


@app.get("/consumption")
def get_consumption(months: str = Query(...), fy: str = Query(FY)):
    ph, params = _months(months)
    return {
        "data": query(
            f"""SELECT month, material,
            opening_stock_qty, opening_stock_value,
            purchases_qty, purchases_value,
            sales_qty, sales_value,
            closing_stock_qty, closing_stock_value,
            qty, value, rate
        FROM consumption_output_{fy} WHERE month IN ({ph})""",
            params,
        )
    }


@app.get("/kpis")
def get_kpis(months: str = Query(...), fy: str = Query(FY)):
    table_name = f"kpis_{fy}"
    if not _table_exists(table_name):
        return {
            "data": [],
            "warning": "KPI data is not available for this year yet."
        }
    ph, params = _months(months)
    try:
        return {
            "data": query(
                f"SELECT month, kpi_name, value FROM {table_name} WHERE month IN ({ph})",
                params,
            )
        }
    except Exception:
        return {
            "data": [],
            "warning": "KPI data is not available for this year yet."
        }


@app.get("/kpis/aggregate")
def get_kpis_aggregate(months: str = Query(...), fy: str = Query(FY)):
    """Return the 4 profitability KPIs aggregated (summed) over the given months."""
    ph, params = _months(months)
    rows = query(
        f"""SELECT line_item, SUM(value) AS total
            FROM mty_{fy}
            WHERE month IN ({ph})
              AND line_item IN ('TOTAL SALES->', 'Gross Profit', 'EBITDA', 'Nett Profit')
            GROUP BY line_item""",
        params,
    )
    sums = {r["line_item"]: (r["total"] or 0) for r in rows}
    sales = sums.get("TOTAL SALES->", 0)

    def pct(x: float):
        return round(x / sales * 100, 2) if sales else None

    return {
        "data": {
            "Gross margin": pct(sums.get("Gross Profit", 0)),
            "EBITDA": pct(sums.get("EBITDA", 0)),
            "Net Margin": pct(sums.get("Nett Profit", 0)),
            "Revenue growth": None,
        }
    }


@app.get("/direct_expenses")
def get_direct_expenses(months: str = Query(...), fy: str = Query(FY)):
    ph, params = _months(months)
    return {
        "data": query(
            f"""SELECT month, category, particulars as line_item, value
        FROM direct_expenses_output_{fy} WHERE month IN ({ph})""",
            params,
        )
    }


@app.get("/contribution")
def get_contribution(months: str = Query(...), fy: str = Query(FY)):
    ph, params = _months(months)
    return {
        "data": query(
            f"""SELECT month, product_id, product_name,
                qty, revenue, selling_price_per_kg,
                rm_price, filament_conversion, fabric_cost, fabrication_per_kg, mts_per_kg,
                contribution_per_kg, sales_mtrs, contribution_value
            FROM contribution_{fy}
            WHERE month IN ({ph})
            ORDER BY contribution_per_kg DESC""",
            params,
        )
    }


# ─── Quote Builder ─────────────────────────────────────────────────────────

@app.get("/quote_builder/skus")
def get_quote_builder_skus(fy: str = Query(FY), in_stock_only: bool = Query(False)):
    """SKU code + name list for the Quote Builder's searchable dropdown."""
    if in_stock_only and _table_exists("current_stock"):
        sql = """SELECT ps.product_code AS code, MIN(ps.product_name) AS product_name
                  FROM product_specification ps
                  WHERE ps.product_code IS NOT NULL AND ps.product_code < 1000
                    AND EXISTS (
                        SELECT 1 FROM current_stock cs
                        WHERE cs.code = ps.product_code AND COALESCE(cs.bales, 0) > 0
                    )
                  GROUP BY ps.product_code
                  ORDER BY ps.product_code"""
    else:
        sql = """SELECT product_code AS code, MIN(product_name) AS product_name
                  FROM product_specification
                  WHERE product_code IS NOT NULL AND product_code < 1000
                  GROUP BY product_code
                  ORDER BY product_code"""
    return {"data": query(sql)}


def _contribution_fys(selected: str) -> list[str]:
    """Selected FY first, then earlier FYs newest-first — the costing fallback order."""
    rows = query(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name LIKE 'contribution_%'"
    )
    fys = sorted(
        {r["table_name"].removeprefix("contribution_") for r in rows
         if re.fullmatch(r"contribution_\d{2}_\d{2}", r["table_name"])},
        reverse=True,
    )
    return [f for f in fys if f == selected] + [f for f in fys if f < selected]


# PMC rules, mirrored from sheets/calculate_contribution.py.
_FAB_RATE_INCREASE_PER_KG = 2.0


def _table_columns(table: str) -> set[str]:
    return {
        r["column_name"] for r in query(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t",
            {"t": table},
        )
    }


def _month_key(m: str) -> int:
    return MONTH_ORDER.index(m) if m in MONTH_ORDER else -1


def _rate_card(fys: list[str]) -> Optional[dict]:
    """
    The latest month's PMC rate card: Stage 1 RM, Stage 2 yarn conversion and
    the Stage 3 fabric add-on. These are per-month figures shared by every SKU.

    A month counts only when its RM rate and conversion are non-zero: a month
    whose contribution was computed from item sales alone (core Tally file not
    uploaded yet) carries zeros, and quoting off it would understate cost.
    """
    for fy in fys:
        table = f"contribution_{fy}"
        cols = _table_columns(table)
        split = {"yarn_conversion", "fabric_addon"} <= cols
        rows = query(
            f"""SELECT month, MAX(rm_price) AS rm_price, MAX(filament_conversion) AS conversion
                    {", MAX(yarn_conversion) AS yarn_conversion, MAX(fabric_addon) AS fabric_addon" if split else ""}
                FROM {table}
                WHERE COALESCE(rm_price, 0) > 0 AND COALESCE(filament_conversion, 0) > 0
                GROUP BY month"""
        )
        if not rows:
            continue
        r = max(rows, key=lambda x: _month_key(x["month"]))
        return {
            "fy": fy,
            "month": r["month"],
            "rm_price": r["rm_price"],
            "conversion": r["conversion"],
            # Older FY tables store yarn conversion + fabric add-on as one figure.
            "yarn_conversion": r["yarn_conversion"] if split else r["conversion"],
            "fabric_addon": r["fabric_addon"] if split else None,
            "conversion_combined": not split,
        }
    return None


def _last_sale(code: int, fys: list[str]) -> Optional[dict]:
    """The SKU's most recent month with sales: realised SP and trading purchase rate."""
    for fy in fys:
        table = f"contribution_{fy}"
        cols = _table_columns(table)
        has_purchase = {"purchase_qty_used", "purchase_value_used"} <= cols
        rows = query(
            f"""SELECT month, selling_price_per_kg
                    {", purchase_qty_used, purchase_value_used" if has_purchase else ""}
                FROM {table}
                WHERE product_id = :code AND COALESCE(qty, 0) > 0""",
            {"code": code},
        )
        if rows:
            r = max(rows, key=lambda x: _month_key(x["month"]))
            pq, pv = r.get("purchase_qty_used"), r.get("purchase_value_used")
            return {
                "fy": fy,
                "month": r["month"],
                "selling_price_per_kg": r["selling_price_per_kg"],
                "purchase_rate_per_kg": (pv / pq) if pq else 0,
            }
    return None


@app.get("/quote_builder/sku/{code}")
def get_quote_builder_sku(code: int, fy: str = Query(FY)):
    """
    Auto-filled SKU data for Quote Builder, costed the way the PMC engine does:

        Mfg Cost ₹/kg = RM + Yarn conversion + Fabric add-on   (latest month's rate card)
                      + Fabricator cost                         (this SKU's product spec)

    so every SKU with a Wt/Mt gets a cost, whether or not it sold recently.
    Hist SP / purchase rate come from the SKU's latest month with sales.
    """
    if not re.fullmatch(r"\d{2}_\d{2}", fy):
        return {"data": None, "warning": f"Invalid FY {fy!r}."}

    spec = query(
        """SELECT product_code AS code, MIN(product_name) AS product_name,
               CASE WHEN AVG(weight) IS NULL OR AVG(weight) = 0 OR AVG(length) IS NULL OR AVG(length) = 0
                    THEN 0 ELSE AVG(length) / AVG(weight) END AS mts_per_kg,
               COALESCE(AVG(fabrication_charge_basic), 0) AS fab_charge_per_mt
           FROM product_specification
           WHERE product_code = :code
           GROUP BY product_code""",
        {"code": code},
    )
    if not spec:
        return {"data": None, "warning": f"SKU code {code} not found in product_specification."}
    row = spec[0]
    mts_per_kg = row["mts_per_kg"] or 0
    fab_charge_per_mt = row["fab_charge_per_mt"] or 0

    fys = _contribution_fys(fy)
    card = _rate_card(fys)
    sale = _last_sale(code, fys)

    # PMC SKU Master cols G/H: the flat increase applies only to a non-zero
    # base fab rate; a SKU without a Wt/Mt is costed at zero.
    fab_base = fab_charge_per_mt * mts_per_kg
    fab_increase = _FAB_RATE_INCREASE_PER_KG if fab_base else 0.0
    fabricator = fab_base + fab_increase
    costable = bool(card) and mts_per_kg > 0
    mfg = (card["rm_price"] + card["conversion"] + fabricator) if costable else 0

    fy_label = lambda f: "FY " + f.replace("_", "-")
    notes = []
    if not card:
        notes.append("No month with a complete costing has been uploaded yet.")
    elif mts_per_kg <= 0:
        notes.append("This SKU has no Wt/Mt in the product specification, so it can't be costed — enter a variable cost manually.")
    if not sale:
        notes.append(f"No sales on record for this SKU in {fy_label(fy)} or earlier, so there is no historical selling price.")

    return {
        "data": {
            "code": row["code"],
            "product_name": row["product_name"],
            "mts_per_kg": mts_per_kg,
            "has_cost_data": costable,
            "has_breakdown": costable,
            "fy": card["fy"] if card else None,
            "month": card["month"] if card else None,
            "mfg_cost_per_kg": mfg,
            "rm_price": card["rm_price"] if costable else None,
            "yarn_conversion": card["yarn_conversion"] if costable else None,
            "fabric_addon": card["fabric_addon"] if costable else None,
            "conversion_combined": bool(card and card["conversion_combined"]),
            "fabricator_cost": fabricator if costable else None,
            "fab_charge_per_mt": fab_charge_per_mt,
            "fab_rate_increase": fab_increase,
            "has_sales_history": bool(sale),
            "sales_fy": sale["fy"] if sale else None,
            "sales_month": sale["month"] if sale else None,
            "hist_avg_sp_per_kg": sale["selling_price_per_kg"] if sale else 0,
            "hist_purchase_rate_per_kg": sale["purchase_rate_per_kg"] if sale else 0,
        },
        "warning": " ".join(notes) or None,
    }


@app.get("/quote_builder/stock/{code}")
def get_quote_builder_stock(code: int):
    """Bales in stock for a SKU, grouped by location (from current_stock snapshot)."""
    if not _table_exists("current_stock"):
        return {"data": [], "warning": "No stock snapshot ingested yet."}
    return {
        "data": query(
            """SELECT location, SUM(bales) AS bales, SUM(qty_kgs) AS qty_kgs,
                    MAX(as_of_date) AS as_of_date
               FROM current_stock WHERE code = :code
               GROUP BY location""",
            {"code": code},
        )
    }


# ─── Upload & Process ─────────────────────────────────────────────────────────

import io
import traceback
from contextlib import redirect_stdout, redirect_stderr

try:
    from .pipeline import run_pipeline, _parse_months_arg
except ImportError:
    from pipeline import run_pipeline, _parse_months_arg


def _save_upload(file: UploadFile, prefix: str, content: bytes) -> Path:
    suffix = Path(file.filename or "upload.xlsx").suffix or ".xlsx"
    dest = UPLOAD_DIR / f"{uuid4().hex}_{prefix}{suffix}"
    dest.write_bytes(content)
    print(f"[UPLOAD] Saved {file.filename!r} → {dest.name}")
    return dest


@app.post("/upload-and-process")
async def upload_and_process(
    core_file: Optional[UploadFile] = File(None, description="Sales_Pur_Exps or MIS file (optional — omit to run contribution-only)"),
    balance_file: Optional[UploadFile] = File(None, description="MIS or BS_PL_CF for balance sheet/KPIs"),
    salary_file: Optional[UploadFile] = File(None, description="Salary Excel file (optional)"),
    item_sales_file: Optional[UploadFile] = File(None, description="Item-level sales file for contribution (optional)"),
    fy: str = Form(FY),
    months: str = Form(""),
    replace_existing: bool = Form(False),
    # Per-section overrides. Blank/absent falls back to the shared values above,
    # so older clients keep working unchanged.
    core_months: str = Form(""),
    core_replace: Optional[bool] = Form(None),
    item_months: str = Form(""),
    item_replace: Optional[bool] = Form(None),
):
    """
    Upload files and immediately run the full ingestion + calculation pipeline.
    All pipeline stdout is captured and returned in the response, and also
    printed to the server console for operator reference.
    """
    # ── Save uploaded files ──────────────────────────────────────────────
    core_path: Optional[Path] = None
    core_bytes: bytes | None = None
    if core_file and core_file.filename:
        core_bytes = await core_file.read()
        core_path = _save_upload(core_file, "core", core_bytes)

    bal_bytes: bytes | None = None
    balance_path: Optional[Path] = None
    if balance_file and balance_file.filename:
        bal_bytes = await balance_file.read()
        balance_path = _save_upload(balance_file, "balance", bal_bytes)

    has_item_sales = bool(item_sales_file and item_sales_file.filename)
    if not core_path and not balance_path and not has_item_sales:
        return {"ok": False, "error": "No files provided.", "logs": ""}

    # True = same file uploaded for core+balance (MIS); False = separate Tally BS file
    balance_is_mis: bool | None = None
    if balance_path is not None and core_bytes is not None and bal_bytes is not None:
        balance_is_mis = (core_bytes == bal_bytes)

    balance_warnings: list[str] = []
    if balance_path is not None:
        try:
            import openpyxl

            wb = openpyxl.load_workbook(balance_path, read_only=True, data_only=True)
            sheet_names = wb.sheetnames
            wb.close()

            has_mis = "Balance Sheet" in sheet_names
            has_bs = any(
                name.upper().startswith("BS") and "APR" not in name.upper()
                for name in sheet_names
            )
            if not (has_mis or has_bs):
                balance_warnings.append(
                    "Balance Sheet file not detected; skipping Balance Sheet and KPI steps."
                )
                balance_path = None
        except Exception:
            balance_warnings.append(
                "Balance Sheet file could not be read; skipping Balance Sheet and KPI steps."
            )
            balance_path = None

    item_sales_path: Optional[Path] = None
    if item_sales_file and item_sales_file.filename:
        is_bytes = await item_sales_file.read()
        item_sales_path = _save_upload(item_sales_file, "item_sales", is_bytes)

    # salary_file is accepted but the current pipeline skips it gracefully
    if salary_file and salary_file.filename:
        sal_bytes = await salary_file.read()
        _save_upload(salary_file, "salary", sal_bytes)

    # ── Parse months ─────────────────────────────────────────────────────
    def _months_or_none(raw: str):
        return _parse_months_arg(raw) if raw.strip() else None

    try:
        selected_months = _months_or_none(months)
        parsed_core_months = _months_or_none(core_months)
        parsed_item_months = _months_or_none(item_months)
    except ValueError as e:
        return {"ok": False, "error": str(e), "logs": ""}

    # ── Run pipeline (capture + echo logs) ───────────────────────────────
    log_buf = io.StringIO()
    print(f"\n{'='*64}")
    print(f"[PIPELINE] Starting — FY={fy}  "
          f"core={core_file.filename if core_file and core_file.filename else '(none)'}  "
          f"balance={balance_file.filename if balance_file and balance_file.filename else '—'}  "
          f"months={selected_months or 'all'}")
    print(f"{'='*64}")

    for warning in balance_warnings:
        log_buf.write(f"[WARN] {warning}\n")

    ok = False
    user_message = ""
    error_stage = ""
    error_detail = ""
    try:
        with redirect_stdout(log_buf), redirect_stderr(log_buf):
            run_pipeline(
                fy=fy,
                sales_pur_file=core_path,
                mis_file=balance_path,
                item_sales_file=item_sales_path,
                selected_months=selected_months,
                replace_existing=replace_existing,
                balance_is_mis=balance_is_mis,
                core_months=parsed_core_months,
                core_replace=core_replace,
                item_months=parsed_item_months,
                item_replace=item_replace,
            )
        ok = True
    except BaseException as exc:
        log_buf.write(traceback.format_exc())

    logs = log_buf.getvalue()

    if not ok:
        # Extract the pipeline stage that was running when the error occurred
        stage_map = {
            "[STEP 1]": "Step 1 — Purchases ingestion",
            "[STEP 2]": "Step 2 — Inventory Sales ingestion",
            "[STEP 3]": "Step 3 — Direct Expenses ingestion",
            "[STEP 4]": "Step 4 — Indirect Expenses ingestion",
            "[STEP 5]": "Step 5 — Stock Valuation ingestion",
            "[STEP 6]": "Step 6 — Balance Sheet ingestion",
            "[STEP 7]": "Step 7 — PAL 1 calculation",
            "[STEP 8]": "Step 8 — Consumption Output calculation",
            "[STEP 9]": "Step 9 — Direct Expenses Output calculation",
            "[STEP 10]": "Step 10 — MTY calculation",
            "[STEP 11]": "Step 11 — KPI calculation",
            "[STEP 11A]": "Step 11A — Item Sales ingestion",
            "[STEP 11B]": "Step 11B — Contribution calculation",
        }
        last_step = ""
        for line in logs.splitlines():
            for key, label in stage_map.items():
                if key in line:
                    last_step = label

        # Extract the root error line from the traceback
        raw_error = ""
        for line in logs.splitlines():
            stripped = line.strip()
            if stripped.startswith(("ValueError:", "KeyError:", "TypeError:",
                                    "AttributeError:", "IndexError:", "RuntimeError:",
                                    "psycopg2.", "OperationalError:", "❌")):
                raw_error = stripped
                break
        # Fallback: last non-empty line before traceback
        if not raw_error:
            for line in reversed(logs.splitlines()):
                stripped = line.strip()
                if stripped and not stripped.startswith(("File ", "Traceback", "During")):
                    raw_error = stripped
                    break

        error_stage = last_step or "Pipeline"
        error_detail = raw_error or "An unexpected error occurred."

        friendly_hints = {
            "#DIV/0!": "The Excel file contains a #DIV/0! error cell. Open the file and fix the formula in the flagged cell before re-uploading.",
            "could not convert string to float": "A cell that should contain a number contains text or an Excel error (e.g. #DIV/0!, #REF!). Check the highlighted sheet/row.",
            "no such table": "A required database table is missing. This usually means a prior pipeline step failed — check earlier steps in the log.",
            "column": "A database column mismatch. The uploaded file may have a different format or sheet layout than expected.",
            "sheet": "A required Excel sheet was not found in the uploaded file. Verify you uploaded the correct file type (MIS vs Sales & Exp).",
            "password": "The Excel file appears to be password-protected. Remove the password before uploading.",
            "openpyxl": "The uploaded file could not be opened. Ensure it is a valid .xlsx file and not corrupted.",
            "duplicate key": "Data for this month already exists. Enable 'Replace existing' to overwrite it.",
            "UniqueViolation": "Data for this month already exists. Enable 'Replace existing' to overwrite it.",
        }
        hint = ""
        combined = (error_detail + logs).lower()
        for keyword, msg in friendly_hints.items():
            if keyword.lower() in combined:
                hint = msg
                break

        user_message = f"Failed at: {error_stage}."
        if error_detail:
            user_message += f"\n\nError: {error_detail}"
        if hint:
            user_message += f"\n\nSuggestion: {hint}"

    # Echo full pipeline output to server console
    for line in logs.splitlines():
        print(f"  {line}")
    print(f"[PIPELINE] {'✅ done' if ok else '❌ failed'}")

    return {
        "ok": ok,
        "logs": logs,
        "user_message": user_message or None,
        "error_stage": error_stage or None,
        "error_detail": error_detail or None,
    }
