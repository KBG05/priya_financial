"""
run_ingestion_pg.py
===================
Run all ingestion + calculation scripts against PostgreSQL (priya_financial).

Usage:
    uv run python run_ingestion_pg.py --sales-pur FILE [--mis FILE]
                                      [--fy FY_SUFFIX] [--months MONTHS] [--replace-existing]

Defaults:
    --fy      25_26
    --mis     (not set — Balance Sheet and KPIs are skipped when omitted)

File handling:
    --sales-pur   Path to the Sales_Pur_Exps Excel file (required).
                  When --months is given, a folder InputTallyTarka/{month}/ is
                  created and both --sales-pur and --mis files are moved there.

Month filtering:
    --months Apr,May,Jun   Only keep/update those months in the DB.
                           Non-selected months already in DB are preserved by default.
    --replace-existing     Drop *all* existing data before re-ingesting (no backup).

Note: Salary ingestion is skipped until salary sheet is provided.
"""

import sys
import shutil
import argparse
from pathlib import Path

# Support both: direct run and backend package import
try:
    from .sheets.db import get_connection
    from .sheets.run_full_pipeline import (
        _parse_months_arg,
        _backup_rows_outside_months,
        _restore_backup_rows,
        _prune_months,
    )
    from .sheets.ingest_purchases import ingest_purchases
    from .sheets.ingest_inventory_sales import ingest_inventory_sales
    from .sheets.ingest_direct_expenses import ingest_direct_expenses
    from .sheets.ingest_indirect_expenses import ingest_indirect_expenses
    from .sheets.ingest_stock_valuation import ingest_stock_valuation
    from .sheets.ingest_balance_sheet import ingest_balance_sheet
    from .sheets.calculate_pal_1 import calculate_pal_1
    from .sheets.calculate_consumption_output import calculate_consumption_output
    from .sheets.calculate_direct_expenses_output import calculate_direct_expenses_output
    from .sheets.calculate_mty import calculate_mty
    from .sheets.calculate_kpis import calculate_kpis
    try:
        from .sheets.ingest_item_sales import ingest_item_sales as _ingest_item_sales
    except ImportError:
        _ingest_item_sales = None
    try:
        from .sheets.calculate_contribution import calculate_contribution
    except ImportError:
        calculate_contribution = None
except ImportError:
    from sheets.db import get_connection
    from sheets.run_full_pipeline import (
        _parse_months_arg,
        _backup_rows_outside_months,
        _restore_backup_rows,
        _prune_months,
    )
    from sheets.ingest_purchases import ingest_purchases
    from sheets.ingest_inventory_sales import ingest_inventory_sales
    from sheets.ingest_direct_expenses import ingest_direct_expenses
    from sheets.ingest_indirect_expenses import ingest_indirect_expenses
    from sheets.ingest_stock_valuation import ingest_stock_valuation
    from sheets.ingest_balance_sheet import ingest_balance_sheet
    from sheets.calculate_pal_1 import calculate_pal_1
    from sheets.calculate_consumption_output import calculate_consumption_output
    from sheets.calculate_direct_expenses_output import calculate_direct_expenses_output
    from sheets.calculate_mty import calculate_mty
    from sheets.calculate_kpis import calculate_kpis
    try:
        from sheets.ingest_item_sales import ingest_item_sales as _ingest_item_sales
    except ImportError:
        _ingest_item_sales = None
    try:
        from sheets.calculate_contribution import calculate_contribution
    except ImportError:
        calculate_contribution = None


def _prepare_input_dir(
    sales_pur_file: Path,
    mis_file: Path | None,
    months: list[str] | None,
) -> tuple[Path, Path | None]:
    """Create month folder if needed, move files into it, return (new_sales_pur_file, new_mis_file)."""
    if not months:
        return sales_pur_file, mis_file

    folder_name = months[0].lower()
    target_dir = Path("InputTallyTarka") / folder_name
    target_dir.mkdir(parents=True, exist_ok=True)

    new_sales_pur = target_dir / sales_pur_file.name
    if sales_pur_file.resolve() != new_sales_pur.resolve():
        shutil.move(str(sales_pur_file), new_sales_pur)
        print(f"  Moved {sales_pur_file.name} → {target_dir}/")
    else:
        new_sales_pur = sales_pur_file

    new_mis = mis_file
    if mis_file:
        new_mis_path = target_dir / mis_file.name
        if mis_file.resolve() != new_mis_path.resolve():
            shutil.move(str(mis_file), new_mis_path)
            print(f"  Moved {mis_file.name} → {target_dir}/")
        new_mis = new_mis_path

    return new_sales_pur, new_mis


def run_pipeline(
    fy: str,
    sales_pur_file: Path,
    mis_file: Path | None = None,
    item_sales_file: Path | None = None,
    selected_months: list[str] | None = None,
    replace_existing: bool = False,
    balance_is_mis: bool | None = None,
):
    sales_pur_file, mis_file = _prepare_input_dir(sales_pur_file, mis_file, selected_months)
    if item_sales_file and not item_sales_file.is_absolute():
        item_sales_file = item_sales_file.resolve()

    print(f"\n{'='*64}")
    print(f"  PriyaFil PostgreSQL Ingestion Pipeline")
    print(f"  FY={fy}  File={sales_pur_file.name}  MIS={mis_file.name if mis_file else '(skipped)'}")
    if selected_months:
        print(f"  Month filter: {selected_months}")
    print(f"{'='*64}\n")

    conn = get_connection()

    BASE_TABLES = [
        f"purchases_{fy}",
        f"inventory_sales_{fy}",
        f"direct_expenses_{fy}",
        f"indirect_expenses_{fy}",
        f"stock_valuation_{fy}",
        f"balance_sheet_{fy}",
    ] if mis_file else [
        f"purchases_{fy}",
        f"inventory_sales_{fy}",
        f"direct_expenses_{fy}",
        f"indirect_expenses_{fy}",
        f"stock_valuation_{fy}",
    ]
    OUTPUT_TABLES = [
        f"pal_1_{fy}",
        f"consumption_output_{fy}",
        f"direct_expenses_output_{fy}",
        f"mty_{fy}",
        f"item_sales_{fy}",
        f"contribution_{fy}",
    ] + ([f"kpis_{fy}"] if mis_file else [])

    try:
        # ── Backup non-selected months before ingestion (unless --replace-existing) ──
        preserved = {}
        if selected_months and not replace_existing:
            print("[PREP] Preserving existing non-selected months...")
            for table in BASE_TABLES + OUTPUT_TABLES:
                preserved[table] = _backup_rows_outside_months(conn, table, selected_months)

        # ── 1. Purchases ───────────────────────────────────────────────────
        print("[STEP 1] Ingesting Purchases...")
        ingest_purchases(conn, sales_pur_file, fy)

        # ── 2. Inventory Sales ─────────────────────────────────────────────
        print("\n[STEP 2] Ingesting Inventory Sales...")
        ingest_inventory_sales(conn, sales_pur_file, fy)

        # ── 3. Direct Expenses ─────────────────────────────────────────────
        print("\n[STEP 3] Ingesting Direct Expenses...")
        ingest_direct_expenses(conn, sales_pur_file, fy)

        # ── 4. Indirect Expenses ───────────────────────────────────────────
        print("\n[STEP 4] Ingesting Indirect Expenses...")
        ingest_indirect_expenses(conn, sales_pur_file, fy)

        # ── 5. Stock Valuation ─────────────────────────────────────────────
        print("\n[STEP 5] Ingesting Stock Valuation...")
        ingest_stock_valuation(conn, sales_pur_file, fy)

        # ── 6. Balance Sheet ───────────────────────────────────────────────
        if mis_file:
            print("\n[STEP 6] Ingesting Balance Sheet...")
            ingest_balance_sheet(conn, mis_file, fy, is_mis=balance_is_mis)
        else:
            print("\n[STEP 6] Balance Sheet — skipped (no --mis provided)")

        # ── Apply month filter to base tables after ingestion ──────────────
        if selected_months:
            print(f"\n[STEP 6B] Applying month filter to ingested tables: {selected_months}")
            _prune_months(conn, fy, selected_months, include_outputs=False)
            if not replace_existing:
                print("[STEP 6C] Restoring preserved base months...")
                for table in BASE_TABLES:
                    _restore_backup_rows(conn, table, preserved.get(table))
                conn.commit()

        # ── 7. PAL 1 ──────────────────────────────────────────────────────
        print("\n[STEP 7] Calculating PAL 1...")
        calculate_pal_1(conn, fy)

        # ── 8. Consumption Output ──────────────────────────────────────────
        print("\n[STEP 8] Calculating Consumption Output...")
        calculate_consumption_output(conn, fy)

        # ── 9. Direct Expenses Output ──────────────────────────────────────
        print("\n[STEP 9] Calculating Direct Expenses Output...")
        calculate_direct_expenses_output(conn, fy, filepath=sales_pur_file)

        # ── 10. MTY ────────────────────────────────────────────────────────
        print("\n[STEP 10] Calculating MTY...")
        calculate_mty(conn, fy, filepath=sales_pur_file if sales_pur_file else mis_file)

        # ── 11. KPIs ───────────────────────────────────────────────────────
        if mis_file:
            print("\n[STEP 11] Calculating KPIs...")
            try:
                calculate_kpis(conn, fy)
            except Exception as e:
                print(f"  ⚠  KPIs skipped ({e})")
                import traceback; traceback.print_exc()
        else:
            print("\n[STEP 11] KPIs — skipped (no --mis provided)")

        # ── 11A. Item Sales Ingestion ──────────────────────────────────────
        if item_sales_file:
            if not selected_months:
                print("\n[STEP 11A] --item-sales provided but --months not specified; skipping item sales")
            elif _ingest_item_sales is None:
                print("\n[STEP 11A] Item Sales module not available; skipping")
            else:
                print(f"\n[STEP 11A] Ingesting Item Sales ({item_sales_file.name}) for month(s): {selected_months}...")
                for month in selected_months:
                    _ingest_item_sales(conn, item_sales_file, fy, month)
        else:
            print("\n[STEP 11A] Item Sales — skipped (no --item-sales provided)")

        # ── 11B. Contribution Calculation ──────────────────────────────────
        if item_sales_file:
            print("\n[STEP 11B] Calculating Contribution...")
            if calculate_contribution is not None:
                calculate_contribution(conn, fy, months=selected_months)
            else:
                print("  ⚠  Contribution module not available; skipping")
        else:
            print("\n[STEP 11B] Contribution — skipped (no --item-sales provided)")

        # ── Apply month filter to output tables after calculations ─────────
        if selected_months:
            print(f"\n[STEP 11B] Applying month filter to output tables: {selected_months}")
            _prune_months(conn, fy, selected_months, include_outputs=True)
            if not replace_existing:
                print("[STEP 11C] Restoring preserved output months...")
                for table in OUTPUT_TABLES:
                    _restore_backup_rows(conn, table, preserved.get(table))
                conn.commit()

        conn.commit()
        print(f"\n{'='*64}")
        print("  ✅  Pipeline complete — all data committed to PostgreSQL")
        print(f"{'='*64}\n")

    except Exception as exc:
        conn.rollback()
        print(f"\n❌  Pipeline FAILED: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run PriyaFil ingestion + calculation pipeline → PostgreSQL"
    )
    parser.add_argument("--fy", default="25_26",
                        help="Fiscal year suffix (default: 25_26)")
    parser.add_argument("--sales-pur", dest="sales_pur", required=True,
                        help="Path to Sales_Pur_Exps Excel file (required).")
    parser.add_argument("--mis",
                        default=None,
                        help="MIS Excel file with Balance Sheet. "
                             "If omitted, Balance Sheet ingestion and KPI calculation are skipped.")
    parser.add_argument("--months", default=None,
                        help="Comma-separated months to keep/update (e.g. Feb or Apr,May,Jun). "
                             "Non-selected months already in DB are preserved unless --replace-existing.")
    parser.add_argument("--replace-existing", action="store_true",
                        help="Replace all existing data (no backup of other months).")
    parser.add_argument("--item-sales", dest="item_sales", default=None,
                        help="Path to item-level monthly sales Excel file. "
                             "Requires --months to identify which month the file covers.")
    args = parser.parse_args()

    selected = _parse_months_arg(args.months) if args.months else None

    run_pipeline(
        fy=args.fy,
        sales_pur_file=Path(args.sales_pur),
        mis_file=Path(args.mis) if args.mis else None,
        item_sales_file=Path(args.item_sales) if args.item_sales else None,
        selected_months=selected,
        replace_existing=args.replace_existing,
    )
