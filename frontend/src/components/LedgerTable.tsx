import { cn } from "@/lib/utils";

export interface ColDef {
    key: string;
    header: string;
    isLabel?: boolean;
    monthGroup?: string;
    isTotal?: boolean;
    isYtd?: boolean;
}

function isNegStr(v: string) {
    return v.startsWith("(") && v.endsWith(")");
}

interface LedgerTableProps {
    cols: ColDef[];
    rows: Record<string, string>[];
    className?: string;
}

export function LedgerTable({ cols, rows, className }: LedgerTableProps) {
    return (
        <div className={cn("rounded-xl overflow-x-auto slim-scrollbar card-elevated bg-card max-w-full", className)}>
            <table className="w-max min-w-full text-sm">
                {/* Sticky header */}
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
                                            ? "sticky left-0 bg-[hsl(var(--table-header-bg))] pl-4 min-w-[200px] text-left z-20"
                                            : "text-right pr-4 tabnum",
                                        newGroup && "border-l-2 border-border/30",
                                        col.isYtd && "border-l-2 border-primary/30",
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
                    {rows.map((row, ri) => {
                        const label = String(row[cols[0]?.key] ?? "");
                        const isTotal = label.toLowerCase().startsWith("total") ||
                            label.toLowerCase() === "nett profit" ||
                            label.toLowerCase().startsWith("grand");
                        return (
                            <tr
                                key={ri}
                                className={cn(
                                    "border-b border-border/25 transition-colors hover:bg-muted/15",
                                    isTotal && "bg-[hsl(var(--table-header-bg)/0.35)] font-semibold"
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
                                                "py-4 whitespace-nowrap",
                                                col.isLabel
                                                    ? "sticky left-0 bg-card font-medium pl-4 text-left z-10"
                                                    : "text-right pr-4 tabnum",
                                                neg && "text-destructive font-medium",
                                                muted && "text-muted-foreground/40",
                                                newGroup && "border-l-2 border-border/20",
                                                col.isYtd && "border-l-2 border-primary/20",
                                                col.isTotal && "bg-[hsl(var(--table-header-bg)/0.2)] border-l border-border/25",
                                                isTotal && col.isLabel && "text-foreground"
                                            )}
                                        >
                                            {display}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={cols.length} className="py-10 text-center text-sm text-muted-foreground/60">
                                No data for this selection
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
