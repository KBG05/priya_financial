"""
MIS Dashboard FastAPI Backend
DB driver: psycopg2 (Postgres) or sqlite3 (SQLite dev).
Set DATABASE_URL env var to switch. See db.py.
"""
import os
from typing import List
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from db import query

load_dotenv()

FY = os.getenv("FY_SUFFIX", "25_26")
MONTH_ORDER = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"]

app = FastAPI(title="MIS Dashboard API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def _months(months_param: str) -> tuple[List[str], dict]:
    m_list = [m.strip() for m in months_param.split(",")]
    params = {f"m{i}": m for i, m in enumerate(m_list)}
    placeholders = ", ".join(f":m{i}" for i in range(len(m_list)))
    return placeholders, params


@app.get("/health")
def health():
    return {"status": "ok", "fy": FY}


@app.get("/months")
def get_months():
    rows = query(f"SELECT DISTINCT month FROM pal_1_{FY}")
    available = [r["month"] for r in rows]
    return {"months": [m for m in MONTH_ORDER if m in available]}


@app.get("/pal1")
def get_pal1(months: str = Query(...)):
    ph, params = _months(months)
    return {"data": query(
        f"SELECT month, line_item, qty, value, rate FROM pal_1_{FY} WHERE month IN ({ph})",
        params
    )}


@app.get("/mty")
def get_mty(months: str = Query(...)):
    ph, params = _months(months)
    return {"data": query(
        f"SELECT month, line_item, value FROM mty_{FY} WHERE month IN ({ph})",
        params
    )}


@app.get("/consumption")
def get_consumption(months: str = Query(...)):
    ph, params = _months(months)
    return {"data": query(
        f"""SELECT month, material,
            opening_stock_qty, opening_stock_value,
            purchases_qty, purchases_value,
            sales_qty, sales_value,
            closing_stock_qty, closing_stock_value,
            qty, value, rate
        FROM consumption_output_{FY} WHERE month IN ({ph})""",
        params
    )}


@app.get("/kpis")
def get_kpis(months: str = Query(...)):
    ph, params = _months(months)
    return {"data": query(
        f"SELECT month, kpi_name, value FROM kpis_{FY} WHERE month IN ({ph})",
        params
    )}


@app.get("/direct_expenses")
def get_direct_expenses(months: str = Query(...)):
    ph, params = _months(months)
    return {"data": query(
        f"""SELECT month, category, particulars as line_item, value
        FROM direct_expenses_output_{FY} WHERE month IN ({ph})""",
        params
    )}
