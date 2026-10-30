/**
 * review.ts — turns the per-FY MIS tables into the monthly business review:
 * canonical (MTY) P&L figures per month, a reconciling profit bridge,
 * profit drivers ranked by effect, and standings against the company's
 * own trailing 12 months (no invented targets).
 */
import { api } from "@/api";
import { byFy, key, previous, sameMonthLastYear, trailing, type Period } from "@/lib/period";
import { inr, kg, perKg } from "@/lib/money";
import { expenseName } from "@/lib/labels";

// ── Raw month bundle ────────────────────────────────────────────────

export interface ContribRow {
    product_id: number;
    product_name: string;
    qty: number;
    revenue: number;
    selling_price_per_kg: number;
    contribution_per_kg: number;
    contribution_value: number;
}

export interface ExpenseRow { category: string; line_item: string; value: number | null }

interface Raw {
    mty: Record<string, number>;
    pal: Record<string, { qty: number | null; value: number | null; rate: number | null }>;
    kpi: Record<string, number | null>;
    expenses: ExpenseRow[];
}

/** Canonical figures for one month. MTY definitions win wherever PAL-1 differs. */
export interface Fin {
    period: Period;
    present: boolean;
    sales: number;
    grossProfit: number;
    overheads: number;          // salaries, admin, selling
    salaries: number;
    admin: number;
    selling: number;
    ebitda: number;
    finance: number;
    depreciation: number;
    netProfit: number;
    otherIncome: number;
    grossMargin: number | null;
    netMargin: number | null;
    salesKg: number | null;
    realisation: number | null; // ₹ per kg sold
    costPerKg: number | null;   // (sales − gross profit) per kg
    rmRate: number | null;      // raw-material purchase ₹/kg
    rmKg: number | null;
    closingStock: number | null;
    closingStockKg: number | null;
    stockCover: number | null;  // closing stock ÷ month's sales, in months
    kpi: Record<string, number | null>;
    hasKpis: boolean;
    expenses: ExpenseRow[];
}

const n = (v: number | null | undefined) => (v == null || !isFinite(v) ? 0 : v);

function toFin(period: Period, raw: Raw | undefined): Fin {
    const m = raw?.mty ?? {};
    const p = raw?.pal ?? {};
    const sales = n(m["TOTAL SALES->"]);
    const grossProfit = n(m["Gross Profit"]);
    const salesKg = p["Sales"]?.qty ?? null;
    const closingStock = p["Cl Stk"]?.value ?? null;
    const kpi = raw?.kpi ?? {};
    return {
        period,
        present: sales > 0,
        sales,
        grossProfit,
        overheads: n(m["Operating Expns Sal/Adm/Sell"]),
        salaries: n(m["Salaries"]),
        admin: n(m["Admn"]),
        selling: n(m["Selling"]),
        ebitda: n(m["EBITDA"]),
        finance: n(m["Finance Cost"]),
        depreciation: n(m["Deprn (EBITDA)"]),
        netProfit: n(m["Nett Profit"]),
        otherIncome: n(m["From Other Income"]),
        grossMargin: sales ? (grossProfit / sales) * 100 : null,
        netMargin: sales ? (n(m["Nett Profit"]) / sales) * 100 : null,
        salesKg: salesKg && salesKg > 0 ? salesKg : null,
        realisation: salesKg && salesKg > 0 ? sales / salesKg : null,
        costPerKg: salesKg && salesKg > 0 ? (sales - grossProfit) / salesKg : null,
        rmRate: p["Purchase-RM"]?.rate ?? null,
        rmKg: p["Purchase-RM"]?.qty ?? null,
        closingStock,
        closingStockKg: p["Cl Stk"]?.qty ?? null,
        stockCover: closingStock != null && sales > 0 ? closingStock / sales : null,
        kpi,
        hasKpis: Object.values(kpi).some(v => v != null),
        expenses: raw?.expenses ?? [],
    };
}

export const KPI = {
    ccc: "CCC (cash conversion cycle)",
    dio: "DIO (Days Inventory Outstanding)",
    dso: "DSO (Days sales Outstanding)",
    dpo: "DPO (Days Payable Outstanding)",
    currentRatio: "Current Ratio",
    quickRatio: "Quick Ratio",
    debtEquity: "Debt Equity",
    debtCoverage: "Debt Coverage",
    interestCoverage: "Interest Coverage",
    ev: "EV (Enterprise Value)",
} as const;

// ── Fetching across fiscal years ────────────────────────────────────

type MtyApiRow = { month: string; line_item: string; value: number };
type PalApiRow = { month: string; line_item: string; qty: number | null; value: number | null; rate: number | null };
type KpiApiRow = { month: string; kpi_name: string; value: number | null };
type ExpenseApiRow = ExpenseRow & { month: string };

async function fetchMonths(periods: Period[], availableFys: string[]): Promise<Map<string, Raw>> {
    const out = new Map<string, Raw>();
    const ensure = (fy: string, month: string) => {
        const k = `${fy}:${month}`;
        let r = out.get(k);
        if (!r) { r = { mty: {}, pal: {}, kpi: {}, expenses: [] }; out.set(k, r); }
        return r;
    };
    const jobs: Promise<void>[] = [];
    for (const [fy, months] of byFy(periods)) {
        if (!availableFys.includes(fy)) continue;
        jobs.push(
            api.mty(months, fy).then(r => (r.data as MtyApiRow[]).forEach(x => { ensure(fy, x.month).mty[x.line_item] = x.value; })),
            api.pal1(months, fy).then(r => (r.data as PalApiRow[]).forEach(x => { ensure(fy, x.month).pal[x.line_item] = x; })),
            api.kpis(months, fy).then(r => (r.data as KpiApiRow[]).forEach(x => { ensure(fy, x.month).kpi[x.kpi_name] = x.value; })),
            api.directExpenses(months, fy).then(r => (r.data as ExpenseApiRow[]).forEach(x => { ensure(fy, x.month).expenses.push(x); })),
        );
    }
    await Promise.all(jobs);
    return out;
}

// ── Standing against own history ────────────────────────────────────

export type Position = "lowest" | "low" | "usual" | "high" | "highest";
export type Tone = "good" | "bad" | "neutral";

export interface Standing {
    position: Position;
    tone: Tone;
    /** Plain words, e.g. "Highest in 12 months". */
    words: string;
    average: number;
    min: number;
    max: number;
    /** The middle half of past months: the "usual range". */
    low: number;
    high: number;
    samples: number;
}

function quantile(sorted: number[], q: number): number {
    const at = (sorted.length - 1) * q;
    const lo = Math.floor(at), hi = Math.ceil(at);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
}

/**
 * Where `value` sits within its own trailing history. The usual range is the
 * middle half of past months; beyond every past month is the extreme; `higherIsBetter` decides whether that is good or bad.
 * Returns null when fewer than 4 comparable months exist.
 */
export function standing(value: number | null, history: (number | null)[], higherIsBetter: boolean | null): Standing | null {
    const h = history.filter((v): v is number => v != null && isFinite(v));
    if (value == null || h.length < 4) return null;
    const sorted = [...h].sort((a, b) => a - b);
    const low = quantile(sorted, 0.25);
    const high = quantile(sorted, 0.75);
    let position: Position = "usual";
    if (value < sorted[0]) position = "lowest";
    else if (value > sorted[sorted.length - 1]) position = "highest";
    else if (value < low) position = "low";
    else if (value > high) position = "high";
    const span = `${h.length} months`;
    const words: Record<Position, string> = {
        lowest: `Lowest in ${span}`,
        low: "Below its usual range",
        usual: "Within its usual range",
        high: "Above its usual range",
        highest: `Highest in ${span}`,
    };
    let tone: Tone = "neutral";
    if (higherIsBetter != null && position !== "usual") {
        const isHigh = position === "high" || position === "highest";
        tone = isHigh === higherIsBetter ? "good" : "bad";
    }
    return {
        position, tone, words: words[position],
        average: h.reduce((s, v) => s + v, 0) / h.length,
        min: sorted[0], max: sorted[sorted.length - 1], low, high, samples: h.length,
    };
}

// ── Profit bridge ───────────────────────────────────────────────────

export interface BridgeStep { id: string; label: string; value: number; detail: string }

export interface Bridge {
    start: number;
    end: number;
    steps: BridgeStep[];
}

/**
 * Explains the change in net profit between two months. Gross profit is split
 * into price, volume and production cost per kg (exact: GP = kg × (price − cost/kg)),
 * then overheads and finance cost. Any rounding residual lands in "Other".
 */
export function bridge(prev: Fin, cur: Fin): Bridge {
    const steps: BridgeStep[] = [];
    const dGp = cur.grossProfit - prev.grossProfit;
    if (prev.salesKg && cur.salesKg && prev.realisation != null && cur.realisation != null) {
        const gpPerKgPrev = prev.grossProfit / prev.salesKg;
        const volume = (cur.salesKg - prev.salesKg) * gpPerKgPrev;
        const price = (cur.realisation - prev.realisation) * cur.salesKg;
        const cost = dGp - volume - price;
        steps.push(
            { id: "price", label: "Selling price", value: price, detail: `${perKg(prev.realisation)} → ${perKg(cur.realisation)}` },
            { id: "volume", label: "Kg sold", value: volume, detail: `${kg(prev.salesKg)} → ${kg(cur.salesKg)}` },
            { id: "cost", label: "Production cost", value: cost, detail: `${perKg(prev.costPerKg)} → ${perKg(cur.costPerKg)}` },
        );
    } else {
        steps.push({ id: "gross", label: "Gross profit", value: dGp, detail: `${inr(prev.grossProfit)} → ${inr(cur.grossProfit)}` });
    }
    steps.push(
        { id: "overheads", label: "Overheads", value: -(cur.overheads - prev.overheads), detail: `${inr(prev.overheads)} → ${inr(cur.overheads)}` },
        { id: "finance", label: "Finance cost", value: -(cur.finance - prev.finance), detail: `${inr(prev.finance)} → ${inr(cur.finance)}` },
    );
    const explained = steps.reduce((s, x) => s + x.value, 0);
    const residual = cur.netProfit - prev.netProfit - explained;
    if (Math.abs(residual) >= 1000) {
        steps.push({ id: "other", label: "Other", value: residual, detail: "Depreciation and other income" });
    }
    return { start: prev.netProfit, end: cur.netProfit, steps };
}

// ── Cost movers ─────────────────────────────────────────────────────

export interface Mover { label: string; group: string; cur: number; prev: number; delta: number }

/** Expense lines ranked by absolute change vs the comparison month. */
export function costMovers(cur: Fin, prev: Fin): Mover[] {
    const keyOf = (r: ExpenseRow) => `${r.category}|${r.line_item}`;
    const prevMap = new Map(prev.expenses.map(r => [keyOf(r), n(r.value)]));
    const rows = new Map<string, Mover>();
    for (const r of cur.expenses) {
        const p = prevMap.get(keyOf(r)) ?? 0;
        rows.set(keyOf(r), { label: expenseName(r.line_item), group: r.category, cur: n(r.value), prev: p, delta: n(r.value) - p });
    }
    for (const r of prev.expenses) {
        if (!rows.has(keyOf(r))) rows.set(keyOf(r), { label: expenseName(r.line_item), group: r.category, cur: 0, prev: n(r.value), delta: -n(r.value) });
    }
    return [...rows.values()].filter(m => m.cur || m.prev).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

// ── The review ──────────────────────────────────────────────────────

export interface Review {
    cur: Fin;
    prev: Fin | null;
    lastYear: Fin | null;
    history: Fin[];                 // trailing 12 months with data, oldest first
    series: Fin[];                  // history + current, for trend views
    bridge: Bridge | null;
    movers: Mover[];
    /** Latest month at or before the current one that has balance-sheet KPIs. */
    kpiSource: Fin | null;
    contribution: ContribRow[] | null;
}

export async function loadReview(cur: Period, availableFys: string[]): Promise<Review> {
    const hist = trailing(cur, 13);
    const raw = await fetchMonths([...hist, cur], availableFys);
    const fin = (p: Period) => toFin(p, raw.get(key(p)));

    const c = fin(cur);
    const p = fin(previous(cur));
    const ly = fin(sameMonthLastYear(cur));
    const history = trailing(cur, 12).map(fin).filter(f => f.present);

    const contribution = await api.contribution([cur.month], cur.fy)
        .then(r => (r.data.length ? (r.data as ContribRow[]) : null))
        .catch(() => null);

    const kpiSource = [c, ...[...history].reverse()].slice(0, 4).find(f => f.hasKpis) ?? null;

    return {
        cur: c,
        prev: p.present ? p : null,
        lastYear: ly.present ? ly : null,
        history,
        series: [...history, c],
        bridge: p.present && c.present ? bridge(p, c) : null,
        movers: p.present ? costMovers(c, p) : [],
        kpiSource,
        contribution,
    };
}

// ── Comparison basis ────────────────────────────────────────────────

export type Compare = "prev" | "ly";

/** The month the current one is compared against, or null when it has no data. */
export function baseOf(r: Review, compare: Compare): Fin | null {
    return compare === "ly" ? r.lastYear : r.prev;
}
