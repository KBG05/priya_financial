# PMC contribution model — status after Sudhir sir's clarifications

Updated following Sudhir sir's answers and the receipt of `4.PMC_Jul 26_V3.xlsx`.
All checks below run against FY **26_27** tables.

---

# Part 1 — Resolved

## R1. Purchase quantity: kg (ALT.QTY), not metres (STOCK QTY) ✅

Confirmed as an error in the previous implementation, and **fixed in V3**. V3's
purchase quantities now match our independently-ingested figures **exactly**
(June total 13,028.8 kg in both).

Effect on PMC's own June contribution: **₹68,93,249 → ₹14,24,466**.

## R2. Fixed expenses: actual monthly from MIS, not annual ÷ 12 ✅

Confirmed. Rate Card B20 draws from the month's MIS (E38). Our implementation
already used the month's actual `Fixed Cost + Deprn` — no change needed.

## R3. Rate Card: month's actual values, updated monthly ✅

Confirmed — not static. Our implementation already derives `rm_price`,
`yarn_conversion` and `fabric_addon` from each month's `consumption_output` /
`direct_expenses_output`. No change needed. This matters: actual RM moved
₹107.37 (Apr) → ₹127.59 (May) → ₹151.42 (Jun), a 41% swing in one quarter.

## R4. Duplicate product codes: benign ✅

Confirmed — same Wt/Mt, so same cost price; only selling price differs by
product name. **Verified independently:** all 16 duplicate codes have
identical `Wt/Mt` *and* identical `Rate/Mt` within each code. Our `AVG()`
grouping by `product_code` is therefore mathematically exact, not an
approximation. An earlier concern in this document that ~23% of revenue sat
on "ambiguous" codes was unfounded and is withdrawn.

## R5. Stock Difference: ADD ✅

Confirmed, and **implemented**. We had briefly switched this to SUBTRACT,
reasoning from `mty`'s internal identity (`Total Consumption = PFCo + Stock
Difference`). That reasoning was wrong.

The decisive evidence is how the residual behaves across months:

| Convention | Apr | May | Jun |
|---|---:|---:|---:|
| **ADD** (correct) | +₹59.4L | +₹44.4L | +₹39.1L |
| SUBTRACT | −₹8.0L | +₹104.7L | +₹0.2L |

ADD produces a stable, same-signed residual — consistent with a genuine
unmodelled item. SUBTRACT swings by 100x and flips sign. June's near-zero
SUBTRACT residual was coincidence, not validation.

## R6. Step 6 is a pure balancing figure ✅

Confirmed: C9 is simply C16 when C9 = 0. **Consequence: the PMC sheet always
"reconciles" by construction — a zero Difference row proves nothing.** The
meaningful diagnostics are how *large* and how *stable* the residual is. Our
verification script now reports it as "residual true-up required" rather than
treating a tie-out as success.

## R7. Product master: `Ratio Masterv2.xlsx` received and applied ✅

The verified master arrived 2026-08-01 and is now live. It carries **one
fabrication rate column**, which answers the open question of whether the
"fixed" and "regularly updated" rates would both need to be held — they do not,
so no schema change was required.

Key result: **Wt/Mt did not change for a single code.** Only fabrication rates
moved (127 codes). This confirms every Wt/Mt disagreement previously found
against V3's SKU Master was V3's error, not ours. Codes 706 and 126 were also
corrected upward (+₹48 and +₹40 per kg) by resolving blank duplicate rows.

Full detail in `CONTRIBUTION_DATA_DIFFERENCES.md` §8.

---

# Part 2 — Current position

With all confirmed rulings and the v2 master applied:

| Month | Contribution | Engine Net Profit | PAL target | Residual (Step 6) |
|---|---:|---:|---:|---:|
| Apr | ₹39,62,428 | −₹18,04,033 | ₹46,10,204 | +₹64,14,238 |
| May | ₹20,40,425 | ₹27,86,882 | ₹76,09,172 | +₹48,22,289 |
| Jun | ₹20,03,274 | −₹29,11,731 | ₹13,27,386 | +₹42,39,117 |

**Our June residual (₹39.1L) is ₹8.4L smaller than V3's (₹47.5L)** — our model
explains more of the P&L, mainly because it uses each month's actual rates per
R3 rather than a static card.

The two models now converge closely on June once normalised:

| | June contribution |
|---|---:|
| V3 as shipped (Wastage 2%, Fab +₹2) | ₹14,24,466 |
| V3 normalised to Hist = 0/0 | ~₹18,29,760 |
| Ours (month's actual rates) | ₹20,92,214 |

---

# Part 3 — Remaining issues

## Q1. V3's Rate Card has reverted to forecast settings ⚠️

V3 ships with **`Wastage allowance` = 2%** and **`Fab Rate increase per Kg` =
₹2**. Both contradict the sheet's own notes (`Hist=0`) and Sudhir sir's
ruling R3 that the card should carry the month's actual values. These had been
set to 0/0 in the previous revision; V3 has them back at forecast values.

Cost: ₹4,05,294 of overstated June cost, understating contribution by the same.

> **Is this intentional, or did the 0/0 correction get lost when the kg fix was
> applied?** If historical months should always run at 0/0, could the template
> flag or lock this so it cannot silently revert again?

## Q2. The residual is larger than the profit it reconciles to ⚠️

Step 6 now runs **₹39L–₹59L per month**, against monthly net profits of
₹13L–₹76L. For June the residual is **294% of net profit**. Since Step 6 is a
pure plug (R6), the model is currently explaining less of the P&L than the
balancing figure absorbs.

Sudhir sir's note that the residual covers "Yarn Semi-Finished" suggests at
least part is identifiable. One component we can already quantify: the
**trading-yarn margin** (`Sales Monofil from Trading Yarn` − `Monofil Purchase
Yarn`) = ₹4.14L (Apr), ₹3.30L (May), ₹13.59L (Jun) — real, currently
unmodelled, and not included in Steps 2–4.

> **Should the trading-yarn margin be added as an explicit Step, rather than
> absorbed into Step 6?** And is there a source for the yarn semi-finished /
> WIP valuation that would let us compute the rest, so the plug shrinks toward
> the "as you tag more data at SKU level, this item shrinks toward zero"
> intent stated in the sheet?

## Q3. May shows a structural anomaly not explained by any of the above ⚠️

May fails under every combination we have tested — both sign conventions, PMC's
method and ours, with and without an inventory-costing adjustment.

The likely cause: our per-kg rates are derived as `total cost ÷ RM qty
consumed`, then applied to `produced_qty`. Those two quantities diverge badly
in May:

| Month | produced_qty | RM consumed | ratio |
|---|---:|---:|---:|
| Apr | 72,956 kg | 66,208 kg | 1.10 |
| Jun | 80,502 kg | 90,453 kg | 0.89 |
| **May** | **99,504 kg** | **62,433 kg** | **1.59** |

May sold 108,161 kg while consuming RM for only 62,433 kg — roughly 40,456 kg
came out of finished-goods inventory (confirmed against `stock_valuation`:
FG+WIP fell 40,456 kg in May, versus 9,194 kg in April and 1,168 kg in June).
Applying rates derived from 62,433 kg of RM to 99,504 kg of output inflates
every conversion component by ~59%.

The same structure exists in PMC's model (`cost ÷ RM qty → × produced qty`), so
this is not specific to our implementation.

> **How should goods sold from inventory be costed?** They were manufactured in
> earlier months at different rates (April RM ₹107.37 vs June ₹151.42). Options:
> (a) accept larger residuals in high-drawdown months; (b) cost the
> inventory-drawn portion at the FIFO stock rate from the Stock Valuation sheet,
> applying current-month rates only to fresh production. We tested (b) — it
> improved June to +0.3% and May by ₹14.6L, but worsened April, so we have not
> adopted it pending your view.

## Q4. RM resale revenue disagreement (unchanged)

`Jul26!E53` "From RM Sales" = ₹160 for June; our June data (from the SKU Sales
& Purchase file) shows RM/MB resale of ₹22,600.

> Are the PMC file and the SKU Sales & Purchase file drawn from the same
> extraction and cut-off? Which is authoritative?

---

# Part 4 — Implementation notes

`sheets/verify_pal_reconciliation.py` now:
- **adds** Total Stock Difference (R5)
- uses the month's actual `Fixed Cost + Deprn` (R2)
- reports "residual true-up (Step 6) required" as the headline diagnostic (R6)

`sheets/calculate_contribution.py` is unchanged and already complies with R1
(kg purchases), R3 (monthly derived rates) and R4 (AVG by product_code).

Run: `python -m sheets.verify_pal_reconciliation 26_27 Apr,May,Jun`
