"""
db.py — Database connection abstraction.
Dev:        DATABASE_URL not set → uses SQLite via stdlib sqlite3
Production: DATABASE_URL=postgresql://user:pass@host:5432/dbname → uses psycopg2

To migrate to Postgres:
  1. Set DATABASE_URL in .env
  2. pip install psycopg2-binary
  3. No other code changes needed.
"""

import os
import re
import sqlite3
from pathlib import Path
from typing import Any
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()


_NAMED_PARAM_RE = re.compile(r"(?<!:):([A-Za-z_][A-Za-z0-9_]*)")


def _get_conn():
    if DATABASE_URL.startswith("postgresql") or DATABASE_URL.startswith("postgres"):
        import psycopg2
        conn = psycopg2.connect(DATABASE_URL)
        return conn, "pg"
    else:
        db_path = Path(__file__).resolve().parent.parent.parent / "mis_data.db"
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        return conn, "sqlite"


def _to_pg_sql(sql: str) -> str:
    return _NAMED_PARAM_RE.sub(r"%(\1)s", sql)


def query(sql: str, params: dict[str, Any] | None = None) -> list[dict]:
    """
    Execute a parameterized SELECT.
    Params use :name style (auto-converted to %(name)s for psycopg2).
    """
    params = params or {}
    conn, driver = _get_conn()
    try:
        cur = conn.cursor()
        if driver == "pg":
            pg_sql = _to_pg_sql(sql)
            cur.execute(pg_sql, params or None)
            cols = [d[0] for d in cur.description] if cur.description else []
            return [dict(zip(cols, row)) for row in cur.fetchall()]
        else:
            cur.execute(sql, params)
            return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()
