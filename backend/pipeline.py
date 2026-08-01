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
                           Non-selected months already in DB are always preserved.
    --replace-existing     Allow overwriting the selected months. Without it, the
                           run is refused if those months already hold data.

Independence:
    Every file is optional and feeds only its own tables. Omitting a file skips
    its steps and leaves its data untouched — uploading a core file alone will
    not clear item sales, and uploading item sales alone will not touch MTY/PAL.
    Even with --replace-existing, only the uploaded datasets' selected months
    are replaced.

Note: Salary ingestion is skipped until salary sheet is provided.
"""

import sys
import shutil
import argparse
from pathlib import Path

# Support both: direct run and backend package import
try:
    from .sheets.db import get_connection, MONTHS
    from .sheets.run_full_pipeline import (
        _parse_months_arg,
        _backup_rows_outside_months,
        _restore_backup_rows,
        _prune_months,
        _count_rows_in_months,
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
        from .sheets.ingest_item_purchases import ingest_item_purchases as _ingest_item_purchases
    except ImportError:
        _ingest_item_purchases = None
    try:
        from .sheets.calculate_contribution import calculate_contribution
    except ImportError:
        calculate_contribution = None
except ImportError:
    from sheets.db import get_connection, MONTHS
    from sheets.run_full_pipeline import (
        _parse_months_arg,
        _backup_rows_outside_months,
        _restore_backup_rows,
        _prune_months,
        _count_rows_in_months,
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
        from sheets.ingest_item_purchases import ingest_item_purchases as _ingest_item_purchases
    except ImportError:
        _ingest_item_purchases = None
    try:
        from sheets.calculate_contribution import calculate_contribution
    except ImportError:
        calculate_contribution = None


def _prepare_input_dir(
    sales_pur_file: Path | None,
    mis_file: Path | None,
    months: list[str] | None,
) -> tuple[Path | None, Path | None]:
    """Create month folder if needed, move files into it, return (new_sales_pur_file, new_mis_file)."""
    if not months:
        return sales_pur_file, mis_file

    folder_name = months[0].lower()
    target_dir = Path("InputTallyTarka") / folder_name
    target_dir.mkdir(parents=True, exist_ok=True)

    new_sales_pur = sales_pur_file
    if sales_pur_file:
        new_path = target_dir / sales_pur_file.name
        if sales_pur_file.resolve() != new_path.resolve():
            shutil.move(str(sales_pur_file), new_path)
            print(f"  Moved {sales_pur_file.name} → {target_dir}/")
        new_sales_pur = new_path

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
    sales_pur_file: Path | None = None,
    mis_file: Path | None = None,
    item_sales_file: Path | None = None,
    selected_months: list[str] | None = None,
    replace_existing: bool = False,
    balance_is_mis: bool | None = None,
    core_months: list[str] | None = None,
    core_replace: bool | None = None,
    item_months: list[str] | None = None,
    item_replace: bool | None = None,
):
    # Each dataset group carries its own month selection and replace flag.
    # `selected_months` / `replace_existing` remain the defaults for any group
    # that does not override them, so existing callers behave unchanged.
    core_months = core_months if core_months is not None else selected_months
    item_months = item_months if item_months is not None else selected_months
    core_replace = replace_existing if core_replace is None else core_replace
    item_replace = replace_existing if item_replace is None else item_replace

    sales_pur_file, mis_file = _prepare_input_dir(sales_pur_file, mis_file, core_months)
    if item_sales_file and not item_sales_file.is_absolute():
        item_sales_file = item_sales_file.resolve()

    # Contribution has two feeding datasets, so it recomputes for the union of
    # whichever months those datasets were actually uploaded for.
    contrib_set: set[str] = set()
    if sales_pur_file and core_months:
        contrib_set |= set(core_months)
    if item_sales_file and item_months:
        contrib_set |= set(item_months)
    contribution_months = [m for m in MONTHS if m in contrib_set] or None
    recompute_contribution = bool(sales_pur_file or item_sales_file)

    print(f"\n{'='*64}")
    print(f"  PriyaFil PostgreSQL Ingestion Pipeline")
    print(f"  FY={fy}  File={sales_pur_file.name if sales_pur_file else '(contribution only)'}  MIS={mis_file.name if mis_file else '(skipped)'}")
    if sales_pur_file or mis_file:
        print(f"  Core/Balance months: {core_months or 'all'}   replace={core_replace}")
    if item_sales_file:
        print(f"  Item sales months:   {item_months or 'all'}   replace={item_replace}")
    if not sales_pur_file:
        print("  Mode: Contribution-only (Steps 1-10 skipped — no core file)")
    print(f"{'='*64}\n")

    conn = get_connection()

    # Each dataset is independent: a table is only touched when the file that
    # feeds it was actually uploaded, and only for that group's months. A table
    # listed here gets pruned to its own month list in STEP 6B/11C, so an
    # un-uploaded dataset must never appear — otherwise uploading one file
    # would rewrite another's data.
    table_months: dict[str, list[str]] = {}
    table_replace: dict[str, bool] = {}
    BASE_TABLES: list[str] = []
    OUTPUT_TABLES: list[str] = []

    def _scope(tables: list[str], months: list[str] | None, replace: bool, output: bool):
        if not months:
            return
        for t in tables:
            table_months[t] = months
            table_replace[t] = replace
            (OUTPUT_TABLES if output else BASE_TABLES).append(t)

    if sales_pur_file:
        _scope([f"purchases_{fy}", f"inventory_sales_{fy}", f"direct_expenses_{fy}",
                f"indirect_expenses_{fy}", f"stock_valuation_{fy}"],
               core_months, core_replace, output=False)
        _scope([f"pal_1_{fy}", f"consumption_output_{fy}",
                f"direct_expenses_output_{fy}", f"mty_{fy}"],
               core_months, core_replace, output=True)
    if mis_file:
        _scope([f"balance_sheet_{fy}"], core_months, core_replace, output=False)
        _scope([f"kpis_{fy}"], core_months, core_replace, output=True)
    if item_sales_file:
        _scope([f"item_sales_{fy}", f"item_purchases_{fy}"],
               item_months, item_replace, output=True)
    if recompute_contribution:
        _scope([f"contribution_{fy}"], contribution_months,
               (core_replace if sales_pur_file else False)
               or (item_replace if item_sales_file else False),
               output=True)

    # ── Guard: refuse to overwrite an already-populated month unless asked ──
    # Evaluated per table against that table's own months and replace flag, so
    # ticking replace for one group never licenses overwriting another. Raised
    # before the try block so it surfaces as a clean error rather than going
    # through the sys.exit(1) failure path.
    clashes = [
        f"{table} ({n} rows in {', '.join(table_months[table])})"
        for table in BASE_TABLES + OUTPUT_TABLES
        if not table_replace[table]
        and (n := _count_rows_in_months(conn, table, table_months[table]))
    ]
    if clashes:
        conn.close()
        raise RuntimeError(
            f"Data already exists in: {'; '.join(clashes)}. "
            "Enable 'Replace existing' for that section to overwrite. "
            "Only these tables and only these months would be replaced."
        )

    try:
        # ── Backup non-selected months before ingestion ────────────────────
        # Always preserve other months regardless of replace_existing.
        # replace_existing only means "allow overwriting the selected month",
        # not "destroy data for months we didn't upload".
        preserved = {}
        if table_months:
            print("[PREP] Preserving existing non-selected months...")
            for table in BASE_TABLES + OUTPUT_TABLES:
                preserved[table] = _backup_rows_outside_months(
                    conn, table, table_months[table]
                )

        if sales_pur_file:
            # ── 1. Purchases ───────────────────────────────────────────────
            print("[STEP 1] Ingesting Purchases...")
            ingest_purchases(conn, sales_pur_file, fy)

            # ── 2. Inventory Sales ─────────────────────────────────────────
            print("\n[STEP 2] Ingesting Inventory Sales...")
            ingest_inventory_sales(conn, sales_pur_file, fy)

            # ── 3. Direct Expenses ─────────────────────────────────────────
            print("\n[STEP 3] Ingesting Direct Expenses...")
            ingest_direct_expenses(conn, sales_pur_file, fy)

            # ── 4. Indirect Expenses ───────────────────────────────────────
            print("\n[STEP 4] Ingesting Indirect Expenses...")
            ingest_indirect_expenses(conn, sales_pur_file, fy)

            # ── 5. Stock Valuation ─────────────────────────────────────────
            print("\n[STEP 5] Ingesting Stock Valuation...")
            ingest_stock_valuation(conn, sales_pur_file, fy)
        else:
            print("[STEP 1-5] Skipped — no core file uploaded")

        # ── 6. Balance Sheet ───────────────────────────────────────────────
        if mis_file:
            print("\n[STEP 6] Ingesting Balance Sheet...")
            ingest_balance_sheet(conn, mis_file, fy, is_mis=balance_is_mis)
        else:
            print("\n[STEP 6] Balance Sheet — skipped (no balance file provided)")

        # ── Apply month filter to base tables after ingestion ──────────────
        if BASE_TABLES:
            print(f"\n[STEP 6B] Applying month filter to ingested tables")
            for table in BASE_TABLES:
                _prune_months(conn, fy, table_months[table], tables=[table])
            print("[STEP 6C] Restoring preserved base months...")
            for table in BASE_TABLES:
                _restore_backup_rows(conn, table, preserved.get(table))
            conn.commit()

        if sales_pur_file:
            # ── 7. PAL 1 ──────────────────────────────────────────────────
            print("\n[STEP 7] Calculating PAL 1...")
            calculate_pal_1(conn, fy)

            # ── 8. Consumption Output ──────────────────────────────────────
            print("\n[STEP 8] Calculating Consumption Output...")
            calculate_consumption_output(conn, fy)

            # ── 9. Direct Expenses Output ──────────────────────────────────
            print("\n[STEP 9] Calculating Direct Expenses Output...")
            calculate_direct_expenses_output(conn, fy, filepath=sales_pur_file)

            # ── 10. MTY ────────────────────────────────────────────────────
            print("\n[STEP 10] Calculating MTY...")
            calculate_mty(conn, fy, filepath=sales_pur_file)
        else:
            print("\n[STEP 7-10] Skipped — no core file uploaded")

        # ── 11. KPIs ───────────────────────────────────────────────────────
        if mis_file:
            print("\n[STEP 11] Calculating KPIs...")
            try:
                calculate_kpis(conn, fy)
            except Exception as e:
                print(f"  ⚠  KPIs skipped ({e})")
                import traceback; traceback.print_exc()
        else:
            print("\n[STEP 11] KPIs — skipped (no balance file provided)")

        # ── 11A. Item Sales + Purchases (only when their file is uploaded) ──
        # Guarded on item_sales_file: without it there is nothing to ingest,
        # and running anyway would clear the month's existing sales/purchases.
        if not item_sales_file:
            print("\n[STEP 11A] Item Sales/Purchases — skipped (no item sales file uploaded);"
                  " existing data preserved")
        elif not item_months:
            print("\n[STEP 11A] Item Sales — skipped (no months specified for this section)")
        else:
            if _ingest_item_sales is None:
                print("\n[STEP 11A] Item Sales module not available; skipping")
            else:
                print(f"\n[STEP 11A] Ingesting Item Sales from Excel ({item_sales_file.name}) "
                      f"for month(s): {item_months}...")
                for month in item_months:
                    _ingest_item_sales(conn, fy, month, filepath=item_sales_file)
            if _ingest_item_purchases is not None:
                print(f"\n[STEP 11A-P] Ingesting Purchases from {item_sales_file.name} for month(s): {item_months}...")
                for month in item_months:
                    _ingest_item_purchases(conn, item_sales_file, fy, month)

        # ── 11B. Contribution Calculation ──────────────────────────────────
        if not recompute_contribution:
            print("\n[STEP 11B] Contribution — skipped (neither core nor item sales file"
                  " uploaded); existing data preserved")
        elif not contribution_months:
            print("\n[STEP 11B] Contribution — skipped (no months specified)")
        elif calculate_contribution is None:
            print("\n[STEP 11B] Contribution module not available; skipping")
        else:
            print(f"\n[STEP 11B] Calculating Contribution for {contribution_months}...")
            calculate_contribution(conn, fy, months=contribution_months)

        # ── Apply month filter to output tables after calculations ─────────
        if OUTPUT_TABLES:
            print(f"\n[STEP 11C] Applying month filter to output tables")
            for table in OUTPUT_TABLES:
                _prune_months(conn, fy, table_months[table], tables=[table])
            print("[STEP 11D] Restoring preserved output months...")
            for table in OUTPUT_TABLES:
                _restore_backup_rows(conn, table, preserved.get(table))
            conn.commit()

        conn.commit()
        print(f"\n{'='*64}")
        print("  ✅  Pipeline complete — all data committed to PostgreSQL")
        print(f"{'='*64}\n")

    except Exception as exc:
        conn.rollback()
        import traceback
        tb = traceback.format_exc()
        print(f"\n❌  Pipeline FAILED: {type(exc).__name__}: {exc}")
        print(f"\n--- Traceback ---\n{tb}--- End Traceback ---\n")
        # Print a condensed cause chain for quick scanning in server logs
        cause = exc.__cause__ or exc.__context__
        if cause:
            print(f"  Caused by: {type(cause).__name__}: {cause}")
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
