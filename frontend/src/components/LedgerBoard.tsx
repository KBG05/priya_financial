import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ColDef } from "@/components/LedgerTable";
import { sectionIcon, stripLeadingEmoji } from "@/lib/sectionIcons";
import { cn } from "@/lib/utils";

export interface LedgerGroup {
    title: string;
    rows: Record<string, string>[];
}

interface Props {
    cols: ColDef[];
    groups: LedgerGroup[];
    /** How many groups start expanded (from the top) */
    defaultOpenCount?: number;
    className?: string;
}

function isNegStr(v: string) {
    return v.startsWith("(") && v.endsWith(")");
}

function isTotalLabel(label: string | null | undefined) {
    const l = (label ?? "").toLowerCase();
    return l.startsWith("total") || l === "nett profit" || l.startsWith("grand") || l.endsWith("->");
}

/** Single unified ledger — every category lives in one scrollable table with collapsible group rows */
export function LedgerBoard({ cols, groups, defaultOpenCount = 2, className }: Props) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
        const init: Record<string, boolean> = {};
        groups.forEach((g, i) => { init[g.title] = i >= defaultOpenCount; });
        return init;
    });
    const toggle = (title: string) => setCollapsed(p => ({ ...p, [title]: !p[title] }));

    return (
        <div className={cn("rounded-xl border border-border/70 bg-card card-elevated overflow-hidden min-w-0", className)}>
            <div className="px-5 py-3.5 border-b border-border/60 bg-muted/20">
                <p className="font-display font-semibold text-sm text-foreground">Financial Ledger</p>
                <p className="text-xs text-muted-foreground mt-0.5">Every line item, grouped by category — click a category to expand</p>
            </div>
            <div style={{ width: "100%", overflowX: "auto" }} className="slim-scrollbar">
                <table className="w-max min-w-full text-sm">
                    <thead className="sticky top-0 z-10">
                        <tr className="ledger-header">
                            {cols.map((col, i) => {
                                const prevGroup = i > 0 ? cols[i - 1].monthGroup : undefined;
                                const newGroup = col.monthGroup && col.monthGroup !== prevGroup;
                                return (
                                    <th
                                        key={col.key}
                                        className={cn(
                                            "py-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap",
                                            col.isLabel
                                                ? "sticky left-0 bg-[hsl(var(--table-header-bg))] pl-4 min-w-[220px] text-left z-20 sticky-col-shadow"
                                                : "text-right pr-4 tabnum",
                                            newGroup && "border-l-2 border-border/30",
                                            col.isTotal && "bg-[hsl(var(--table-header-bg)/0.6)] border-l border-border/40"
                                        )}
                                    >
                                        {col.header}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {groups.map(group => {
                            const isCollapsed = collapsed[group.title] ?? false;
                            const Icon = sectionIcon(group.title);
                            const label = stripLeadingEmoji(group.title);
            return (
                                <Fragment key={group.title}>
                                    <tr
                                        onClick={() => toggle(group.title)}
                                        className="cursor-pointer select-none border-y border-border/40 bg-muted/25 hover:bg-muted/35 transition-colors"
                                    >
                                        <td className="sticky left-0 bg-muted/25 pl-4 py-2 z-10 text-left sticky-col-shadow">
                                            <span className="flex items-center gap-2">
                                                {isCollapsed
                                                    ? <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                                                    : <ChevronDown size={12} className="text-muted-foreground shrink-0" />}
                                                <Icon size={13} className="text-primary shrink-0" strokeWidth={2} />
                                                <span className="font-display font-semibold text-[13px] tracking-tight">{label}</span>
                                                <span className="text-[11px] text-muted-foreground font-normal">({group.rows.length})</span>
                                            </span>
                                        </td>
                                        {cols.slice(1).map(c => (
                                            <td key={c.key} className={cn(
                                                "py-2",
                                                c.isTotal && "border-l border-border/30"
                                            )} />
                                        ))}
                                    </tr>

                                    {!isCollapsed && group.rows.map((row, ri) => {
                                        const rowLabel = String(row[cols[0]?.key] ?? "");
                                        const isTotal = isTotalLabel(rowLabel);
                                        return (
                                            <tr
                                                key={`${group.title}-${ri}`}
                                                className={cn(
                                                    "border-b border-border/20 transition-colors hover:bg-muted/15",
                                                    isTotal && "bg-[hsl(var(--table-header-bg)/0.3)] font-semibold"
                                                )}
                                            >
                                                {cols.map((col, ci) => {
                                                    const raw = row[col.key] ?? "—";
                                                    const display = (raw === "0" || raw === "0.00" || raw === "") ? "—" : raw;
                                                    const neg = !col.isLabel && isNegStr(display);
                                                    const muted = !col.isLabel && display === "—";
                                                    const prevGroup = ci > 0 ? cols[ci - 1].monthGroup : undefined;
                                                    const newGroup = col.monthGroup && col.monthGroup !== prevGroup;
                                                    return (
                                                        <td
                                                            key={col.key}
                                                            className={cn(
                                                                "py-3 whitespace-nowrap",
                                                                col.isLabel
                                                                    ? "sticky left-0 bg-card font-medium pl-7 text-left z-10 sticky-col-shadow"
                                                                    : "text-right pr-4 tabnum",
                                                                neg && "text-destructive font-medium",
                                                                muted && "text-muted-foreground/40",
                                                                newGroup && "border-l-2 border-border/20",
                                                                col.isTotal && "bg-[hsl(var(--table-header-bg)/0.15)] border-l border-border/25",
                                                                isTotal && col.isLabel && "text-foreground bg-muted/10"
                                                            )}
                                                        >
                                                            {display}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </Fragment>
                            );
                        })}
                        {groups.length === 0 && (
                            <tr>
                                <td colSpan={cols.length} className="py-10 text-center text-sm text-muted-foreground/60">
                                    No data for this selection
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
