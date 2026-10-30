/**
 * Executive number formatting: compact Indian units for summaries
 * (₹3.23 Cr, ₹13.3 L), exact grouping for detail, true minus signs.
 */

const MINUS = "−";
const NBSP = " ";

const group = (n: number, digits = 0) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** ₹3.23 Cr · ₹13.3 L · ₹0.5 L · ₹320. Lakhs share one precision so columns align; pass lakhDigits for small-value columns. */
export function inr(v: number | null | undefined, opts: { signed?: boolean; lakhDigits?: number } = {}): string {
    if (v == null || !isFinite(v)) return "—";
    const abs = Math.abs(v);
    let body: string;
    if (abs >= 1e7) body = `${group(abs / 1e7, 2)}${NBSP}Cr`;
    else if (abs >= 1e3) body = `${group(abs / 1e5, opts.lakhDigits ?? 1)}${NBSP}L`;
    else body = group(abs);
    const sign = v < 0 ? MINUS : opts.signed && v > 0 ? "+" : "";
    return `${sign}₹${body}`;
}

/** Exact rupees with Indian grouping, no paise: ₹3,22,85,532 */
export function inrExact(v: number | null | undefined): string {
    if (v == null || !isFinite(v)) return "—";
    return `${v < 0 ? MINUS : ""}₹${group(Math.round(Math.abs(v)))}`;
}

/** Rupee rate per kg: ₹290.4/kg */
export function perKg(v: number | null | undefined, opts: { signed?: boolean } = {}): string {
    if (v == null || !isFinite(v)) return "—";
    const sign = v < 0 ? MINUS : opts.signed && v > 0 ? "+" : "";
    return `${sign}₹${group(Math.abs(v), 1)}/kg`;
}

/** 1.11 L kg · 4,082 kg */
export function kg(v: number | null | undefined): string {
    if (v == null || !isFinite(v)) return "—";
    const abs = Math.abs(v);
    const body = abs >= 1e5 ? `${group(abs / 1e5, 2)}${NBSP}L` : group(abs);
    return `${v < 0 ? MINUS : ""}${body}${NBSP}kg`;
}

export function pct(v: number | null | undefined, opts: { signed?: boolean; digits?: number } = {}): string {
    if (v == null || !isFinite(v)) return "—";
    if (Math.abs(v) < 0.5 * 10 ** -(opts.digits ?? 1)) v = 0; // no "−0.0%"
    const sign = v < 0 ? MINUS : opts.signed && v > 0 ? "+" : "";
    return `${sign}${group(Math.abs(v), opts.digits ?? 1)}%`;
}

/** Percentage-point change: +2.3 pts */
export function pts(v: number | null | undefined): string {
    if (v == null || !isFinite(v)) return "—";
    return `${v < 0 ? MINUS : v > 0 ? "+" : ""}${group(Math.abs(v), 1)}${NBSP}pts`;
}

export function count(v: number | null | undefined): string {
    if (v == null || !isFinite(v)) return "—";
    return group(Math.round(v));
}

export function num(v: number | null | undefined, digits = 2): string {
    if (v == null || !isFinite(v)) return "—";
    return `${v < 0 ? MINUS : ""}${group(Math.abs(v), digits)}`;
}

export function days(v: number | null | undefined): string {
    if (v == null || !isFinite(v)) return "—";
    return `${group(Math.round(v))}${NBSP}days`;
}

/** Relative change in %, or null when the base is missing or zero. */
export function change(cur: number | null | undefined, prev: number | null | undefined): number | null {
    if (cur == null || prev == null || prev === 0) return null;
    return ((cur - prev) / Math.abs(prev)) * 100;
}

/** Lakhs at one decimal, for figures that must add up on screen (the bridge). */
export function lakh(v: number, opts: { signed?: boolean } = {}): string {
    const r = Math.round(v * 10) / 10 || 0;
    const sign = r < 0 ? MINUS : opts.signed && r > 0 ? "+" : "";
    return `${sign}₹${group(Math.abs(r), 1)}${NBSP}L`;
}

/**
 * Rounds parts to one decimal so they sum exactly to the rounded total
 * (largest-remainder method). Inputs and output are in lakhs.
 */
export function roundToTotal(parts: number[], total: number): number[] {
    const target = Math.round(total * 10);
    const scaled = parts.map(p => p * 10);
    const floors = scaled.map(Math.floor);
    let short = target - floors.reduce((s, x) => s + x, 0);
    const order = scaled.map((x, i) => ({ i, rem: x - Math.floor(x) })).sort((a, b) => b.rem - a.rem);
    const out = [...floors];
    for (let k = 0; short > 0 && k < order.length; k++, short--) out[order[k].i] += 1;
    for (let k = order.length - 1; short < 0 && k >= 0; k--, short++) out[order[k].i] -= 1;
    return out.map(x => x / 10);
}
