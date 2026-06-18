"""
MIS Dashboard FastAPI Backend
DB driver: psycopg2 (Postgres) or sqlite3 (SQLite dev).
Set DATABASE_URL env var to switch. See db.py.
"""

import os
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

FY = os.getenv("FY_SUFFIX", "25_26")
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
    return {"months": [m for m in MONTH_ORDER if m in available]}


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
    selected_months = None
    if months.strip():
        try:
            selected_months = _parse_months_arg(months)
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
