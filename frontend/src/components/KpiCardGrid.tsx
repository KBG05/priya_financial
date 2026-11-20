import { sectionIcon, stripLeadingEmoji } from "@/lib/sectionIcons";
import { fmtKpi, isNegativeStr, calcDelta } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface KpiCardItem { label: string; value: number | null; prevValue?: number | null; }
export interface KpiCardGroup { title: string; items: KpiCardItem[]; }
interface Props { groups: KpiCardGroup[]; className?: string; }

function KpiTile({ item }: { item: KpiCardItem }) {
    const display = fmtKpi(item.label, item.value);
    const isNeg = isNegativeStr(display);
    const delta = item.value != null ? calcDelta(item.value, item.prevValue ?? undefined) : null;

    return (
        <div className="flex flex-col gap-1 px-3 py-2.5 rounded-lg bg-muted/30 min-w-0">
            <span className="text-[11px] text-muted-foreground truncate" title={item.label}>{item.label}</span>
            <span className={cn(
                "font-display text-lg font-semibold tabnum leading-none",
                isNeg ? "text-destructive" : item.value == null ? "text-muted-foreground/40" : "text-foreground"
            )}>
                {item.value == null ? "—" : display}
            </span>
            {delta != null && (
                <span className={cn("text-[11px] tabnum", delta >= 0 ? "text-positive" : "text-destructive")}>
                    {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
                </span>
            )}
        </div>
    );
}

/** Category cards of small KPI tiles — used for single-month view, where KPIs
 *  span incompatible units (%, ratios, days, ₹) and can't share a bar scale like BreakdownGrid. */
export function KpiCardGrid({ groups, className }: Props) {
    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3", className)}>
            {groups.map(group => {
                const Icon = sectionIcon(group.title);
                return (
                    <div key={group.title} className="rounded-xl border border-border/70 bg-card overflow-hidden min-w-0">
                        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border/60 bg-muted/20">
                            <Icon size={13} className="text-primary shrink-0" strokeWidth={2} />
                            <span className="font-display font-semibold text-[13px] tracking-tight">{stripLeadingEmoji(group.title)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 p-3">
                            {group.items.map(item => <KpiTile key={item.label} item={item} />)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
