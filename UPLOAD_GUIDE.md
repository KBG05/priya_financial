# PriyaFil Dashboard — Upload Guide

## Which file do I upload?

There are two types of source files. Choose based on what you have available:

| File type | When to use | Contains |
|-----------|-------------|----------|
| **MIS File** (`1. MIS May 26.xlsx`) | Preferred — use whenever available | All sheets: Purchases, Inventory Sales, Direct & Indirect Expns, Stock Valuation, Balance Sheet, MTY, KPIs |
| **Sales & Exp File** (`Sales_Pur_Exps-May.26.xlsx`) | Tally export only — when MIS is not ready yet | Purchases, Inventory Sales, Direct & Indirect Expns, Stock Valuation only |

---

## Section 1 — Core Financials

Select the toggle that matches your file:

- **MIS File** → upload the full MIS Excel (e.g. `1. MIS May 26.xlsx`)
- **Sales & Exp File** → upload the Tally export (e.g. `Sales_Pur_Exps-May.26.xlsx`)

---

## Section 2 — Balance Sheet

Balance Sheet data is required for the Balance Sheet view, MTY Finance rows, and all KPI calculations (Current Ratio, EV, Interest Coverage, etc.).

| Core file uploaded | Balance Sheet setting | What to upload |
|-------------------|-----------------------|----------------|
| MIS File | **Same as core** ✓ | Nothing extra — the MIS file already has the Balance Sheet tab |
| Sales & Exp File | **Separate file** | Upload `BS_PL_CF-May.26.xlsx` (Tally BS export) OR the MIS file |
| Sales & Exp File | Same as core | ⚠ Balance Sheet and KPIs will be **skipped** — Sales & Exp files don't contain a Balance Sheet |

> **Rule of thumb:** If you uploaded a MIS file → pick "Same as core". If you uploaded Sales & Exp → pick "Separate file" and upload the BS file or MIS separately.

---

## Section 3 — Salary File (optional)

- Upload `PFCO May 26 Salary.xls` if salary data has changed for the month.
- If omitted, existing salary records in the database are preserved unchanged.

---

## Section 4 — Item Sales / Contribution (optional)

- Upload the monthly item-level sales file for Contribution analysis.
- **Requires a specific month to be selected** in the Month Filter below — this file is always single-month.

---

## Month Filter & Replace Existing

### Month Filter

| Selection | Effect |
|-----------|--------|
| **All months** | The pipeline processes every month present in the uploaded file |
| **Specific month (e.g. May)** | Only that month's data is updated; all other months in the DB are untouched |

### Replace Existing

| Setting | Effect |
|---------|--------|
| **Unchecked (default)** | New month data is added; existing months already in the DB are preserved |
| **Checked** | Existing data for the selected month(s) is deleted and replaced with the file's data |

### Rules

- **If you select "All months" and the DB already has data** → you almost certainly want **Replace existing ✓** checked, otherwise the pipeline may error on duplicate month entries.
- **If you are uploading a new month for the first time** → Replace existing can stay unchecked.
- **If you are correcting a mistake in a specific month** → select that month + check Replace existing.

---

## Common Upload Scenarios

### Adding a new month (e.g. May is new, Apr already in DB)

1. Core: MIS File → upload `1. MIS May 26.xlsx`
2. Balance Sheet: Same as core
3. Month Filter: **May**
4. Replace existing: unchecked
5. Click Upload & Process

### Correcting/refreshing data for a month already uploaded

1. Core: MIS File → upload the corrected file
2. Balance Sheet: Same as core
3. Month Filter: select the month you want to fix (e.g. **Apr**)
4. Replace existing: **✓ checked**
5. Click Upload & Process

### Uploading all months from a complete annual MIS

1. Core: MIS File → upload the full-year MIS
2. Balance Sheet: Same as core
3. Month Filter: **All months**
4. Replace existing: **✓ checked** (required to avoid duplicate errors)
5. Click Upload & Process

### Uploading Sales & Exp file (no MIS yet)

1. Core: Sales & Exp File → upload `Sales_Pur_Exps-May.26.xlsx`
2. Balance Sheet: **Separate file** → upload `BS_PL_CF-May.26.xlsx` or the MIS file
3. Month Filter: specific month recommended
4. Replace existing: as needed

---

## Understanding Upload Errors

When a pipeline step fails, the dashboard shows:

- **Stage** — which step failed (e.g. "Step 10 — MTY calculation")
- **Error** — what went wrong
- **Suggestion** — what to fix

### Common errors and fixes

| Error message | Likely cause | Fix |
|---------------|-------------|-----|
| `could not convert string to float: '#DIV/0!'` | An Excel formula cell contains a division-by-zero error | Open the file, find the `#DIV/0!` cell in the sheet mentioned in the log, and fix or clear it |
| `Data for this month already exists` | Month is already in the DB | Enable **Replace existing** and re-upload |
| `A required Excel sheet was not found` | Wrong file type uploaded | Check you selected the right toggle (MIS vs Sales & Exp) |
| `Balance Sheet file not detected` | A Sales & Exp file was used where a Balance Sheet/MIS was expected | Change Balance Sheet to **Separate file** and upload the correct file |
| `password` | The Excel file is password-protected | Remove the password in Excel (File → Info → Protect Workbook) then re-upload |
| Step fails at **Step 1–5** (ingestion) | Missing or misnamed sheet in the uploaded file | Verify the correct file type is selected and the file hasn't been manually edited |
| Step fails at **Step 7–10** (calculation) | Data ingested but a formula couldn't run — usually a #DIV/0! or missing value | Check the pipeline log (expand "View full log") for the specific row/column mentioned |
| Step fails at **Step 11** (KPIs) | Balance Sheet data missing | Ensure a Balance Sheet source was uploaded; KPIs require balance sheet figures |

### Reading the pipeline log

Click **"View full log for details"** under any error to see the full pipeline output. Look for lines starting with `❌` — these show the exact error and the traceback tells you which file and line in the calculation caused it.

---

## File Naming Reference

| File | Typical name pattern |
|------|---------------------|
| MIS (all-in-one) | `1. MIS May 26.xlsx`, `8. MIS Nov 25.xlsx` |
| Sales & Expenses (Tally) | `Sales_Pur_Exps-May.26.xlsx` |
| Balance Sheet (Tally) | `BS_PL_CF-May.26.xlsx` |
| Salary | `PFCO May 26 Salary.xls` |
| Item Sales | monthly item sales Excel |
