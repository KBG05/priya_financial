## Design Context

### Users
Business owner / leadership at PriyaFil reviewing the company's monthly MIS (management information system) financials: purchases, sales, direct & indirect expenses, stock valuation, balance sheet, contribution, consumption, and KPIs (Current Ratio, EV, Interest Coverage, etc.). They check the dashboard periodically (not necessarily daily) to get a fast, confident read on business health — less interested in raw ledger mechanics, more in "what does this number mean for the business right now." Data is uploaded monthly from Tally/MIS Excel exports (see UPLOAD_GUIDE.md), so the dashboard is a recurring monthly review tool, not a live feed.

### Brand Personality
Sharp, modern, confident. This is a fintech-grade financial command center, not a stuffy static ledger. It should feel like the interface of someone in control of their numbers — decisive, current, well-engineered — while never sacrificing legibility of the underlying financial data.

### Aesthetic Direction
Support both light and dark themes equally (no single mode assumed — this is a daily/monthly-use business tool, and leadership may use it in either). Neutrals should be tinted toward a shared brand hue rather than flat gray, for cohesion across both themes. One confident accent color carries emphasis (key KPIs, positive/negative deltas, primary actions) rather than a spread of decorative colors. Avoid generic AI-dashboard tropes: no cyan-on-dark/purple gradients, no gradient text on metrics, no glassmorphism, no identical icon-topped card grids. Numerals (currency, percentages, KPIs) should be a first-class typographic element — a distinctive display face for headings/hero metrics paired with a highly legible body/data face; consider tabular figures for tables and KPI grids so columns of numbers align cleanly.

### Design Principles
1. **Numbers lead, chrome follows** — the interface exists to make financial figures fast to read and trust; decoration must never compete with data legibility.
2. **One accent, used deliberately** — a single confident brand accent marks what matters (KPI status, deltas, primary actions); everything else stays neutral.
3. **Theme parity** — light and dark are both first-class; tint neutrals toward the brand hue in each rather than defaulting to flat gray/black/white.
4. **Hierarchy over uniformity** — vary spacing and card weight so hero KPIs, trend charts, and detailed ledger tables each get a distinct visual register instead of a repeated card-grid template.
5. **Confident, not decorative motion** — use animation for real state changes (data refresh, section expand/collapse, filter changes), not ambient flourish.
</content>
