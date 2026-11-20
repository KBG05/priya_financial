import { MONTH_ORDER } from "@/types";

/**
 * Month series for trend charts: the selected FY's months from Apr up to the
 * selected month, skipping months with no uploaded data. The backend returns
 * placeholder rows (all zeros) for months not uploaded yet, so a month only
 * counts when at least one of its rows carries a non-zero number.
 */

export interface HistPoint<T> {
    fy: string;
    month: string;
    /** Axis label, e.g. "Apr". */
    label: string;
    rows: T[];
}

/** "25_26" + "Jan" → "Jan 26"; "25_26" + "Apr" → "Apr 25". */
export function monthLabel(fy: string, month: string): string {
    const [a, b] = fy.split("_");
    return `${month} ${["Jan", "Feb", "Mar"].includes(month) ? b : a}`;
}

function hasData(row: Record<string, unknown>): boolean {
    return Object.entries(row).some(([k, v]) => k !== "month" && typeof v === "number" && isFinite(v) && v !== 0);
}

/** Fetches Apr→`cur` of `fy`; returns one point per month that has data, in FY order. */
export async function fetchHistory<T extends { month: string }>(
    fetcher: (months: string[], fy: string) => Promise<{ data: any[] }>,
    fy: string | undefined,
    cur: string,
): Promise<HistPoint<T>[]> {
    if (!fy) return [];
    const months = MONTH_ORDER.slice(0, Math.max(MONTH_ORDER.indexOf(cur as any), 0) + 1);
    const rows = await fetcher([...months], fy).then(r => r.data as T[]).catch(() => [] as T[]);
    return months
        .map(m => ({ fy, month: m, label: m, rows: rows.filter(r => r.month === m) }))
        .filter(pt => pt.rows.some(r => hasData(r as any)));
}
