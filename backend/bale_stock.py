"""
bale_stock.py
=============
In-memory parser for the Tally "Bales Stocks in Details" report
(stock_summary_report_*.xls) uploaded from the Quote Builder.

Nothing here touches the database or the filesystem: the upload is parsed from
bytes and the result is returned to the caller. The report is a point-in-time
view; uploading a newer one simply replaces what the browser is showing.

Report layout (one sheet, 'Bales Stock Details'):

    PRIYADARSHINI FILAMENTS PVT. LTD.
    Bales Stocks in Details. As on : 16/11/2026
    Location : Priyadarshini Filaments Private Limited-H.O.
    Sl No | Bale No | Item | Qty Kgs | Qty Mts
    1     | BA12-1088 | 40MESHHQ48"S WHITE | 57.52 | 400
    ...
          |           | Total | 15442.05 | 211913
    Location : Priyadarshini Filaments Private Limited UNIT-3
    Sl No | Bale No | Item | Qty Kgs | Qty Mts
    ...
    Mixed Bales Stocks in Details As on : 16/11/2026
    Location : ...-H.O.
    ...                                   (one bale no can repeat, once per item)

Columns are located by header name, so a re-ordered export still parses.
"""

from __future__ import annotations

import io
import re
from typing import Any, Iterable, Iterator, Optional

MAX_UPLOAD_BYTES = 15 * 1024 * 1024

_OLE2_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"   # legacy .xls (BIFF)
_ZIP_MAGIC = b"PK\x03\x04"                          # .xlsx / .xlsm

_AS_ON_RE = re.compile(r"as\s*on\s*:?\s*([0-9]{1,2}[/\-.][0-9]{1,2}[/\-.][0-9]{2,4})", re.I)
_LOCATION_RE = re.compile(r"^\s*location\s*:\s*(.+?)\s*$", re.I)
# "Priyadarshini Filaments Private Limited-H.O." -> "H.O."
_COMPANY_PREFIX_RE = re.compile(r"^.*?\b(?:limited|ltd)\b\.?[\s\-:]*", re.I)

# Normalised header text -> field name
_HEADERS = {
    "baleno": "bale_no",
    "item": "item",              # older layout: "Item"
    "itemcode": "item",          # newer layout: "Item Code" (same text, e.g. HF54"BLUE)
    "description": "description",
    "commoncode": "code",        # SKU / product code
    "category": "category",
    "qtykgs": "qty_kgs",
    "qtymts": "qty_mts",
}
_REQUIRED = {"bale_no", "qty_kgs"}   # plus an item or description column, checked below


class BaleStockError(ValueError):
    """The upload is not a readable Bale Stock report. Message is user-facing."""


def _norm(v: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(v).lower()) if v is not None else ""


def _text(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def _number(v: Any) -> Optional[float]:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(",", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _short_location(full: str) -> str:
    short = _COMPANY_PREFIX_RE.sub("", full).strip(" -:")
    return short or full


# ─── Readers: bytes -> sheets of row lists ─────────────────────────────────────

def _read_xls(content: bytes) -> Iterator[tuple[str, Iterable[list]]]:
    try:
        import xlrd
    except ImportError as exc:  # pragma: no cover - deployment issue
        raise BaleStockError(
            "The server can't read .xls files yet (python package 'xlrd' is not installed)."
        ) from exc
    try:
        # logfile swallows xlrd's harmless "OLE2 inconsistency" warnings on Tally exports.
        wb = xlrd.open_workbook(file_contents=content, logfile=io.StringIO(), on_demand=True)
    except Exception as exc:
        raise BaleStockError(f"The .xls file could not be opened ({exc}).") from exc
    try:
        for sh in wb.sheets():
            yield sh.name, ([sh.cell_value(r, c) for c in range(sh.ncols)] for r in range(sh.nrows))
    finally:
        wb.release_resources()


def _read_xlsx(content: bytes) -> Iterator[tuple[str, Iterable[list]]]:
    import openpyxl
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception as exc:
        raise BaleStockError(f"The .xlsx file could not be opened ({exc}).") from exc
    try:
        for ws in wb.worksheets:
            yield ws.title, (list(r) for r in ws.iter_rows(values_only=True))
    finally:
        wb.close()


def _sheets(content: bytes) -> Iterator[tuple[str, Iterable[list]]]:
    if content.startswith(_OLE2_MAGIC):
        return _read_xls(content)
    if content.startswith(_ZIP_MAGIC):
        return _read_xlsx(content)
    raise BaleStockError("This is not an Excel file. Upload the Bale Stock report as .xls or .xlsx.")


# ─── Parser ────────────────────────────────────────────────────────────────────

def _parse_sheet(rows: Iterable[list]) -> tuple[list[dict], list[dict], Optional[str], bool, list[dict]]:
    """Returns (bale rows, block totals from the report, as-on date, header seen,
    bale lines skipped because the report gives them no quantity)."""
    out: list[dict] = []
    skipped: list[dict] = []
    block_totals: list[dict] = []
    as_of: Optional[str] = None
    location = ""
    mixed = False
    cols: Optional[dict[str, int]] = None
    header_seen = False
    block_start = 0

    for raw in rows:
        cells = list(raw)
        texts = [_text(c) for c in cells]
        first = next((t for t in texts if t), "")
        if not first:
            continue

        # Section titles carry the as-on date; the Mixed section is flagged.
        if "stock" in first.lower() and "detail" in first.lower():
            m = _AS_ON_RE.search(first)
            if m and not as_of:
                as_of = m.group(1)
            mixed = "mixed" in first.lower()
            cols = None
            continue

        m = _LOCATION_RE.match(first)
        if m:
            location = m.group(1)
            cols = None
            continue

        normed = [_norm(c) for c in cells]
        if "baleno" in normed and ("qtykgs" in normed):
            cols = {_HEADERS[n]: i for i, n in enumerate(normed) if n in _HEADERS}
            if not _REQUIRED <= cols.keys() or not ({"item", "description"} & cols.keys()):
                cols = None
                continue
            header_seen = True
            block_start = len(out)
            continue

        if cols is None:
            continue

        def cell(field: str) -> Any:
            i = cols.get(field)
            return cells[i] if i is not None and i < len(cells) else None

        bale_no = _text(cell("bale_no"))
        description = _text(cell("description"))
        item = _text(cell("item")) or description
        kgs = _number(cell("qty_kgs"))
        mts = _number(cell("qty_mts"))
        code = _number(cell("code"))

        # The "Total" label sits in a different column depending on the layout.
        if not bale_no and any(t.lower() == "total" for t in texts):
            block_totals.append({
                "location": location,
                "mixed": mixed,
                "report_kgs": kgs or 0.0,
                "parsed_kgs": sum(r["qty_kgs"] for r in out[block_start:]),
                "rows": len(out) - block_start,
            })
            cols = None
            continue

        if not bale_no:
            continue
        if kgs is None:
            # Some exports list bales with only a category and no item or quantity.
            skipped.append({"bale_no": bale_no, "category": _text(cell("category")) or "Uncategorised"})
            continue

        out.append({
            "bale_no": bale_no,
            "item": item,
            "description": description,
            "code": int(code) if code is not None and code.is_integer() else None,
            "category": _text(cell("category")),
            "qty_kgs": kgs,
            "qty_mts": mts if mts is not None else 0.0,
            "location": _short_location(location) if location else "—",
            "location_full": location or "—",
            "mixed": mixed,
        })

    return out, block_totals, as_of, header_seen, skipped


def parse_bale_stock(content: bytes, filename: str = "") -> dict:
    """
    Parse a Bale Stock report from raw bytes.

    Raises BaleStockError with a user-facing message when the file is not a
    readable Bale Stock report.
    """
    if not content:
        raise BaleStockError("The uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise BaleStockError(f"File is too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB).")

    rows: list[dict] = []
    totals: list[dict] = []
    as_of: Optional[str] = None
    any_header = False
    sheet_names: list[str] = []
    skipped: list[dict] = []

    for name, sheet_rows in _sheets(content):
        sheet_names.append(name)
        r, t, a, h, s = _parse_sheet(sheet_rows)
        rows.extend(r)
        totals.extend(t)
        skipped.extend(s)
        as_of = as_of or a
        any_header = any_header or h

    if not any_header:
        raise BaleStockError(
            "This doesn't look like a Bale Stock report — no 'Bale No' / 'Qty Kgs' header row was found"
            + (f" (sheets: {', '.join(sheet_names)})." if sheet_names else ".")
        )
    if not rows:
        raise BaleStockError("The report has the expected columns but no bale rows.")

    warnings = [
        f"{t['location'] or 'Unknown location'}{' (mixed bales)' if t['mixed'] else ''}: "
        f"parsed {t['parsed_kgs']:,.2f} kg but the report total says {t['report_kgs']:,.2f} kg."
        for t in totals
        if abs(t["parsed_kgs"] - t["report_kgs"]) > 0.01
    ]
    if skipped:
        by_cat: dict[str, int] = {}
        for s in skipped:
            by_cat[s["category"]] = by_cat.get(s["category"], 0) + 1
        warnings.append(
            f"{len(skipped):,} line(s) across {len({s['bale_no'] for s in skipped}):,} bale(s) have no item or "
            f"quantity in the report and are not shown ("
            + ", ".join(f"{c}: {n:,}" for c, n in sorted(by_cat.items(), key=lambda kv: -kv[1]))
            + ")."
        )

    locations: dict[str, dict] = {}
    for r in rows:
        loc = locations.setdefault(r["location"], {
            "name": r["location"], "full_name": r["location_full"],
            "_bales": set(), "qty_kgs": 0.0, "qty_mts": 0.0, "lines": 0,
        })
        loc["_bales"].add(r["bale_no"])
        loc["qty_kgs"] += r["qty_kgs"]
        loc["qty_mts"] += r["qty_mts"]
        loc["lines"] += 1
    loc_list = []
    for loc in locations.values():
        loc["bales"] = len(loc.pop("_bales"))
        loc_list.append(loc)

    return {
        "file_name": filename,
        "as_of": as_of,
        "rows": [{k: v for k, v in r.items() if k != "location_full"} for r in rows],
        "locations": loc_list,
        "total_bales": len({(r["location"], r["bale_no"]) for r in rows}),
        "total_kgs": sum(r["qty_kgs"] for r in rows),
        "total_mts": sum(r["qty_mts"] for r in rows),
        "warnings": warnings,
    }
