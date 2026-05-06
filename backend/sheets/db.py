"""
Database utilities for MIS data.
Connects to PostgreSQL using psycopg2.
DSN is read from the DATABASE_URL environment variable (same as the backend),
falling back to the local development DSN.
"""

import os
import psycopg2
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

_DEFAULT_DSN = "postgresql://kbg:kbg@localhost:5432/priya_financial"
PG_DSN: str = os.getenv("DATABASE_URL", "").strip() or _DEFAULT_DSN

# Month name mapping
MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
MONTH_TO_NUM = {m: i+1 for i, m in enumerate(MONTHS)}


def get_fy_suffix(year: int, month: str) -> str:
    """
    Get fiscal year suffix from calendar year and month.
    FY runs Apr-Mar. E.g. Nov 2025 → '25_26', Feb 2026 → '25_26'.
    """
    month_num = MONTH_TO_NUM.get(month, 0)
    if 1 <= month_num <= 9:   # Apr–Dec
        fy_start = year % 100
    else:                      # Jan–Mar
        fy_start = (year - 1) % 100
    fy_end = (fy_start + 1) % 100
    return f"{fy_start:02d}_{fy_end:02d}"


# ── PostgreSQL connection wrapper ─────────────────────────────────────────────

class _Row(tuple):
    """Tuple that also supports column-name key access."""
    def __new__(cls, values, col_names=()):
        inst = super().__new__(cls, values)
        inst._names = col_names
        return inst

    def __getitem__(self, key):
        if isinstance(key, str):
            return super().__getitem__(self._names.index(key))
        return super().__getitem__(key)

    def keys(self):
        return self._names


class _PGCursor:
    """Wraps a psycopg2 cursor with a sqlite3-compatible interface."""

    def __init__(self, raw):
        self._cur = raw

    def execute(self, sql, params=()):
        self._cur.execute(sql, params if params else None)
        return self

    def executemany(self, sql, seq):
        self._cur.executemany(sql, seq)

    def _wrap(self, row):
        if row is None:
            return None
        cols = tuple(d[0] for d in self._cur.description) if self._cur.description else ()
        return _Row(row, cols)

    def fetchone(self):
        return self._wrap(self._cur.fetchone())

    def fetchall(self):
        return [self._wrap(r) for r in self._cur.fetchall()]

    def __iter__(self):
        for row in self._cur:
            yield self._wrap(row)

    @property
    def description(self):
        return self._cur.description


class PGConnection:
    """
    psycopg2 connection wrapper that adds conn.execute() and conn.cursor()
    returning _PGCursor, so all existing scripts work without modification.
    """

    def __init__(self, dsn: str = PG_DSN):
        self._conn = psycopg2.connect(dsn)
        self._conn.autocommit = False
        self.row_factory = None  # sqlite3 compat attribute

    def cursor(self) -> _PGCursor:
        return _PGCursor(self._conn.cursor())

    def execute(self, sql, params=()):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def executemany(self, sql, seq):
        cur = self.cursor()
        cur.executemany(sql, seq)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, *_):
        if exc_type:
            self.rollback()
        else:
            self.commit()
        self.close()


def get_connection(dsn: Optional[str] = None) -> PGConnection:
    """Get a PostgreSQL database connection."""
    return PGConnection(dsn or PG_DSN)


# ── Legacy helpers (kept for compatibility) ───────────────────────────────────

def create_purchases_table(conn: PGConnection, fy_suffix: str) -> None:
    """Ensure purchases table exists (no-op if already created in PG)."""
    table_name = f"purchases_{fy_suffix}"
    conn.execute(f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            id BIGSERIAL PRIMARY KEY,
            month TEXT NOT NULL,
            category TEXT NOT NULL,
            material TEXT NOT NULL,
            qty REAL, value REAL, rate REAL,
            discount REAL, discounted_value REAL
        )
    """)
    conn.commit()
    print(f"  ✓ Created table: {table_name}")


def clear_table(conn: PGConnection, table_name: str) -> None:
    conn.execute(f"DELETE FROM {table_name}")
    conn.commit()


def get_table_count(conn: PGConnection, table_name: str) -> int:
    row = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()
    return row[0] if row else 0
