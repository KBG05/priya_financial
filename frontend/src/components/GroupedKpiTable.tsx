import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";
import { fmtKpi } from "@/lib/format";
import { cn } from "@/lib/utils";
import { sectionIcon } from "@/lib/sectionIcons";

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
            cols.push({ key: "q_total", header: "Qtr Avg", isTotal: true });
        } else if (viewMode === "mty-all") {
            cols.push({ key: "FY", header: "FY Total", isTotal: true });
        }
    }

    const getVal = (kpiName: string, month: string): number | null =>
        allData.find(r => r.kpi_name === kpiName && r.month === month)?.value ?? null;

    return (
        <div className={cn("rounded-xl border border-border/70 bg-card card-elevated overflow-hidden min-w-0", className)}>
            <div className="px-5 py-3.5 border-b border-border/60 bg-muted/20">
                <p className="font-display font-semibold text-sm text-foreground">KPI Ledger</p>
                <p className="text-xs text-muted-foreground mt-0.5">Every KPI, grouped by category — click a category to expand</p>
            </div>
            <div className="overflow-auto slim-scrollbar max-w-full">
                <Table>
                    <TableHeader className="sticky top-0 z-10">
                        <TableRow className="ledger-header border-0 hover:bg-transparent">
                            <TableHead className="sticky left-0 bg-[hsl(var(--table-header-bg))] pl-4 min-w-[220px] text-[11px] font-bold uppercase tracking-widest py-3 z-20 text-left sticky-col-shadow">KPI</TableHead>
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
                            const Icon = sectionIcon(group.label);
                            return (
                                <Fragment key={group.label}>
                                    {/* Group header row — clickable to toggle */}
                                    <TableRow
                                        onClick={() => toggle(group.label)}
                                        className="bg-muted/25 cursor-pointer hover:bg-muted/35 border-y border-border/40 select-none transition-colors"
                                    >
                                        <TableCell className="sticky left-0 bg-muted/25 pl-4 py-2 z-10 text-left sticky-col-shadow">
                                            <span className="flex items-center gap-2">
                                                {isCollapsed
                                                    ? <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                                                    : <ChevronDown size={12} className="text-muted-foreground shrink-0" />}
                                                <Icon size={13} className="text-primary shrink-0" strokeWidth={2} />
                                                <span className="font-display font-semibold text-[13px] tracking-tight">{group.label}</span>
                                                <span className="text-[11px] text-muted-foreground font-normal">({group.items.length})</span>
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
                                            <TableCell className="sticky left-0 bg-card pl-7 py-3.5 text-sm font-medium z-10 text-left sticky-col-shadow">
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
                                                        "py-3.5 text-right pr-4 tabnum text-sm border-0 whitespace-nowrap",
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
                                </Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
