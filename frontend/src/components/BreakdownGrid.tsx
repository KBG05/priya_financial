import { fmt } from "@/lib/format";
import { sectionIcon, stripLeadingEmoji } from "@/lib/sectionIcons";
import { cn } from "@/lib/utils";

export interface BreakdownRow {
    label: string;
    value: number | null;
}

export interface BreakdownGroup {
    title: string;
    rows: BreakdownRow[];
}

interface Props {
    groups: BreakdownGroup[];
    rupee?: boolean;
    pct?: boolean;
    className?: string;
}

function isTotalLabel(label: string) {
    const l = label.toLowerCase();
    return l.startsWith("total") || l === "nett profit" || l.startsWith("grand") || l.endsWith("->");
}

/** One category's line items rendered as a compact bar-list — the single-month
 *  alternative to a wide, mostly-empty two-column ledger table. */
function BreakdownCard({ title, rows, rupee, pct }: BreakdownGroup & { rupee?: boolean; pct?: boolean }) {
    const Icon = sectionIcon(title);
    const label = stripLeadingEmoji(title);
    const maxAbs = Math.max(1, ...rows.map(r => Math.abs(r.value ?? 0)));

    return (
        <div className="rounded-xl border border-border/70 bg-card overflow-hidden min-w-0 flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/20">
                <Icon size={14} className="text-primary shrink-0" strokeWidth={2} />
                <span className="font-display font-semibold text-[13px] tracking-tight">{label}</span>
            </div>
            <div className="flex flex-col px-4 py-1.5">
                {rows.map((r, i) => {
                    const isTotal = isTotalLabel(r.label);
                    const isNeg = (r.value ?? 0) < 0;
                    const pctWidth = r.value == null ? 0 : Math.max(3, (Math.abs(r.value) / maxAbs) * 100);
                    const barColor = r.value == null ? "hsl(var(--muted-foreground))" : isNeg ? "hsl(var(--destructive))" : "hsl(var(--primary))";
                    return (
                        <div
                            key={`${r.label}-${i}`}
                            className={cn(
                                "flex items-center gap-3 py-2",
                                isTotal && "border-t border-border/50 mt-1 pt-2.5"
                            )}
                        >
                            <span className={cn(
                                "text-[12px] w-[38%] shrink-0 truncate",
                                isTotal ? "font-semibold text-foreground" : "text-muted-foreground"
                            )}>
                                {r.label}
                            </span>
                            <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden min-w-0">
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${pctWidth}%`, backgroundColor: barColor, opacity: r.value == null ? 0.3 : isTotal ? 1 : 0.75 }}
                                />
                            </div>
                            <span className={cn(
                                "text-[12px] tabnum shrink-0 text-right w-[92px]",
                                isTotal ? "font-semibold text-foreground" : isNeg ? "text-destructive font-medium" : "text-foreground"
                            )}>
                                {fmt(r.value, { rupee, pct })}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div className="h-1.5" />
        </div>
    );
}

/** Single-month category breakdown — replaces a wide, sparse ledger table with
 *  a grid of compact bar-list cards, one per category. */
export function BreakdownGrid({ groups, rupee, pct, className }: Props) {
    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3", className)}>
            {groups.map(g => (
                <BreakdownCard key={g.title} title={g.title} rows={g.rows} rupee={rupee} pct={pct} />
            ))}
        </div>
    );
}
