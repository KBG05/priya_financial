---
version: 1
slug: "frontend-src-app-tsx"
primary_target: "frontend/src/App.tsx"
related_targets: []
---

# Surface: PriyaFil monthly business review (whole dashboard app)

Mode: Operate. Audience: owner/CFO, monthly 5-minute review on a laptop; phone is secondary. Job: understand the month (result, cause, cash, products) without opening Excel; ledgers on demand. Constraints: MTY definitions are canonical; health is judged only against the company's own trailing 12 months; missing data is labelled, never zeroed. Pages: Overview, Profit & Margin, Costs, Inventory & Materials, Products & Pricing, Financial Health, Statements (PAL-1/MTY ledgers), Quote Builder (tool).

## Direction contract

THESIS: Every page argues one thing about the month. A plain-language finding leads each section and the panel beneath proves it. This replaces the category default of a KPI tile row over charts over tables, where the reader has to work out the meaning themselves.

OWN-WORLD: The ground is cool grey #f6f7f9 with white panels and 1px #e4e7ec rules. Ink is #101828 and secondary text #475467. There is one brand accent, PriyaFil deep teal #0e6e6e, used for selection, primary actions, and "good". Red #b42318 marks only losses and bad standings; amber #93600a marks watch. Type is Manrope (UI and figures, tabular numerals). Sections are white panels with a 12px radius. Figure strips are ruled, never boxed tiles.

STORY: The owner opens the app on the latest month and reads one sentence saying how it went and why. They see the bridge that proves it, which of the four health signs are outside their usual range, and what needs attention, each linking to the page that explains it. They go to the ledger only to verify.

FIRST VIEWPORT: Left sidebar (232px, white, PriyaFil mark, eight question-named items). A 60px header with the page title, period select, and compare control ("vs previous month" / "vs same month last year"). Below that, a 34px verdict sentence, max 1050px wide, with the loss figure in red. Then a ruled strip of four key figures, each with its comparison. Then a two-column row: on the left, the finding "X moved the profit" over a to-scale profit bridge that reconciles exactly; on the right, "Needs attention" items with links. Health signs follow below.

FORM: Standard shell with claim-led sections (fusion of the category standard and Claim & Proof). It is the user's pick from round 3 and ranks #1 on the ordered list; seed key 2a8254fc. Signature interaction: when the period or comparison changes, the verdict and bridge re-render in place, with the bridge bars tweening to their new to-scale lengths (motion conveys the change, 200ms, honoring reduced motion).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decision provenance

- Roll: `concept-seed --scope direction --mode operate` printed key 2a8254fc and assigned grounded candidate 5, "Trains at a Glance" (an Indian Railways timetable). Its challengers were datamatics, product-marketing claim/proof, vertical feed, Crouwel grid, gate board and labanotation.
- Round 1 (decision page): the user liked the category standard and Claim & Proof and asked to see more pages.
- Round 2: three 3-page sketches (standard, claim & proof, fusion). The user asked for Profit & Margin and one more page.
- Round 3: 5-page sketches of the fusion and the standard. The user chose the fusion "Standard shell, claim-led sections" (IMPECCABLE'S PICK). The reference is `.impeccable/mocks/decision/round3-fusion.html` / `.png`.
