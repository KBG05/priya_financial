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
import sqlite3
from pathlib import Path
from typing import Any
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "")


def _get_conn():
    if DATABASE_URL.startswith("postgresql") or DATABASE_URL.startswith("postgres"):
        import psycopg2
        import psycopg2.extras
        conn = psycopg2.connect(DATABASE_URL)
        return conn, "pg"
    else:
        db_path = Path(__file__).resolve().parent.parent.parent / "mis_data.db"
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        return conn, "sqlite"


def query(sql: str, params: dict = {}) -> list[dict]:
    """
    Execute a parameterized SELECT.
    Params use :name style (auto-converted to %s for psycopg2).
    """
    conn, driver = _get_conn()
    try:
        cur = conn.cursor()
        if driver == "pg":
            import psycopg2.extras
            # Convert :name style to %(name)s for psycopg2
            pg_sql = sql
            # Sort keys by length descending to prevent :m1 from matching inside :m10
            for k in sorted(params.keys(), key=len, reverse=True):
                pg_sql = pg_sql.replace(f":{k}", f"%({k})s")
            cur.execute(pg_sql, params)
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
        else:
            cur.execute(sql, params)
            return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()
