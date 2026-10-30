# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner and leadership of PriyaFil (Priya Textile), an HDPE monofilament manufacturer that makes shade nets, fishnet fabric, mesh, and weed mat, and trades yarn and fabric. They review the business once a month, after the accountant's Tally and MIS exports are uploaded. They think like a CFO: they want to know whether the month was good, why it moved, where cash is tied up, and which products earn or lose money. They are not interested in ledger mechanics. They mostly use a laptop or desktop; a phone is a secondary, glance-only view.

## Product Purpose

It turns the monthly MIS workbook (PAL I, MTY, Consumption, Direct/Indirect Expenses, Balance Sheet, KPIs, per-SKU Contribution) into a monthly business review. Success means the owner understands the month in about five minutes without opening Excel: the profit result and its drivers, working-capital health, cost movers, and loss-making products. Ledger-level detail stays available on demand, not by default. Quote Builder prices individual deals from SKU cost data.

## Positioning

It is built on the company's own MIS definitions, with the MTY sheet's P&L (Sales → COGS → Gross Profit → Operating expenses → EBITDA → Finance cost → Net profit) as the canonical version. It explains each month against the company's own history rather than against generic benchmarks. Per-kg economics (realisation, RM cost, conversion cost) are available because every PAL line carries qty, value, and rate.

## Operating Context

- Data arrives monthly through an Upload dialog: a core Sales_Pur_Exps file, a balance-sheet file (MIS or Tally BS_PL_CF), and an optional item-sales file for contribution. The pipeline writes per-FY Postgres tables (`*_25_26`, `*_26_27`).
- The fiscal year runs April to March. FY25-26 is complete (12 months); FY26-27 has April to June so far.
- The backend is FastAPI at `:8080`, reached on the same hostname as the frontend.
- Quote Builder is used live while pricing a deal.

## Capabilities and Constraints

- Endpoints: `/fy`, `/months`, `/pal1`, `/mty`, `/consumption`, `/kpis`, `/kpis/aggregate`, `/direct_expenses`, `/contribution`, `/quote_builder/*`, `/upload-and-process`.
- KPIs depend on a balance sheet; a month can have P&L data and no KPIs (FY26-27 June).
- Contribution needs item-level sales; FY25-26 April to June has none.
- KPI health is judged against the company's own trailing history (12-month average and range), not absolute targets. Confirmed by the owner on 2026-10-30.
- When PAL-1 and MTY disagree on a label, the MTY definition wins. Confirmed on 2026-10-30.

## Brand Commitments

- Name: PriyaFil (legal and trading name Priya Textile). Logo at `frontend/public/Priyafil-Logo-PNG-Final.png`.
- Personality: sharp, modern, confident, a financial command centre rather than a static ledger.
- Light and dark themes both supported; light mode is the priority and must be excellent.
- No meaningless chart filler. Every visual has to answer a question a CFO would ask.

## Evidence on Hand

Real monthly financials for FY25-26 (full year) and FY26-27 (April to June) in the local Postgres DB, plus source workbooks in the parent folder. There are no budgets or targets, so none should be invented.

## Product Principles

1. Answer first, ledger on demand. Every view leads with what happened and why, and the spreadsheet detail sits one step away.
2. Compare, always. A figure without last month, last year, or its own normal range is not information.
3. Never mislead. Colour, sign, and wording must match the financial meaning, and missing data is labelled as missing, never shown as zero or as a loss.
4. Speak business, not Tally. Plain names, with the source line item available for the accountant.
5. Per-kg is the manufacturer's native unit. Show realisation and cost per kg next to rupee totals.

## Accessibility & Inclusion

WCAG 2.2 AA: 4.5:1 text contrast, keyboard-complete navigation, never colour-only meaning, and tables and charts readable by screen readers.
