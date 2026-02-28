/**
 * pivot.ts — Builds ColDef + formatted row arrays for LedgerTable
 * Handles: single, quarterly, mty-all, comparison (month vs YTD) view modes.
 */
import type { ColDef } from "@/components/LedgerTable";
import type { ViewMode } from "@/types";
import { fmt } from "@/lib/format";
import { MONTH_ORDER } from "@/types";

interface Row { month: string;[key: string]: any; }

export function buildLedgerData(
    raw: Row[],
    labelKey: string,
    valueKey: string,
    labelItems: string[],
    viewMode: ViewMode,
    months: string[],
    opts?: { rupee?: boolean; isSnapshot?: boolean }
): { cols: ColDef[]; rows: Record<string, string>[] } {
    const { rupee = true, isSnapshot = false } = opts ?? {};
    const filtered = raw.filter(r => labelItems.includes(r[labelKey]));

    const fmtVal = (v: any) => fmt(v ?? null, { rupee });

    /** Single month */
    if (viewMode === "single") {
        const curMonth = months[0];
        return {
            cols: [
                { key: labelKey, header: "Item", isLabel: true },
                { key: "value", header: curMonth },
            ],
            rows: labelItems.map(item => {
                const r = filtered.find(x => x[labelKey] === item && x.month === curMonth);
                return { [labelKey]: item, value: fmtVal(r?.[valueKey]) };
            }),
        };
    }

    /** Quarterly — months cols + Quarter Total col */
    if (viewMode === "quarterly") {
        const cols: ColDef[] = [
            { key: labelKey, header: "Item", isLabel: true },
            ...months.map(m => ({ key: m, header: m, monthGroup: m })),
            { key: "q_total", header: "Qtr Total", isTotal: true },
        ];
        const rows = labelItems.map(item => {
            const row: Record<string, string> = { [labelKey]: item };
            let total = 0;
            months.forEach(m => {
                const r = filtered.find(x => x[labelKey] === item && x.month === m);
                const v = isSnapshot ? (months.indexOf(m) === months.length - 1 ? r?.[valueKey] ?? 0 : 0) : (r?.[valueKey] ?? 0);
                total += v;
                row[m] = fmtVal(r?.[valueKey]);
            });
            row["q_total"] = isSnapshot
                ? fmtVal(filtered.find(x => x[labelKey] === item && x.month === months[months.length - 1])?.[valueKey])
                : fmtVal(total);
            return row;
        });
        return { cols, rows };
    }

    /** MTY All Months — current month first */
    if (viewMode === "mty-all") {
        const curMonth = months[months.length - 1];
        const rest = months.filter(m => m !== curMonth);
        const ordered = [curMonth, ...rest];
        const cols: ColDef[] = [
            { key: labelKey, header: "Item", isLabel: true },
            { key: curMonth, header: `▶ ${curMonth}`, monthGroup: curMonth },
            ...rest.map(m => ({ key: m, header: m, monthGroup: m })),
        ];
        const rows = labelItems.map(item => {
            const row: Record<string, string> = { [labelKey]: item };
            ordered.forEach(m => {
                const r = filtered.find(x => x[labelKey] === item && x.month === m);
                row[m] = fmtVal(r?.[valueKey]);
            });
            return row;
        });
        return { cols, rows };
    }

    /** Comparison — Selected Month + YTD (cumulative Apr → curMonth) */
    if (viewMode === "comparison") {
        const curMonth = months[months.length - 1];
        const ytdMonths = raw.length > 0
            ? MONTH_ORDER.filter(m => {
                const idx = MONTH_ORDER.indexOf(curMonth as any);
                return MONTH_ORDER.indexOf(m as any) <= idx && raw.some(x => x.month === m);
            })
            : months;
        const cols: ColDef[] = [
            { key: labelKey, header: "Item", isLabel: true },
            { key: "cur_month", header: curMonth, monthGroup: "cur" },
            { key: "ytd", header: `YTD (Apr–${curMonth})`, isYtd: true },
        ];
        const rows = labelItems.map(item => {
            const curR = filtered.find(x => x[labelKey] === item && x.month === curMonth);
            const ytdTotal = isSnapshot
                ? (filtered.find(x => x[labelKey] === item && x.month === curMonth)?.[valueKey] ?? 0)
                : ytdMonths.reduce((s, m) => {
                    const r = filtered.find(x => x[labelKey] === item && x.month === m);
                    return s + (r?.[valueKey] ?? 0);
                }, 0);
            return { [labelKey]: item, cur_month: fmtVal(curR?.[valueKey]), ytd: fmtVal(ytdTotal) };
        });
        return { cols, rows };
    }

    return { cols: [], rows: [] };
}

/** Single value lookup */
export function getVal(
    raw: Row[], labelKey: string, label: string, month: string, valueKey = "value"
): number | null {
    return raw.find(x => x[labelKey] === label && x.month === month)?.[valueKey] ?? null;
}

/** YTD cumulative sum for one label from Apr up to and including curMonth */
export function getYtdVal(
    raw: Row[], labelKey: string, label: string, curMonth: string, valueKey = "value"
): number {
    const idx = MONTH_ORDER.indexOf(curMonth as any);
    return MONTH_ORDER.slice(0, idx + 1).reduce((s, m) => {
        const r = raw.find(x => x[labelKey] === label && x.month === m);
        return s + (r?.[valueKey] ?? 0);
    }, 0);
}
