import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { fmtKpi } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface KpiGroup {
    label: string;
    items: string[];
}

interface GroupedKpiTableProps {
    groups: KpiGroup[];
    allData: any[];       // all months data for the table
    months: string[];     // columns to show
    viewMode: string;
    curMonth: string;
    className?: string;
}

export function GroupedKpiTable({ groups, allData, months, viewMode, curMonth, className }: GroupedKpiTableProps) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const toggle = (label: string) => setCollapsed(p => ({ ...p, [label]: !p[label] }));

    // Build columns
    let cols: { key: string; header: string; isYtd?: boolean; isTotal?: boolean }[];
    if (viewMode === "single") {
        cols = [{ key: curMonth, header: curMonth }];
    } else {
        cols = months.map(m => ({ key: m, header: m }));
        if (viewMode === "quarterly") {
            cols.push({ key: "q_total", header: "Qtr Total", isTotal: true });
        }
    }

    const getVal = (kpiName: string, month: string): number | null =>
        allData.find(r => r.kpi_name === kpiName && r.month === month)?.value ?? null;

    return (
        <div className={cn("rounded-xl bg-card card-elevated overflow-auto slim-scrollbar max-w-full", className)}>
            <Table>
                <TableHeader className="sticky top-0 z-10">
                    <TableRow className="ledger-header border-0 hover:bg-transparent">
                        <TableHead className="sticky left-0 bg-[hsl(var(--table-header-bg))] pl-4 min-w-[200px] text-[11px] font-bold uppercase tracking-widest py-3 z-20 text-left">KPI</TableHead>
                        {cols.map(c => (
                            <TableHead key={c.key} className={cn(
                                "text-right pr-4 py-3 text-[11px] font-bold uppercase tracking-widest tabnum whitespace-nowrap",
                                c.isYtd && "border-l-2 border-primary/30",
                                c.isTotal && "border-l border-border/40 bg-[hsl(var(--table-header-bg)/0.5)]"
                            )}>
                                {c.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {groups.map(group => {
                        const isCollapsed = collapsed[group.label] ?? false;
                        return (
                            <>
                                {/* Group header row — clickable to toggle */}
                                <TableRow
                                    key={`grp-${group.label}`}
                                    onClick={() => toggle(group.label)}
                                    className="ledger-header cursor-pointer hover:brightness-95 border-y border-border/30 select-none"
                                >
                                    <TableCell className="sticky left-0 bg-[hsl(var(--table-header-bg))] pl-4 py-2 font-bold text-sm z-10 text-left">
                                        <span className="flex items-center gap-1.5">
                                            {isCollapsed
                                                ? <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                                                : <ChevronDown size={12} className="text-muted-foreground shrink-0" />}
                                            {group.label}
                                        </span>
                                    </TableCell>
                                    {cols.map(c => (
                                        <TableCell key={c.key} className={cn(
                                            "py-2 border-0",
                                            c.isYtd && "border-l-2 border-primary/20",
                                            c.isTotal && "border-l border-border/30"
                                        )} />
                                    ))}
                                </TableRow>

                                {/* Item rows — hidden when collapsed */}
                                {!isCollapsed && group.items.map(kpi => (
                                    <TableRow key={kpi} className="border-b border-border/20 hover:bg-muted/15 transition-colors">
                                        <TableCell className="sticky left-0 bg-card pl-7 py-4 text-sm font-medium z-10 text-left">
                                            {kpi}
                                        </TableCell>
                                        {cols.map(c => {
                                            let val: number | null;
                                            if (c.key === "ytd") {
                                                // For KPIs, YTD = latest value (not sum)
                                                val = getVal(kpi, curMonth);
                                            } else if (c.key === "q_total") {
                                                // Quarter avg for ratio-type KPIs
                                                const vals = months.map(m => getVal(kpi, m)).filter((v): v is number => v != null);
                                                val = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                                            } else {
                                                val = getVal(kpi, c.key);
                                            }
                                            const display = fmtKpi(kpi, val);
                                            const isNeg = display.startsWith("(") && display.endsWith(")");
                                            return (
                                                <TableCell key={c.key} className={cn(
                                                    "py-4 text-right pr-4 tabnum text-sm border-0 whitespace-nowrap",
                                                    isNeg && "text-destructive",
                                                    (!isNeg && val != null) && "text-foreground",
                                                    val == null && "text-muted-foreground/40",
                                                    c.isYtd && "border-l-2 border-primary/15",
                                                    c.isTotal && "border-l border-border/25 bg-[hsl(var(--table-header-bg)/0.15)]"
                                                )}>
                                                    {val == null ? "—" : display}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
