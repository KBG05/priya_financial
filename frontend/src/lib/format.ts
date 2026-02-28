import { KPI_PCT, KPI_RUPEE } from "@/types";

/** Format a number: negatives as (value), optional ₹ or % prefix/suffix */
export function fmt(
    v: number | null | undefined,
    opts: { rupee?: boolean; pct?: boolean } = {}
): string {
    if (v == null || isNaN(v)) return "—";
    if (v === 0) return "—";
    const abs = Math.abs(v);
    let txt = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (opts.pct) txt = `${txt}%`;
    else if (opts.rupee) txt = `₹\u00a0${txt}`;
    return v < 0 ? `(${txt})` : txt;
}

export function fmtKpi(kpiName: string, v: number | null): string {
    return fmt(v, { pct: KPI_PCT.has(kpiName), rupee: KPI_RUPEE.has(kpiName) });
}

export function isNegativeStr(s: string): boolean {
    return s.startsWith("(") && s.endsWith(")");
}

/** Delta percentage from prev to current */
export function calcDelta(curr: number, prev: number | undefined): number | null {
    if (prev == null || prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
}
