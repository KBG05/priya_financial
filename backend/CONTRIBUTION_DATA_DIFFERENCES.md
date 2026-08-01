# Contribution — production figures and data differences vs PMC V3

> **Updated 2026-08-01** — now running on **`Ratio Masterv2.xlsx`** (sheet
> `UPDATED`), the verified master. See §8 for what changed. Figures below are
> post-v2.

FY **26_27**. Production uses **`Ratio Masterv2.xlsx` fabrication rates** and
**each month's actual ledger rates** (RM / yarn conversion / fabric add-on
derived from `consumption_output_26_27` and `direct_expenses_output_26_27`),
per the clarification that the Rate Card should carry monthly actuals rather
than static values.

Reference file for comparison: `4.PMC_Jul 26_V3.xlsx` (a **June** file — there
is no April or May equivalent, so V3 comparisons apply to June only).

---

## 1. Contribution

| | Apr | May | Jun |
|---|---:|---:|---:|
| SKUs | 104 | 110 | 119 |
| Qty (kg) | 89,940 | 1,08,161 | 92,142 |
| Revenue | 2,62,63,188 | 3,11,83,430 | 2,80,60,868 |
| **Contribution** | **₹39,62,428** | **₹20,40,425** | **₹20,03,274** |
| Contribution / kg | 44.1 | 18.9 | 21.7 |
| *(prior, old master)* | *40,83,381* | *21,89,816* | *21,02,510* |

## 2. PAL Reconciliation

| Step | Apr | May | Jun |
|---|---:|---:|---:|
| 1 Total SKU Contribution | 39,62,428 | 20,40,425 | 20,03,274 |
| 2 + RM Sale margin | 0 | 125 | 22,600 |
| 3 + Trading Others margin | 1,72,406 | 1,05,476 | 1,90,702 |
| 4 + Waste + Other Income | 21,805 | 74,600 | 40,820 |
| 5 + Total Stock Difference | −33,74,119 | +30,18,290 | −19,41,351 |
| − Fixed Expenses (MIS E38) | 25,86,554 | 24,52,033 | 32,27,776 |
| **= Engine Net Profit** | **−18,04,033** | **27,86,882** | **−29,11,731** |
| PAL target (`mty` Nett Profit) | 46,10,204 | 76,09,172 | 13,27,386 |
| **6 Residual true-up required** | **64,14,238** | **48,22,289** | **42,39,117** |

Fixed Expenses = PMC's `Jul26!E38`, i.e. the Fixed Expns Break-up total
(Salaries + Admn + Selling + Deprn + Interest USL) — not the `Fixed Cost` line.

---

## 3. Product specification differences — old Ratio Master vs V3 SKU Master

> **Superseded by §8.** This section records the state at the time of the V3
> review. `Ratio Masterv2.xlsx` is now the verified master and settles most of
> it — see §8 for the disposition of each code below.

**87 of ~119 sold SKUs disagree on fabrication ₹/kg.** Three distinct causes.

### A. V3 Rate/Mt is blank — V3 charges zero fabrication

| Code | Product | Our Rate/Mt | V3 Rate/Mt | Our fab/kg | V3 fab/kg |
|---:|---|---:|---:|---:|---:|
| 401 | 12 Mesh HQ 42" | 5.75 | **0** | 38.65 | **0.00** |
| 706 | 60 Mesh HMQ 42" | 4.87 | **0** | 48.00 | **0.00** |

V3's own Ratio Master row for 401 is blank (`None`), and for 706 it holds
Rate/Mt = 12 on one of its two rows — but V3's SKU Master flattened both to 0.
That is an inconsistency **inside V3**, not between the files.

### B. Wt/Mt materially different (not rounding)

| Code | Product | Our Wt/Mt | V3 Wt/Mt | Our fab/kg | V3 fab/kg | Factor |
|---:|---|---:|---:|---:|---:|---:|
| **518** | 24MESHLQ120"PF BLUE | 0.151949 | **0.026667** | 78.97 | **450.00** | 5.7x |
| **541** | 24MESHLQ42"D.BLUE | 0.051900 | **0.130000** | 88.63 | 35.38 | 2.5x |
| **249** | SF104"GREEN | 0.091281 | **0.190000** | 104.07 | 50.00 | 2.1x |
| **250** | SF110"BLUE | 0.106006 | **0.200000** | 94.33 | 50.00 | 1.9x |
| **124** | GOUTAM-GOLD120"WHITE | 0.217938 | 0.176000 | 55.06 | 64.77 | 1.24x |
| **251** | SF120"BLUE | 0.114570 | 0.100000 | **0.00** | 100.00 | — |

**Code 518 sanity check:** the 42" variant (code 540) is 0.050277 kg/m, so a
120" fabric should be roughly 0.144 kg/m. V3's 0.026667 would make it lighter
per metre than the 19" variant (0.023333) — physically impossible. At that
value V3 charges ₹450/kg fabrication on a product selling at ₹271/kg.

**Code 251 runs the other way:** our Ratio Master has Rate/Mt = 0 so we charge
zero fabrication, while V3 charges ₹100/kg. This one favours V3's data and
should be checked alongside 401 and 706.

### C. Rounding — V3 SKU Master holds Wt/Mt at 2–3 decimal places

~79 codes. Example: code 258 — ours 0.050812 vs V3 0.05, giving ₹112.18 vs
₹114.00 per kg. Individually ₹1–10/kg, but this is the systematic driver
across the majority of SKUs.

---

## 4. Other data differences (June)

| Item | Ours | V3 | Note |
|---|---:|---:|---|
| Purchase qty | 13,028.8 kg | 13,028.8 kg | ✅ exact match |
| Total Stock Difference | −19,41,351 | −19,41,349 | ✅ rounding only |
| Code 706 SKU split | 1 row (992.2 kg) | 2 rows (HMQ 235.9 + HQ 756.3) | Changes purchased/produced split → ₹10,907 |
| Salaries | 19,23,421 | 18,32,006 | +91,415 — **classification swap**; our Total Variable is lower by exactly the same amount, so net profit differs by only ₹62 |
| Interest USL | 6,83,653 | 6,75,789 | +7,864 |
| Sales RM | 22,600 | 160 | Unresolved — different extraction or cut-off |

---

## 5. Validation against V3

Applying **V3's own rates** (its SKU Master Mfg Cost ₹/kg, which embeds its
static Rate Card) to **our** sales and purchase data reproduces V3 almost
exactly for June:

| | June contribution |
|---|---:|
| V3 Live Contribution | ₹14,24,466 |
| Our data @ V3 rates | ₹14,13,559 |
| Difference | **−₹10,907** |

**Only one SKU differs — code 706** (the split issue above). Every other SKU
matches exactly. This confirms the engine and formula are correct; all
remaining variance is source-data differences in the specification files.

Note this validation is meaningful for **June only**. V3's Rate Card assumes
RM = ₹151.17/kg, whereas actual ledger RM was ₹107.37 (Apr) and ₹127.59 (May)
— so applying V3's static card to those months would overstate cost by up to
₹44/kg.

---

## 6. Scope rule

Per-SKU contribution covers **product codes < 1000**, matching PMC's SKU
Master. Codes ≥ 1000 are yarn (3xxx), master batch (2xxx), waste (2313) and
generic trading lines (1xxx); PMC keeps these out of per-SKU contribution and
handles them as PAL adjustments (Steps 2–4). Verified: all 119 sold codes
below 1000 appear in V3, and no V3 code is ≥ 1000.

A SKU with sales but no `product_specification` row is still included, with
fabrication falling back to 0 — the same treatment PMC gives codes whose
Rate/Mt is blank.

## 7. Changes applied

- `sheets/calculate_contribution.py` — scope filter changed to `product_id < 1000`
  (previously required a spec or purchase match, which silently dropped sold SKUs).
- `sheets/verify_pal_reconciliation.py` — Stock Difference **added** (not
  subtracted); Fixed Expenses now uses the E38 break-up total.
- `add_missing_spec_from_ratio_master.py` — inserted 6 codes present in
  `Ratio Master.xlsx` but missing from `product_specification`: **292, 293,
  294, 728, 1106, 1113**. Codes 294 (₹77.27/kg) and 728 (₹67.50/kg) were sold
  in June and had been defaulting to zero fabrication cost.

---

## 8. Ratio Master v2 (verified master) — applied 2026-08-01

Source: `Ratio Masterv2.xlsx`, sheet `UPDATED` (547 rows, 516 codes).
Applied by `update_spec_from_ratio_master_v2.py`.

### What changed

**Fabrication rates only — no geometry changed.** Validated before writing:

- **Wt/Mt is identical to the previous master for all 513 shared codes** (zero
  differences), and matches DB `weight / length` for all **530** spec rows that
  carry a weight — 0 mismatches.
- **127 codes have a revised Rate/Mt**, mostly small uplifts (4.70→4.78,
  5.70→5.85, 8.50→8.65). This is the "regularly updated fabrication rate" the
  client described, versus the fixed rate we held before.
- **3 new codes inserted**: 295 (PF120"WHITE, ₹76.37/kg), 729 and 1119 (both
  Rate/Mt = 0). None had April–June sales except 1119, which is out of SKU
  scope (≥ 1000).
- Codes **474** and **1421** exist in the DB but not in v2 — left untouched.

318 spec rows updated, 218 unchanged.

### Duplicate-row rule

v2 repeats a code once per product name. Two codes disagree across their own
rows — **126** (5.7 / 0 / 0) and **706** (9.75 / 9.746). Per the client's
confirmation that duplicates are the same physical product with identical cost
specs, we take the **max** rate, treating 0 as blank rather than a real zero.
These are the two largest movers:

| Code | Product | Old fab/kg | New fab/kg | Δ |
|---:|---|---:|---:|---:|
| 706 | 60MESHHQ42"WHITE | 48.00 | 96.04 | +48.04 |
| 126 | GOUTAM-GOLD54"DARK BLUE | 20.13 | 60.40 | +40.27 |

Both were previously depressed by averaging a blank duplicate row into the
rate. Every other change is ≤ +₹3.75/kg.

### Disposition of the §3 flagged codes

| Code | §3 issue | Now |
|---:|---|---|
| 706 | V3 charged 0, we charged 48.00 | **Resolved** — v2 gives 9.75/Mt → ₹96.04/kg |
| 401 | V3 Rate/Mt blank | v2 confirms 5.75 → ₹38.65/kg; V3's blank was the error |
| 251 | We charged 0, V3 charged 100 | v2 confirms **Rate/Mt = 0** — our value was right |
| 518, 541, 249, 250, 124 | Wt/Mt materially different from V3 | v2 confirms **our** Wt/Mt unchanged; V3's SKU Master values were stale/rounded |

**All Wt/Mt disagreements with V3 resolve in our favour** — v2 did not move a
single Wt/Mt value. The V3 SKU Master's 2–3 decimal rounding (§3C) and its
blank/zero rates were copies, not corrections.

### Effect

| | Apr | May | Jun |
|---|---:|---:|---:|
| Contribution before | 40,83,381 | 21,89,816 | 21,02,510 |
| **Contribution after** | **39,62,428** | **20,40,425** | **20,03,274** |
| Change | −1,20,953 | −1,49,391 | −99,236 |
| Residual true-up before | 62,93,285 | 46,72,898 | 41,39,881 |
| **Residual true-up after** | **64,14,238** | **48,22,289** | **42,39,117** |

Higher fabrication rates raise manufacturing cost, so contribution falls and
the residual grows by the same amount. Direction is as expected; the residual
question (§Q2/Q3 in `PMC_FILE_CLARIFICATION_QUESTIONS.md`) is unaffected by
this update and remains open.

---

## 9. Engine aligned to V3's exact formula — applied 2026-08-01

`sheets/calculate_contribution.py` now reproduces V3's Rate Card and SKU Master
build-up exactly. Three elements were missing before:

| Element | V3 cell | Value | Was |
|---|---|---:|---|
| Yield (kg RM per kg fabric) | B5 | 1.0037 | not applied |
| Wastage allowance on RM cost | B6 | 2% | not applied |
| Fab Rate increase per Kg | B14 | ₹2.00 | not applied |

Stage build-up, matching V3 B24–B28 and SKU Master cols G/H:

```
stage1_rm       = rm_rate_base * 1.0037 * (1 + 0.02)        # B24 + B25 = B26
fabrication/kg  = spec_fab/kg + 2.00  (only if spec_fab > 0) # SKU Master col G
mfg_cost/kg     = 0 if no Wt/Mt else
                  stage1_rm + yarn_conversion + fabrication/kg + fabric_addon
```

### Validation — exact

Feeding V3's own Rate Card constants and Ratio Master into our formula
reproduces **all 127 of V3's SKU Master `Mfg Cost ₹/Kg` values, worst
difference 0.0000000000**.

Two V3 behaviours had to be matched precisely to reach that:

- **Zero Wt/Mt ⇒ zero mfg cost**, not just zero fabrication
  (`=IF(OR(E="",E=0),0,...)`). No sold SKU hits this after the v2 master, so
  it is a safety net.
- **The ₹2 increase applies only where the base fab rate is non-zero.** Every
  V3 row with Rate/Mt = 0 carries Fab Rate = 0, not 2 — codes **596, 635, 706,
  720**. Applying the increase unconditionally left exactly those 5 rows
  off by exactly ₹2.00.

### Deliberate difference from V3

V3 hardcodes FY-average scalars (RM 151.17, in-house yarn 31.26, add-on
14.47); we derive them from each month's ledger, per the ruling that the Rate
Card carries the month's actual values. June is the close case:

| | Stage 1 RM/kg |
|---|---:|
| V3 (FY average, RM 151.17) | 154.76 |
| Ours (June actual, RM 151.42) | 155.02 |

So monthly totals will not equal V3's. The formula shape is identical.

### Effect

| | Apr | May | Jun |
|---|---:|---:|---:|
| Contribution, v2 master only | 39,62,428 | 20,40,425 | 20,03,274 |
| **Contribution, + V3 formula** | **36,30,505** | **15,40,875** | **15,50,180** |
| Change | −3,31,923 | −4,99,550 | −4,53,094 |
| Residual true-up | 67,46,161 | 53,21,839 | 46,92,212 |

The drop is fully explained: yield × wastage adds 2.3774% to RM cost
(June: ₹3.60/kg × 80,502 kg produced = ₹2.9L) and the flat increase adds
₹2/kg (₹1.6L) — ₹4.5L total, matching the ₹4.53L observed.

### ⚠ These two constants contradict the sheet's own notes

V3 ships Wastage = 2% and Fab increase = ₹2, but its own cell notes read
**"Hist=0 (actual consumption). Set 5% for forecasts"** and **"Flat ₹/Kg
increase. Hist=0. Set ₹2 for forecasts."** Both are forecast settings applied
to a historical month, and together they add ~₹4.5L/month of cost that did not
occur — which is why the residual grew.

We follow the file as shipped. To cost historical months on actual
consumption, set these at the top of `calculate_contribution.py` and re-run:

```python
WASTAGE_ALLOWANCE = 0.0
FAB_RATE_INCREASE_PER_KG = 0.0
```

### Sanity check on magnitude

Fabrication charged to SKUs vs the ledger's actual `Fabrication charges`:

| Month | Ledger | Engine charges | Difference |
|---|---:|---:|---:|
| Apr | 64,51,860 | 61,58,165 | −2,93,696 |
| May | 45,64,888 | 85,76,800 | **+40,11,912** |
| Jun | 55,22,931 | 72,79,610 | **+17,56,680** |

April ties out closely. May and June over-charge because per-kg rates are
derived from RM consumed but applied to produced qty, and those diverge when
stock is drawn down — the §Q3 issue, unchanged by this work and still open.
