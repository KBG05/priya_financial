---
name: PriyaFil MIS
description: A monthly business review that argues one finding per section and proves it with the figures beneath.
colors:
  primary: "hsl(180 77% 24%)"
  primary-foreground: "hsl(0 0% 100%)"
  primary-soft: "hsl(180 32% 93%)"
  destructive: "hsl(4 76% 40%)"
  destructive-soft: "hsl(4 86% 96%)"
  warning: "hsl(38 87% 31%)"
  warning-soft: "hsl(40 80% 94%)"
  background: "hsl(220 14% 97%)"
  card: "hsl(0 0% 100%)"
  foreground: "hsl(221 43% 11%)"
  muted: "hsl(220 14% 95%)"
  muted-foreground: "hsl(217 18% 34%)"
  accent: "hsl(220 14% 94%)"
  border: "hsl(220 17% 91%)"
  input: "hsl(220 14% 84%)"
  dark-primary: "hsl(176 55% 50%)"
  dark-primary-foreground: "hsl(200 30% 8%)"
  dark-primary-soft: "hsl(176 40% 15%)"
  dark-destructive: "hsl(4 80% 66%)"
  dark-destructive-soft: "hsl(4 45% 16%)"
  dark-warning: "hsl(38 90% 62%)"
  dark-warning-soft: "hsl(38 45% 14%)"
  dark-background: "hsl(200 18% 7%)"
  dark-card: "hsl(200 16% 10%)"
  dark-foreground: "hsl(200 15% 92%)"
  dark-muted: "hsl(200 14% 14%)"
  dark-muted-foreground: "hsl(200 10% 68%)"
  dark-accent: "hsl(200 14% 16%)"
  dark-border: "hsl(200 12% 19%)"
  dark-input: "hsl(200 12% 26%)"
typography:
  verdict:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  finding:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.375
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  secondary:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  bar: "3px"
  bridge: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  cell-x: "10px"
  cell-y: "10px"
  panel-mobile: "20px"
  panel: "24px"
  grid-gap: "20px"
  stack: "24px"
  page-x-mobile: "16px"
  page-x: "32px"
components:
  section-panel:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "24px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "6px 14px"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  link-button:
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  link-button-hover:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
  tag-good:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  tag-bad:
    backgroundColor: "{colors.destructive-soft}"
    textColor: "{colors.destructive}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  tag-watch:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  tag-neutral:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  notice-watch:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  nav-item:
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  period-select:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 32px 0 12px"
---

# Design System: PriyaFil MIS

## Overview

**Creative North Star: "The Argued Month"**

Every page makes one claim about the month in a plain sentence, and every panel below that sentence proves it. The interface is a review document laid on a working shell. A cool grey ground holds white panels separated by hairline rules, and one PriyaFil deep teal marks what is good, what is selected, and what you can act on. Red is reserved for money lost and standings that are bad. Amber is reserved for things to watch.

The density is that of a well-set financial report rather than a dashboard. Sentences lead and figures follow them in tabular Manrope. The page does not open on a grid of identical metric tiles. It opens on a verdict sentence over one ruled strip of four figures, then sections whose headings are findings ("Production cost per kg rose to ₹250.6/kg, taking ₹57.6 L out of profit") and not category names ("Costs"). Charts are drawn to scale, reconcile on screen, and also exist as real tables for screen readers.

Light and dark carry equal weight. The dark theme keeps the teal, red and amber roles, raised in lightness, on a blue-green-tinted near-black.

**Key Characteristics:**
- Finding-led: section headings state a conclusion generated from the figures.
- Ruled, not boxed: key figures sit in a strip divided by 1px rules, never in tiles.
- One accent: teal means good, selected or actionable. It is never decoration.
- Status always pairs colour with words or a signed arrow.
- Tabular numerals everywhere a figure appears.

## Colors

The palette is a cool, faintly blue-tinted neutral system with one teal accent and two status hues, all defined as HSL triples in `frontend/src/index.css`.

### Primary
- **PriyaFil Deep Teal** (primary; dark: dark-primary): the only accent. It marks the active nav item, the selected state, primary buttons and link buttons, favourable deltas, the "up" steps of the profit bridge, the current month in a bar series, and "good" standings. **Teal Wash** (primary-soft) is its quiet ground for the active nav item, good tags and link-button hover.

### Secondary
- **Loss Red** (destructive; dark: dark-destructive): net losses, adverse deltas, the profit bridge's "down" steps, negative months in a series, "bad" standings (12-month extremes), and attention dots for bad items. **Loss Wash** (destructive-soft) grounds bad tags.

### Tertiary
- **Watch Amber** (warning; dark: dark-warning): standings in the outer quarters of their usual range, and notices about incomplete data, such as a balance sheet that has not been uploaded. **Watch Wash** (warning-soft) grounds watch tags and notices.

### Neutral
- **Cool Paper** (background): the page ground behind panels.
- **Panel White** (card): section panels, the sidebar, the sticky header (95% opacity) and popovers.
- **Ledger Ink** (foreground): all primary text, the closing-total bar of the bridge, and the "now" mark on a range bar.
- **Slate Secondary** (muted-foreground): notes, labels, table headers, definitions, inactive nav, and the "usual range" band at 35%.
- **Mist** (muted / accent): skeleton blocks, neutral tags, the compare segmented-control track, and hover grounds.
- **Hairline** (border): every rule, between strip figures, under table rows and around panels. **Field Edge** (input) outlines selects and secondary buttons.

### Named Rules
**The One Accent Rule.** Teal means good, selected or actionable, and nothing else. No second decorative hue enters the product.

**The Red Is Money Lost Rule.** Red marks only what hurts the business: a loss, an adverse move, a bad standing. A figure that fell is not red unless the fall is bad (for example, falling costs show in teal).

**The Never Colour Alone Rule.** Every tone carries words (a tag), a sign and an arrow (a delta), or a legend (a dashed outline). A colour-blind reader loses nothing.

## Typography

**Display Font:** Manrope (with ui-sans-serif, system-ui)
**Body Font:** Manrope (with ui-sans-serif, system-ui)

**Character:** One geometric-grotesque family, weights 400 to 800, does both the argument and the arithmetic. Hierarchy comes from size and weight with slight negative tracking on large sizes, not from a second face.

### Hierarchy
- **Verdict** (700, 32px desktop / 26px mobile, 1.2, -0.02em): the page's one sentence, max width about 64rem, balanced wrapping. Exactly one per page.
- **Finding** (700, 20px desktop / 19px mobile, snug, -0.01em): the claim heading each section panel.
- **Figure** (700, 22px, tight, -0.01em, tabular): values in the verdict's figure strip.
- **Body** (400 to 600, 14px, 1.5): sentences, table cells, nav items (600). Notes under findings run in Slate Secondary.
- **Secondary** (400, 13px): figure labels, figure notes, definitions, link buttons and compact controls (700 or 600).
- **Label** (600 to 700, 12.5px): table column headers, tags, bridge step details, "usual range" captions. 12px only for bar-series month labels and value callouts.

### Named Rules
**The Tabular Rule.** Every figure uses tabular numerals (all tables and any `.tabnum` element) so columns align digit for digit.

**The Sentence Case Rule.** Labels are short sentence-case words in Slate Secondary. Never uppercase, never letter-spaced.

### Number formatting (lib/money.ts)
- Summaries use compact Indian units: ₹3.23 Cr (two decimals), ₹13.3 L, ₹320 below a thousand. Exact figures use Indian grouping without paise (₹3,22,85,532).
- All lakh values in a column share one precision. Narrow columns pass a lakh precision of their own; they never mix precisions.
- Negatives use a true minus (−), never a hyphen. A plus sign appears only on signed changes. The unit is joined with a non-breaking space.
- Rates are per kg (₹290.4/kg), volumes in kg or L kg, margin changes in pts, and durations in days or months.
- A percentage that rounds to zero prints as 0.0%, never −0.0%.
- Missing values print an em dash or a labelled state ("Not reported", "No data"), never 0.
- Bridge steps are rounded by largest remainder so the steps on screen add up exactly to the totals on screen.

## Layout

The shell has a sticky 232px white sidebar from 1024px up (logo, seven question-named review pages, a "Tools" group, and a "Latest figures" footer). The header is a sticky 60px bar with the page title, the period select, and the "vs previous month / vs same month last year" segmented control. Below 1024px the sidebar becomes a horizontally scrolling chip row of nav items inside the header.

The main column is capped at 1320px, padded 16px on mobile and 32px from 768px, with 24px top padding on mobile and 32px from 768px. Page sections stack with a 24px gap. Paired sections use asymmetric two-column grids with a 20px gap: 2.3fr to 1fr for a proof beside its "Needs attention" list from 1280px, and 1.4fr to 1fr elsewhere. Panels pad 20px on mobile and 24px from 768px. Table cells pad 10px horizontally and 8 to 12px vertically.

The verdict's figure strip is four columns from 1024px and two by two below, with rules between cells instead of gaps.

**The Hierarchy Over Uniformity Rule.** The verdict is open text on the ground, the figures are a ruled strip, and the proofs are panels. Three registers, never one repeated card.

## Elevation & Depth

The system is flat. Depth comes from tone (white panels on a cool grey ground) and 1px hairline rules, not shadows. The sticky header uses 95% panel white with a slight backdrop blur only so content scrolling beneath stays legible.

### Shadow Vocabulary
- **Segment lift** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): only on the selected segment of the compare control.
- **Popover** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): floating listboxes, such as the Quote Builder SKU search.

### Named Rules
**The Flat Panel Rule.** Panels never cast shadows. A shadow means a layer is truly floating above the page.

## Shapes

Shapes use soft, consistent corners. Section panels, notices, the error panel and the empty-state panel are 12px. Buttons, selects, nav items and the segmented track are 8px. Tags, skeleton blocks and segments are 6px. Data marks are nearly square: bridge bars are 4px and series bars 3px, so they read as measurements and not pills. Range-bar tracks and attention dots are fully round. Panels and rows use 1px hairline borders throughout. Dashed lines are reserved for meaning: the zero line in the bridge, and outlines for unusual months.

## Components

### Buttons
- **Shape:** gently rounded (8px).
- **Primary:** Deep Teal fill, white 13px bold label with a leading 15px icon, padding 6px by 14px. Used for upload actions only. Hover drops to 90% opacity with a colour transition.
- **Secondary:** a Field Edge outline on panel white, 14px bold, and Mist on hover (for example, "Try again").
- **Link button:** teal 13px bold text with a trailing arrow. Hover adds a Teal Wash ground. It sits in a section's action slot, pointing to the page that explains the finding. In attention lists it is bare teal text that underlines on hover.
- **Focus:** a global 2px teal outline, offset 2px.

### Tags (Tag / StandingTag)
- **Style:** 12.5px bold words on the tone's wash at 6px radius. There are four tones: good (teal), bad (red), watch (amber), neutral (Mist with Slate text).
- **StandingTag:** maps a measure's place among its past 12 months to a tone. The 12-month extremes are bad or good, the outer quarters are watch, and otherwise neutral. Too little history gives a neutral "Too little history". A missing value gives a neutral "Not reported".

### Delta
A signed change with an up-right or down-right arrow (14px). The colour follows whether the move helps the business (configurable as good when up, good when down, or neutral), not its direction. No change reads "No change" and a missing change reads "—", both in Slate.

### Section panel (signature)
A white panel with a 12px radius and a hairline border. The finding heading comes first, then an optional Slate note under it explaining what the proof shows, then an optional link button aligned right. The proof sits below. The heading states a conclusion generated from the figures.

### Verdict and figure strip (signature)
One verdict sentence that may colour its loss phrase red. Beneath it, a description list ruled top and bottom with vertical rules between figures: a 13px label, a 22px tabular value, and a 13px note, usually a Delta against the comparison month. It settles in on period change.

### ProfitBridge (signature)
A waterfall from the comparison month's net profit to this month's. It is a real table, so screen readers get every row. Each row has a name with an optional "from → to" detail, a bar on one shared scale, and a right-aligned signed lakh amount. The starting total is a 45% Slate bar, gains are teal, losses red, and the closing total is Ledger Ink. A dashed zero line appears when the scale crosses zero, and a hairline separates the closing total. Bars tween to new lengths when the period or comparison changes.

### BarSeries
Monthly bars on a zero baseline. The current month is teal with its value labelled, other months are Ledger Ink at 25%, and negative months are red at 75%. An unusual month (a one-off revaluation) is drawn as a dashed outline, clipped to the scale of the others, with its true value labelled, and a legend explains the dashes. A hidden table carries every value.

### RangeBar and StandingTable
RangeBar draws the full past range as a thin hairline track, the usual range (the middle half) as a thicker Slate band, and "now" as a 3px Ledger Ink mark. StandingTable shows measure and definition, value now (with an "as of" note when a figure lags), the RangeBar plus a "Usual X to Y over N months" caption, and a StandingTag. Below 640px each row stacks.

### ChangeBar
A zero-centred bar for mover tables, teal when the change helps and red when it hurts. It is scaled to the largest mover.

### Navigation
Sidebar items are 14px semibold with a 17px line icon. Inactive items are Slate and hover to Mist with ink text. The active item sets aria-current, Teal Wash and teal text. The compare control is a Mist track holding two segments; the selected one is panel white with a segment lift. A segment with no data is disabled at 45% opacity, with a tooltip.

### Notice
A full-width 12px strip on Watch Wash with a 25% amber border, a warning icon, and a semibold sentence about incomplete data, with an optional primary action. There is also a neutral Mist variant.

### States
- **PageSkeleton:** pulsing Mist blocks shaped like the page (verdict line, strip, two-column proofs), labelled "Loading the month's figures".
- **ErrorPanel:** a 12px panel with a plain cause, a next step, the raw message in mono 13px, and a "Try again" secondary button.
- **EmptyMonth:** "No figures for {month} yet", why, and an upload primary button.

### Motion
- **Settle** (220ms, cubic-bezier(0.16, 1, 0.3, 1)): content fades from 35% opacity and rises 3px whenever the period re-renders it.
- **Bridge tween** (240ms, same curve): bridge bars move to their new to-scale left and width.
- **Series bars** (200ms) ease their top and height. Collapsibles open in 220ms and close in 180ms.
- Under `prefers-reduced-motion`, settle and the verdict pulse are removed and bridge transitions are disabled. Motion only ever reports a real change in the data.

## Do's and Don'ts

### Do:
- **Do** lead each section with a finding generated from the figures (`lib/narrative.ts`), never a canned or category heading.
- **Do** use plain names for ledger heads (`lib/labels.ts`, for example "Admn Expns" becomes "Admin expenses"). Statements alone keep Tally's original names.
- **Do** format every figure through `lib/money.ts`: ₹ Cr/L, one lakh precision per column, a true minus, per-kg rates, no −0.0%.
- **Do** label missing data ("Not reported", "No data", "—", "May figure") and say which month a lagging figure comes from.
- **Do** give every chart a text alternative (a real or hidden table) and make bridge totals reconcile on screen.
- **Do** colour a change by whether it helps the business, always with a sign and an arrow.

### Don't:
- **Don't** build rows or grids of KPI tiles. Key figures go in one ruled strip under the verdict.
- **Don't** add eyebrow or kicker labels above headings, or uppercase letter-spaced labels.
- **Don't** add decorative sparklines, trend icons or background charts. A chart appears only when it proves a finding.
- **Don't** use red for anything but losses, adverse moves and bad standings, and don't introduce a second accent hue, gradients, gradient text or glassmorphism.
- **Don't** render missing data as zero or as a red dash.
- **Don't** let one outlier month flatten a series. Mark it unusual and clip it.
- **Don't** put shadows on panels.
