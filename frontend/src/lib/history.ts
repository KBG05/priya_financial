import { api } from "@/api";
import { MONTH_ORDER } from "@/types";

/**
 * Cross-FY history for trend charts.
 *
 * Trend charts show every month on record up to the selected one — earlier
 * fiscal years included — and skip months with no uploaded data. The backend
 * returns placeholder rows (all zeros) for months that haven't been uploaded
 * yet, so a month only counts as "on record" when at least one of its rows
 * carries a non-zero number.
 */

export interface HistPoint<T> {
    fy: string;
    month: string;
    /** Axis label, e.g. "Apr 25" / "Jan 26". */
    label: string;
    rows: T[];
}

let fyListPromise: Promise<string[]> | null = null;
function fyList(): Promise<string[]> {
    if (!fyListPromise) {
        fyListPromise = api.fyList()
            .then(r => (r.fy_list.length ? r.fy_list : [r.default]))
            .catch(err => { fyListPromise = null; throw err; });
    }
    return fyListPromise;
}

/** "25_26" + "Jan" → "Jan 26"; "25_26" + "Apr" → "Apr 25". */
export function monthLabel(fy: string, month: string): string {
    const [a, b] = fy.split("_");
    return `${month} ${["Jan", "Feb", "Mar"].includes(month) ? b : a}`;
}

function hasData(row: Record<string, unknown>): boolean {
    return Object.entries(row).some(([k, v]) => k !== "month" && typeof v === "number" && isFinite(v) && v !== 0);
}

/**
 * Fetches all months of every FY up to and including `fy`, stopping at `cur`
 * in the current FY. Returns one point per month that has data, oldest first.
 */
export async function fetchHistory<T extends { month: string }>(
    fetcher: (months: string[], fy: string) => Promise<{ data: any[] }>,
    fy: string | undefined,
    cur: string,
): Promise<HistPoint<T>[]> {
    if (!fy) return [];
    const fys = (await fyList().catch(() => [fy])).filter(f => f <= fy).sort();
    if (!fys.includes(fy)) fys.push(fy);
    const curIdx = Math.max(MONTH_ORDER.indexOf(cur as any), 0);

    const perFy = await Promise.all(fys.map(f => {
        const months = f === fy ? MONTH_ORDER.slice(0, curIdx + 1) : [...MONTH_ORDER];
        return fetcher([...months], f)
            .then(r => ({ fy: f, months, rows: r.data as T[] }))
            .catch(() => ({ fy: f, months, rows: [] as T[] }));
    }));

    const points: HistPoint<T>[] = [];
    for (const { fy: f, months, rows } of perFy) {
        for (const m of months) {
            const monthRows = rows.filter(r => r.month === m);
            if (!monthRows.some(r => hasData(r as any))) continue;
            points.push({ fy: f, month: m, label: monthLabel(f, m), rows: monthRows });
        }
    }
    return points;
}
