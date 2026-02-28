import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface ColDef {
    key: string;
    header: string;
    isLabel?: boolean;
    monthGroup?: string;
    isTotal?: boolean;  // style as the "Quarter Total" col
    isYtd?: boolean;    // comparison view YTD col group
}

/** Format a value string: check if it's — or numeric */
function isEmptyVal(v: string) {
    return v === "—" || v === "" || v === "0" || v === "0.00";
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
        <div className={cn("rounded-xl overflow-auto slim-scrollbar card-elevated bg-card", className)}>
            <Table>
                {/* Sticky header */}
                <TableHeader className="sticky top-0 z-10">
                    <TableRow className="ledger-header border-0 hover:bg-transparent">
                        {cols.map((col, i) => {
                            const prevGroup = i > 0 ? cols[i - 1].monthGroup : undefined;
                            const newGroup = col.monthGroup && col.monthGroup !== prevGroup;
                            const isYtdCol = col.isYtd;
                            const isTotCol = col.isTotal;
                            return (
                                <TableHead
                                    key={col.key}
                                    className={cn(
                                        "py-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap border-0",
                                        col.isLabel
                                            ? "sticky left-0 bg-[hsl(var(--table-header-bg))] pl-4 min-w-[200px] text-left z-20"
                                            : "text-right pr-4 tabnum",
                                        newGroup && "border-l-2 border-border/30",
                                        isYtdCol && "border-l-2 border-primary/30 bg-[hsl(var(--table-header-bg))]",
                                        isTotCol && "bg-[hsl(var(--table-header-bg)/0.5)] border-l border-border/40"
                                    )}
                                >
                                    {col.header}
                                </TableHead>
                            );
                        })}
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {rows.map((row, ri) => {
                        const label = String(row[cols[0]?.key] ?? "");
                        const isTotal = label.toLowerCase().startsWith("total") ||
                            label.toLowerCase() === "nett profit" ||
                            label.toLowerCase().startsWith("grand");
                        const isBold = isTotal;
                        return (
                            <TableRow
                                key={ri}
                                className={cn(
                                    "border-b border-border/25 transition-colors",
                                    "hover:bg-muted/20",
                                    isTotal && "bg-[hsl(var(--table-header-bg)/0.35)] font-semibold"
                                )}
                            >
                                {cols.map((col, ci) => {
                                    const raw = row[col.key] ?? "—";
                                    // Show em-dash for empty/zero
                                    const display = (raw === "0" || raw === "0.00" || raw === "") ? "—" : raw;
                                    const neg = !col.isLabel && isNegStr(display);
                                    const muted = !col.isLabel && (display === "—");
                                    const prevGroup = ci > 0 ? cols[ci - 1].monthGroup : undefined;
                                    const newGroup = col.monthGroup && col.monthGroup !== prevGroup;
                                    return (
                                        <TableCell
                                            key={col.key}
                                            className={cn(
                                                "py-4 whitespace-nowrap text-sm border-0",
                                                col.isLabel
                                                    ? "sticky left-0 bg-card font-medium pl-4 text-left z-10"
                                                    : "text-right pr-4 tabnum",
                                                neg && "text-destructive font-medium",
                                                muted && "text-muted-foreground/40",
                                                isBold && col.isLabel && "text-foreground",
                                                newGroup && "border-l-2 border-border/20",
                                                col.isYtd && "border-l-2 border-primary/20",
                                                col.isTotal && "bg-[hsl(var(--table-header-bg)/0.25)] border-l border-border/30"
                                            )}
                                        >
                                            {display}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        );
                    })}
                    {rows.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={cols.length} className="py-10 text-center text-sm text-muted-foreground/60">
                                No data for this selection
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
