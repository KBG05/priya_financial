import { MONTH_ORDER, type Month } from "@/types";

/** A single fiscal month, e.g. { fy: "25_26", month: "Jun" } = June 2025. */
export interface Period {
    fy: string;
    month: Month;
}

export const FULL_MONTH: Record<Month, string> = {
    Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September",
    Oct: "October", Nov: "November", Dec: "December", Jan: "January", Feb: "February", Mar: "March",
};

export const key = (p: Period) => `${p.fy}:${p.month}`;

export function shiftFy(fy: string, by: number): string {
    const [a, b] = fy.split("_").map(Number);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(a + by)}_${pad(b + by)}`;
}

/** Calendar year a fiscal month falls in: Apr–Dec in the first year, Jan–Mar in the second. */
export function calendarYear(p: Period): number {
    const [a, b] = p.fy.split("_").map(Number);
    return 2000 + (["Jan", "Feb", "Mar"].includes(p.month) ? b : a);
}

export function shift(p: Period, by: number): Period {
    const idx = MONTH_ORDER.indexOf(p.month) + by;
    const fyShift = Math.floor(idx / 12);
    const m = MONTH_ORDER[((idx % 12) + 12) % 12];
    return { fy: shiftFy(p.fy, fyShift), month: m };
}

export const previous = (p: Period) => shift(p, -1);
export const sameMonthLastYear = (p: Period) => shift(p, -12);

/** The n periods strictly before p, oldest first. */
export function trailing(p: Period, n: number): Period[] {
    return Array.from({ length: n }, (_, i) => shift(p, i - n));
}

export const label = (p: Period) => `${FULL_MONTH[p.month]} ${calendarYear(p)}`;
export const shortLabel = (p: Period) => `${p.month} ${String(calendarYear(p)).slice(2)}`;
export const fyLabel = (fy: string) => `FY ${fy.replace("_", "-")}`;

/** Groups periods by fiscal year so each FY table is queried once. */
export function byFy(periods: Period[]): Map<string, Month[]> {
    const out = new Map<string, Month[]>();
    for (const p of periods) {
        const list = out.get(p.fy) ?? [];
        if (!list.includes(p.month)) list.push(p.month);
        out.set(p.fy, list);
    }
    return out;
}
