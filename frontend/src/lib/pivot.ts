/**
 * pivot.ts — Builds ColDef + formatted row arrays for LedgerTable
 * Handles: single, quarterly, mty-all view modes.
 */
import type { ColDef } from "@/components/LedgerTable";
import type { ViewMode } from "@/types";
import { fmt } from "@/lib/format";

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
                const v = isSnapshot
                    ? (months.indexOf(m) === months.length - 1 ? r?.[valueKey] ?? 0 : 0)
                    : (r?.[valueKey] ?? 0);
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

    return { cols: [], rows: [] };
}

/** Single value lookup */
export function getVal(
    raw: Row[], labelKey: string, label: string, month: string, valueKey = "value"
): number | null {
    return raw.find(x => x[labelKey] === label && x.month === month)?.[valueKey] ?? null;
}
